/*
 High-concurrency multi-node stress test for TitanChain transaction submit API.
 - Targets multiple nodes' `/api/transactions/submit`
 - Maintains a fixed concurrency for a duration, measures success TPS and response times
 - Runs multiple stages with increasing concurrency and reports highest TPS
*/

const DEFAULT_NODES = [3101, 3102, 3103, 3104].map((p) => `http://localhost:${p}`);
const DEFAULT_STAGES = [20, 40, 80]; // concurrency levels
const DEFAULT_DURATION_SEC = 15; // per stage

function randomHex(len) {
  const chars = 'abcdef0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function makeAddress(prefixHex, index) {
  // 生成唯一有效地址：在prefix中插入index的十六进制，保证40位长度
  const idxHex = index.toString(16);
  const base = (prefixHex.slice(0, Math.max(0, 40 - idxHex.length)) + idxHex).padEnd(40, 'a');
  return '0x' + base;
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

async function runStage({ nodes, concurrency, durationSec, accountCount }) {
  const endAt = Date.now() + durationSec * 1000;
  let nextNodeIdx = 0;
  const nextNode = () => nodes[(nextNodeIdx++) % nodes.length];

  // Prepare addresses and nonces
  const fromAddresses = Array.from({ length: accountCount }, (_, i) => makeAddress('a'.repeat(40), i + 1));
  const nonces = new Map(fromAddresses.map((addr) => [addr, 0]));
  const toAddresses = Array.from({ length: accountCount }, (_, i) => makeAddress('b'.repeat(40), i + 1));

  let inFlight = 0;
  let launched = 0;
  const successes = [];
  const failures = [];
  const durations = [];
  const buckets = new Map(); // second -> success count

  async function submitOnce() {
    if (Date.now() >= endAt) return; // stop launching new requests
    inFlight++;
    launched++;
    const start = Date.now();

    const fromIdx = launched % fromAddresses.length;
    const from = fromAddresses[fromIdx];
    const nonce = nonces.get(from) || 0;
    nonces.set(from, nonce + 1);

    const gasPriceBase = 1000000000; // 1 gwei
    const gasPriceJitter = Math.floor(Math.random() * 1000000000); // up to +1 gwei
    const tx = {
      hash: '0x' + randomHex(64),
      from,
      to: toAddresses[(launched + Math.floor(Math.random() * 13)) % toAddresses.length],
      nonce,
      gas: Math.random() < 0.2 ? '22000' : '21000',
      gasPrice: String(gasPriceBase + gasPriceJitter),
      value: String(Math.floor(Math.random() * 1000)),
      data: '0x',
      isZeroGas: false,
      timestamp: Date.now(),
    };

    const node = nextNode();
    try {
      const res = await fetch(node + '/api/transactions/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tx),
      });
      const ok = res.ok;
      const body = await res.json().catch(() => ({}));
      const end = Date.now();
      const dur = end - start;
      durations.push(dur);
      if (ok && body && body.success) {
        successes.push({ t: end, dur });
        const bucket = Math.floor(end / 1000);
        buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
      } else {
        failures.push({ t: end, dur, status: res.status, body });
      }
    } catch (err) {
      const end = Date.now();
      const dur = end - start;
      durations.push(dur);
      failures.push({ t: end, dur, error: String(err) });
    } finally {
      inFlight--;
      // keep pipeline full
      if (Date.now() < endAt) submitOnce();
    }
  }

  // seed pipeline
  for (let i = 0; i < concurrency; i++) submitOnce();

  // wait until all in-flight completes after end time
  while (Date.now() < endAt || inFlight > 0) {
    await new Promise((r) => setTimeout(r, 50));
  }

  const perSecond = Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([sec, count]) => ({ sec, count }));
  const highestTPS = perSecond.reduce((m, x) => Math.max(m, x.count), 0);
  const avgRT = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  const p50 = percentile(durations, 50);
  const p90 = percentile(durations, 90);
  const p95 = percentile(durations, 95);
  const p99 = percentile(durations, 99);

  return {
    concurrency,
    durationSec,
    launched,
    success: successes.length,
    failure: failures.length,
    highestTPS,
    avgRT,
    p50,
    p90,
    p95,
    p99,
    perSecond,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const nodes = (process.env.NODES ? process.env.NODES.split(',').map(s => s.trim()).filter(Boolean) : DEFAULT_NODES);
  const stages = (process.env.STAGES
    ? process.env.STAGES.split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0)
    : DEFAULT_STAGES);
  const durationSec = Number(process.env.DURATION_SEC || DEFAULT_DURATION_SEC);
  const accountCount = Number(process.env.ACCOUNT_COUNT || 5000);

  console.log('Nodes:', nodes.join(', '));
  console.log('Stages (concurrency):', stages.join(', '), 'duration(sec):', durationSec);
  console.log('Accounts:', accountCount);

  const results = [];
  for (const c of stages) {
    console.log('--- Stage start: concurrency =', c, '---');
    const r = await runStage({ nodes, concurrency: c, durationSec, accountCount });
    results.push(r);
    console.log('Stage result:', JSON.stringify(r, null, 2));
  }

  const best = results.reduce((m, r) => (r.highestTPS > m.highestTPS ? r : m), {
    highestTPS: -1,
  });
  console.log('=== Best TPS Stage ===');
  console.log(JSON.stringify(best, null, 2));
}

main().catch((e) => {
  console.error('Stress test failed:', e);
  process.exit(1);
});