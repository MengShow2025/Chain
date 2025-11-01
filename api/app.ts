/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import authRoutes from './routes/auth.js'
import explorerRoutes from './explorer/routes.js'
import validatorRoutes from './validators/routes.js'
import transactionRoutes from './transactions/routes.js'
import { SECURITY_VALIDATION, PERFORMANCE_CONFIG, SEQUENCER_CONFIG, ADAPTIVE_BATCH_CONFIG } from '../shared/constants/blockchain.js'
import { adaptiveBatchController } from '../shared/utils/adaptive-batch.js'
import { blockchainInstance } from '../shared/blockchain-instance.js'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// load env
dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// ===== 入入口层限流与熔断（Traffic Guard） =====
const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED === 'true'
const RATE_LIMIT_WINDOW_MS = Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '1000')
const RATE_LIMIT_MAX_REQUESTS = Number.parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? '100')

const CIRCUIT_BREAKER_ENABLED = process.env.CIRCUIT_BREAKER_ENABLED === 'true'
const CB_WINDOW_MS = Number.parseInt(process.env.CB_WINDOW_MS ?? '10000')
const CB_ERROR_RATE_THRESHOLD = Number.parseFloat(process.env.CB_ERROR_RATE_THRESHOLD ?? '0.5')
const CB_MIN_REQUESTS = Number.parseInt(process.env.CB_MIN_REQUESTS ?? '50')
const CB_COOLDOWN_MS = Number.parseInt(process.env.CB_COOLDOWN_MS ?? '15000')

type RateState = { count: number; windowStart: number }
type CBState = { total: number; errors: number; windowStart: number; openUntil?: number }
const rateState: Map<string, RateState> = new Map()
const cbState: Map<string, CBState> = new Map()

// ===== 自适应限流（根据链上交易池压力动态调整） =====
const ADAPTIVE_RATE_LIMIT = process.env.ADAPTIVE_RATE_LIMIT === 'true'
const ADAPTIVE_WINDOW_MS = Number.parseInt(process.env.ADAPTIVE_WINDOW_MS ?? '1000')
const GLOBAL_BASE_RPS = Number.parseInt(process.env.GLOBAL_BASE_RPS ?? '1000') // 每窗口允许的全局请求数（submit路径）
const MIN_GLOBAL_LIMIT = Number.parseInt(process.env.MIN_GLOBAL_LIMIT ?? '100')
const BACKPRESSURE_503_THRESHOLD = Number.parseFloat(process.env.BACKPRESSURE_503_THRESHOLD ?? '0.98')

type AdaptiveState = { count: number; windowStart: number; currentLimit: number }
const adaptiveState: AdaptiveState = { count: 0, windowStart: Date.now(), currentLimit: GLOBAL_BASE_RPS }

function computePressure() {
  try {
    const chain = blockchainInstance.getBlockchain()
    if (!chain) {
      // 在测试/开发模式下，根据观察到的请求速率估算压力，避免低负载阶段阈值过低
      if (process.env.NODE_ENV === 'development' || process.env.TESTING_MODE === 'true') {
        const now = Date.now()
        const elapsedMs = Math.max(1, now - adaptiveState.windowStart)
        // 基于当前窗口的请求数估算RPS
        const rpsEstimate = (adaptiveState.count / elapsedMs) * 1000
        // 压力为 RPS 与全局基线之比，限制在 [0.05, 1.0]
        const pressure = Math.max(0.05, Math.min(1.0, rpsEstimate / GLOBAL_BASE_RPS))
        // 批量压力与交易压力保持一致（在无链实例情况下）
        const batchPressure = pressure
        return { pressure, batchPressure }
      }
      return { pressure: 0.1, batchPressure: 0.1 } // 默认低压力（生产环境下无链）
    }
    const stats = chain.getTransactionPoolStats()
    const pending = Number(stats?.pendingTransactions ?? 0)
    const maxPending = Number(PERFORMANCE_CONFIG.MAX_PENDING_TRANSACTIONS)
    const activeBatches = Number(stats?.activeBatches ?? 0)
    const maxBatches = Number(SEQUENCER_CONFIG.MAX_PENDING_BATCHES)
    const pressure = maxPending > 0 ? Math.min(1, pending / maxPending) : 0
    const batchPressure = maxBatches > 0 ? Math.min(1, activeBatches / maxBatches) : 0
    return { pressure, batchPressure }
  } catch (e) {
    console.warn('Failed to compute pressure:', e)
    return { pressure: 0.1, batchPressure: 0.1 }
  }
}

