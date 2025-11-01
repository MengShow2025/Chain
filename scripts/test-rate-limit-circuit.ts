#!/usr/bin/env tsx

// 压测入口层限流与熔断

const SERVER = process.env.TEST_SERVER_URL || 'http://localhost:3005'

async function postJSON(path: string, body: any): Promise<{ status: number; json: any }> {
  const resp = await fetch(`${SERVER}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  let json: any = null
  try { json = await resp.json() } catch { /* ignore */ }
  return { status: resp.status, json }
}

async function get(path: string): Promise<number> {
  const resp = await fetch(`${SERVER}${path}`)
  return resp.status
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function testRateLimit() {
  console.log('=== 测试限流 ===')
  const n = Number.parseInt(process.env.RATE_TEST_N ?? '150')
  const addr = '0x1234567890abcdef1234567890abcdef12345678'
  const reqs = Array.from({ length: n }, () => postJSON('/api/transactions/offchain/witness/register', { address: addr }))
  const results = await Promise.all(reqs)
  const ok = results.filter(r => r.status === 200).length
  const rl = results.filter(r => r.status === 429).length
  console.log(`限流结果: 200=${ok}, 429=${rl}`)
  if (rl === 0) {
    throw new Error('未触发限流（预期出现 429）')
  }
}

async function testCircuitBreaker() {
  console.log('=== 测试熔断 ===')
  // 预热：确保健康端点可用
  const health = await get('/api/health')
  if (health !== 200) throw new Error('服务器健康检查失败')

  // 连续制造 500 错误，触发熔断
  const attempts = Number.parseInt(process.env.CB_TEST_N ?? '10')
  let code500 = 0, code503 = 0
  for (let i = 0; i < attempts; i++) {
    const status = await get('/api/test/error500')
    if (status === 500) code500++
    if (status === 503) code503++
    await sleep(50)
  }
  console.log(`熔断结果: 500=${code500}, 503=${code503}`)
  if (code503 === 0) {
    throw new Error('未触发熔断（预期出现 503 circuit_open）')
  }
}

async function main() {
  try {
    await testRateLimit()
    await sleep(500)
    await testCircuitBreaker()
    console.log('✅ 限流与熔断测试通过')
    process.exit(0)
  } catch (e) {
    console.error('❌ 测试失败:', (e as Error).message)
    process.exit(1)
  }
}

main().catch(err => {
  console.error('❌ 未捕获错误:', err)
  process.exit(1)
})