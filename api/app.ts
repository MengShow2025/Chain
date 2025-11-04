/**
 * TitanChain API Server / TitanChain API服务器
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
import authRoutes from './routes/auth'
import explorerRoutes from './explorer/routes'
import validatorRoutes from './validators/routes'
import transactionRoutes from './transactions/routes'
import blocksRoutes from './blocks/routes'
import walletRoutes from './wallet/routes'
import blockchainRoutes from './blockchain/routes'
import securityRoutes from './security/routes'
import marginRoutes from './routes/margin'
import { generateApiDocs } from './docs/swagger-config'
import { SECURITY_VALIDATION, PERFORMANCE_CONFIG, SEQUENCER_CONFIG, ADAPTIVE_BATCH_CONFIG } from '../shared/constants/blockchain'
import { adaptiveBatchController } from '../shared/utils/adaptive-batch'
import { blockchainInstance } from '../shared/blockchain-instance'

// For ESM mode / ESM模式支持
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables / 加载环境变量
dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Entry-level rate limiting and circuit breaker (Traffic Guard) / 入口层限流与熔断（流量守护）
const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED === 'true'
const RATE_LIMIT_WINDOW_MS = Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '1000')
const RATE_LIMIT_MAX_REQUESTS = Number.parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? '100')

const CIRCUIT_BREAKER_ENABLED = process.env.CIRCUIT_BREAKER_ENABLED === 'true'
const CB_WINDOW_MS = Number.parseInt(process.env.CB_WINDOW_MS ?? '10000')
const CB_ERROR_RATE_THRESHOLD = Number.parseFloat(process.env.CB_ERROR_RATE_THRESHOLD ?? '0.5')
const CB_MIN_REQUESTS = Number.parseInt(process.env.CB_MIN_REQUESTS ?? '50')
const CB_COOLDOWN_MS = Number.parseInt(process.env.CB_COOLDOWN_MS ?? '15000')

// Rate limiting state types / 限流状态类型
type RateState = { count: number; windowStart: number }
type CBState = { total: number; errors: number; windowStart: number; openUntil?: number }
const rateState: Map<string, RateState> = new Map()
const cbState: Map<string, CBState> = new Map()

// Adaptive rate limiting configuration / 自适应限流配置
const ADAPTIVE_RATE_LIMIT = process.env.ADAPTIVE_RATE_LIMIT === 'true'
const ADAPTIVE_WINDOW_MS = Number.parseInt(process.env.ADAPTIVE_WINDOW_MS ?? '1000')
const GLOBAL_BASE_RPS = Number.parseInt(process.env.GLOBAL_BASE_RPS ?? '1000') // Global requests allowed per window (submit path) / 每窗口允许的全局请求数（submit路径）
const MIN_GLOBAL_LIMIT = Number.parseInt(process.env.MIN_GLOBAL_LIMIT ?? '100')
const BACKPRESSURE_503_THRESHOLD = Number.parseFloat(process.env.BACKPRESSURE_503_THRESHOLD ?? '0.98')

// Adaptive state type / 自适应状态类型
type AdaptiveState = { count: number; windowStart: number; currentLimit: number }
const adaptiveState: AdaptiveState = { count: 0, windowStart: Date.now(), currentLimit: GLOBAL_BASE_RPS }

// Compute system pressure / 计算系统压力
function computePressure() {
  try {
    // Get blockchain instance / 获取区块链实例
    const blockchain = blockchainInstance.getBlockchain()
    if (!blockchain) return 0.1

    // Get network stats / 获取网络统计
    const stats = blockchain.getNetworkStats()
    
    // Calculate pressure based on TPS and total transactions / 基于TPS和总交易数计算压力
    const tpsPressure = Math.min(stats.currentTPS / 10000, 1) // Normalize to 10k TPS / 标准化到10k TPS
    const txPressure = Math.min(stats.totalTransactions / 100000, 1) // Normalize to 100k total / 标准化到10万总交易
    
    // Memory usage pressure / 内存使用压力
    const memUsage = process.memoryUsage()
    const memPressure = Math.min(memUsage.heapUsed / (1024 * 1024 * 1024), 1) // Normalize to 1GB / 标准化到1GB
    
    // Combined pressure / 综合压力
    return Math.max(tpsPressure, txPressure, memPressure)
  } catch (error) {
    console.warn('Failed to compute pressure:', error)
    return 0.1 // Default low pressure / 默认低压力
  }
}

// Update adaptive limit based on pressure / 基于压力更新自适应限制
function updateAdaptiveLimit(now: number) {
  const pressure = computePressure()
  const targetLimit = Math.max(MIN_GLOBAL_LIMIT, Math.floor(GLOBAL_BASE_RPS * (1 - pressure)))
  
  // Smooth adjustment / 平滑调整
  adaptiveState.currentLimit = Math.floor(
    adaptiveState.currentLimit * 0.9 + targetLimit * 0.1
  )
}

// Rate limiting and circuit breaker middleware / 限流和熔断中间件
app.use((req: Request, res: Response, next: NextFunction) => {
  const now = Date.now()
  const clientId = req.ip || 'unknown'
  
  // Adaptive rate limiting / 自适应限流
  if (ADAPTIVE_RATE_LIMIT) {
    // Reset window if needed / 如需要则重置窗口
    if (now - adaptiveState.windowStart >= ADAPTIVE_WINDOW_MS) {
      adaptiveState.count = 0
      adaptiveState.windowStart = now
      updateAdaptiveLimit(now)
    }
    
    adaptiveState.count++
    
    // Check if over limit / 检查是否超限
    if (adaptiveState.count > adaptiveState.currentLimit) {
      const pressure = computePressure()
      if (pressure > BACKPRESSURE_503_THRESHOLD) {
        return res.status(503).json({
          error: 'Service temporarily unavailable due to high load',
          retryAfter: Math.ceil(ADAPTIVE_WINDOW_MS / 1000)
        })
      }
    }
  }
  
  // Per-client rate limiting / 每客户端限流
  if (RATE_LIMIT_ENABLED) {
    let state = rateState.get(clientId)
    if (!state || now - state.windowStart >= RATE_LIMIT_WINDOW_MS) {
      state = { count: 0, windowStart: now }
      rateState.set(clientId, state)
    }
    
    state.count++
    if (state.count > RATE_LIMIT_MAX_REQUESTS) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((state.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000)
      })
    }
  }
  
  // Circuit breaker / 熔断器
  if (CIRCUIT_BREAKER_ENABLED) {
    let cbStateData = cbState.get(clientId)
    if (!cbStateData || now - cbStateData.windowStart >= CB_WINDOW_MS) {
      cbStateData = { total: 0, errors: 0, windowStart: now }
      cbState.set(clientId, cbStateData)
    }
    
    // Check if circuit is open / 检查熔断器是否开启
    if (cbStateData.openUntil && now < cbStateData.openUntil) {
      return res.status(503).json({
        error: 'Circuit breaker is open',
        retryAfter: Math.ceil((cbStateData.openUntil - now) / 1000)
      })
    }
    
    cbStateData.total++
  }
  
  next()
})

// Initialize blockchain instance / 初始化区块链实例
try {
  const blockchain = blockchainInstance.getBlockchain()
  if (blockchain) {
    console.log('Blockchain instance initialized successfully / 区块链实例初始化成功')
  }
} catch (e) {
  console.error('Failed to initialize blockchain instance / 区块链实例初始化失败:', e)
}

// API Documentation / API文档
app.use(generateApiDocs)

// Routes / 路由
app.use('/api/auth', authRoutes)
app.use('/api/explorer', explorerRoutes)
app.use('/api/validators', validatorRoutes)
app.use('/api/transactions', transactionRoutes)
app.use('/api/blocks', blocksRoutes)
app.use('/api/wallet', walletRoutes)
app.use('/api/blockchain', blockchainRoutes)
app.use('/api/security', securityRoutes)
app.use('/api/margin', marginRoutes)

// Adaptive limits monitoring endpoint / 自适应限制监控端点
app.get('/api/limits/adaptive', (req: Request, res: Response) => {
  const pressure = computePressure()
  res.json({
    adaptive: {
      enabled: ADAPTIVE_RATE_LIMIT,
      currentLimit: adaptiveState.currentLimit,
      baseLimit: GLOBAL_BASE_RPS,
      minLimit: MIN_GLOBAL_LIMIT,
      currentCount: adaptiveState.count,
      windowStart: adaptiveState.windowStart,
      windowMs: ADAPTIVE_WINDOW_MS,
      pressure: pressure,
      backpressureThreshold: BACKPRESSURE_503_THRESHOLD
    },
    rateLimit: {
      enabled: RATE_LIMIT_ENABLED,
      windowMs: RATE_LIMIT_WINDOW_MS,
      maxRequests: RATE_LIMIT_MAX_REQUESTS
    },
    circuitBreaker: {
      enabled: CIRCUIT_BREAKER_ENABLED,
      windowMs: CB_WINDOW_MS,
      errorThreshold: CB_ERROR_RATE_THRESHOLD,
      minRequests: CB_MIN_REQUESTS,
      cooldownMs: CB_COOLDOWN_MS
    }
  })
})

// Batch processing status endpoint / 批处理状态端点
app.get('/api/limits/batch', (req: Request, res: Response) => {
  try {
    const batchStatus = adaptiveBatchController.getState()
    res.json({
      batch: {
        enabled: true,
        config: {
          maxBatchSize: ADAPTIVE_BATCH_CONFIG.MAX_SIZE_THRESHOLD,
          minBatchSize: ADAPTIVE_BATCH_CONFIG.MIN_SIZE_THRESHOLD,
          batchTimeoutMs: ADAPTIVE_BATCH_CONFIG.WINDOW_MS,
          adaptiveThreshold: ADAPTIVE_BATCH_CONFIG.ADJUST_RATE
        },
        status: batchStatus,
        sequencer: {
          enabled: true,
          config: {
            maxOrdersPerBatch: SEQUENCER_CONFIG.MAX_ORDERS_PER_BATCH,
            microbatchInterval: SEQUENCER_CONFIG.MICROBATCH_INTERVAL_MS,
            maxPendingBatches: SEQUENCER_CONFIG.MAX_PENDING_BATCHES
          }
        },
        performance: {
          targetTps: PERFORMANCE_CONFIG.TARGET_TPS,
          maxBlockSize: PERFORMANCE_CONFIG.MAX_BLOCK_SIZE,
          adaptiveScaling: true
        }
      }
    })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get batch status',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Test routes (only in development) / 测试路由（仅开发环境）
if (process.env.ENABLE_TEST_ROUTES === 'true') {
  app.get('/api/test/pressure', (req: Request, res: Response) => {
    res.json({ pressure: computePressure() })
  })
}

// Health check endpoint / 健康检查端点
app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    })
  }
)

// Global error handler / 全局错误处理器
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Global error handler / 全局错误处理器:', error)
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  })
})

// 404 handler / 404处理器
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path
  })
})

export default app