function updateAdaptiveLimit(now: number) {
  // 仅在窗口切换或启动时更新，以降低开销
  const { pressure, batchPressure } = computePressure()
  // 线性衰减 + 最低保留 15%
  const multiplier = Math.max(0.15, 1 - Math.max(pressure, batchPressure))
  const nextLimit = Math.max(MIN_GLOBAL_LIMIT, Math.floor(GLOBAL_BASE_RPS * multiplier))
  adaptiveState.currentLimit = nextLimit
  adaptiveState.windowStart = now
  adaptiveState.count = 0
}

app.use((req: Request, res: Response, next: NextFunction) => {
  const now = Date.now()
  // --- 限流 ---
  if (RATE_LIMIT_ENABLED) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip
    const key = `${req.method}|${ip}`
    let st = rateState.get(key)
    if (!st || now - st.windowStart >= RATE_LIMIT_WINDOW_MS) {
      st = { count: 0, windowStart: now }
      rateState.set(key, st)
    }
    st.count++
    if (st.count > RATE_LIMIT_MAX_REQUESTS) {
      return res.status(429).json({ success: false, error: 'rate_limit_exceeded' })
    }
  }

  // --- 自适应限流（仅作用于交易提交路径）---
  if (ADAPTIVE_RATE_LIMIT && req.method === 'POST' && req.path.startsWith('/api/transactions/submit')) {
    // 过载保护：当压力超过阈值直接返回 503
    const { pressure, batchPressure } = computePressure()
    const maxPressure = Math.max(pressure, batchPressure)
    if (maxPressure >= BACKPRESSURE_503_THRESHOLD) {
      return res.status(503).json({ success: false, error: 'backpressure_overload' })
    }
    // 窗口重置与动态限额更新
    if (now - adaptiveState.windowStart >= ADAPTIVE_WINDOW_MS) {
      updateAdaptiveLimit(now)
      if (process.env.NODE_ENV === 'development') {
        console.log(`[AdaptiveLimit] pressure=${maxPressure.toFixed(3)} limit=${adaptiveState.currentLimit}`)
      }
    }
    adaptiveState.count++
    if (adaptiveState.count > adaptiveState.currentLimit) {
      return res.status(429).json({ success: false, error: 'adaptive_rate_limit' })
    }
  }

  // --- 熔断预检与统计 ---
  if (CIRCUIT_BREAKER_ENABLED) {
    const cbKey = `${req.method}|${req.path}`
    const s = cbState.get(cbKey)
    if (s?.openUntil && now < s.openUntil) {
      return res.status(503).json({ success: false, error: 'circuit_open' })
    }
    // 在响应结束时统计错误率并可能打开熔断
    res.on('finish', () => {
      const endNow = Date.now()
      let st = cbState.get(cbKey)
      if (!st || endNow - st.windowStart >= CB_WINDOW_MS) {
        st = { total: 0, errors: 0, windowStart: endNow }
        cbState.set(cbKey, st)
      }
      st.total++
      if (res.statusCode >= 500) st.errors++
      if (st.total >= CB_MIN_REQUESTS) {
        const rate = st.errors / st.total
        if (rate >= CB_ERROR_RATE_THRESHOLD) {
          st.openUntil = endNow + CB_COOLDOWN_MS
          if (process.env.NODE_ENV === 'development') {
            console.warn(`[CircuitBreaker] Opened for ${cbKey} until ${new Date(st.openUntil).toISOString()} (rate=${rate.toFixed(2)})`)
          }
        }
      }
    })
  }
  next()
})

// 安全模式启动映射：在未显式设置时同步环境开关，便于开发调试
try {
  const mode = SECURITY_VALIDATION.SECURITY_MODE
  if (process.env.SKIP_WITNESS_VALIDATION == null) {
    process.env.SKIP_WITNESS_VALIDATION = mode === 'perf_eval' ? 'true' : 'false'
  }
  if (process.env.NODE_ENV === 'development') {
    console.log(`[App] Security mode=${mode} SKIP_WITNESS_VALIDATION=${process.env.SKIP_WITNESS_VALIDATION}`)
  }
} catch (e) {
  console.warn('[App] Security mode bootstrap failed:', e)
}

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api', explorerRoutes)
app.use('/api/validators', validatorRoutes)
app.use('/api/transactions', transactionRoutes)

// 自适应限流状态查询（仅用于调试/监控）
app.get('/api/limits/adaptive', (req: Request, res: Response) => {
  try {
    const now = Date.now();
    const { pressure, batchPressure } = computePressure();
    const state = {
      currentLimit: adaptiveState.currentLimit,
      windowStart: adaptiveState.windowStart,
      count: adaptiveState.count,
      windowMs: ADAPTIVE_WINDOW_MS,
      baseRps: GLOBAL_BASE_RPS,
      minGlobalLimit: MIN_GLOBAL_LIMIT,
      pressure,
      batchPressure,
      maxPressure: Math.max(pressure, batchPressure),
      ts: now
    };
    res.json({ success: true, state });
  } catch (e) {
    res.status(500).json({ success: false, error: 'adaptive_state_error' });
  }
})

// 自适应批量阈值状态查询（用于调试/监控）
app.get('/api/limits/batch', (req: Request, res: Response) => {
  try {
    // 以当前交易池状态估算压力（复用 computePressure）
    const now = Date.now()
    const { pressure, batchPressure } = computePressure()
    
    // 模拟交易池统计数据用于更新自适应批量控制器
    // 使用系统配置的最大待处理交易数进行缩放，确保压力与阈值调整幅度匹配
    const mockPendingTransactions = Math.floor(
      pressure * Number(PERFORMANCE_CONFIG.MAX_PENDING_TRANSACTIONS)
    )
    const mockActiveBatches = (
      batchPressure >= BACKPRESSURE_503_THRESHOLD
        ? SEQUENCER_CONFIG.MAX_PENDING_BATCHES
        : Math.min(
            SEQUENCER_CONFIG.MAX_PENDING_BATCHES,
            Math.ceil(batchPressure * SEQUENCER_CONFIG.MAX_PENDING_BATCHES)
          )
    ) // 基于批量压力模拟活跃批次数（高压力达到上限）
    
    // 更新自适应批量控制器状态
    adaptiveBatchController.update(mockPendingTransactions, mockActiveBatches)
    
    const st = adaptiveBatchController.getState()
    const payload = {
      enabled: (process.env.ADAPTIVE_BATCH_ENABLED ?? 'true') === 'true' && ADAPTIVE_BATCH_CONFIG.ENABLED,
      sizeThreshold: st.sizeThreshold,
      volumeThreshold: st.volumeThreshold.toString(),
      lastAdjust: st.lastAdjust,
      controllerPressure: st.pressure,
      observedPressure: pressure,
      observedBatchPressure: batchPressure,
      windowMs: st.windowMs,
      bounds: {
        minSize: ADAPTIVE_BATCH_CONFIG.MIN_SIZE_THRESHOLD,
        maxSize: ADAPTIVE_BATCH_CONFIG.MAX_SIZE_THRESHOLD,
        minVolume: ADAPTIVE_BATCH_CONFIG.MIN_VOLUME_THRESHOLD.toString(),
        maxVolume: ADAPTIVE_BATCH_CONFIG.MAX_VOLUME_THRESHOLD.toString(),
      },
      ts: now,
    }
    res.json({ success: true, state: payload })
  } catch (e) {
    res.status(500).json({ success: false, error: 'batch_adaptive_state_error' })
  }
})

// 仅用于测试：模拟 500 错误以验证熔断（需设置 ENABLE_TEST_ROUTES=true）
if (process.env.ENABLE_TEST_ROUTES === 'true') {
  app.get('/api/test/error500', (req: Request, res: Response) => {
    throw new Error('test_500_error')
  })
}

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('API Error:', error.message)
  console.error('Stack:', error.stack)
  res.status(500).json({
    success: false,
    error: 'Server internal error',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined,
  })
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
