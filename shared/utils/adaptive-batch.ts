import { ADAPTIVE_BATCH_CONFIG, PERFORMANCE_CONFIG, SEQUENCER_CONFIG, ZERO_GAS_CONFIG } from '../constants/blockchain.js'

type BatchAdaptiveState = {
  sizeThreshold: number
  volumeThreshold: bigint
  lastAdjust: number
  pressure: number
}

/**
 * 自适应批量阈值控制器
 * - 根据交易池待处理数与挂起批次数的压力动态调整批量形成阈值
 * - 在高压力时降低阈值以加快批次形成，低压力时提升阈值以减少碎片化
 */
class AdaptiveBatchController {
  private state: BatchAdaptiveState = {
    sizeThreshold: ADAPTIVE_BATCH_CONFIG.BASE_SIZE_THRESHOLD,
    volumeThreshold: ADAPTIVE_BATCH_CONFIG.BASE_VOLUME_THRESHOLD,
    lastAdjust: Date.now(),
    pressure: 0,
  }

  /**
   * 更新并获取当前阈值（带窗口节流）
   */
  update(pendingTransactions: number, activeBatches: number): { sizeThreshold: number; volumeThreshold: bigint } {
    // 若未启用自适应，直接返回基准阈值
    const enabled = (process.env.ADAPTIVE_BATCH_ENABLED ?? 'true') === 'true' && ADAPTIVE_BATCH_CONFIG.ENABLED
    const now = Date.now()
    if (!enabled) {
      this.state = {
        sizeThreshold: ZERO_GAS_CONFIG.BATCH_SIZE_THRESHOLD,
        volumeThreshold: ZERO_GAS_CONFIG.BATCH_VOLUME_THRESHOLD,
        lastAdjust: now,
        pressure: 0,
      }
      return { sizeThreshold: this.state.sizeThreshold, volumeThreshold: this.state.volumeThreshold }
    }

    // 窗口控制，避免每次调用都计算
    if (now - this.state.lastAdjust < (Number(process.env.ADAP_BATCH_WINDOW_MS) || ADAPTIVE_BATCH_CONFIG.WINDOW_MS)) {
      return { sizeThreshold: this.state.sizeThreshold, volumeThreshold: this.state.volumeThreshold }
    }

    const maxPending = Number(PERFORMANCE_CONFIG.MAX_PENDING_TRANSACTIONS)
    const maxBatches = Number(SEQUENCER_CONFIG.MAX_PENDING_BATCHES)
    const pressurePending = maxPending > 0 ? Math.min(1, pendingTransactions / maxPending) : 0
    const pressureBatches = maxBatches > 0 ? Math.min(1, activeBatches / maxBatches) : 0
    const pressure = Math.max(pressurePending, pressureBatches)

    // 在线性区间内插值：阈值 = MIN + (1 - pressure) * (MAX - MIN)
    const minSize = Number(process.env.ADAP_BATCH_MIN_SIZE ?? ADAPTIVE_BATCH_CONFIG.MIN_SIZE_THRESHOLD)
    const maxSize = Number(process.env.ADAP_BATCH_MAX_SIZE ?? ADAPTIVE_BATCH_CONFIG.MAX_SIZE_THRESHOLD)
    const minVol = BigInt(process.env.ADAP_BATCH_MIN_VOL ?? ADAPTIVE_BATCH_CONFIG.MIN_VOLUME_THRESHOLD.toString())
    const maxVol = BigInt(process.env.ADAP_BATCH_MAX_VOL ?? ADAPTIVE_BATCH_CONFIG.MAX_VOLUME_THRESHOLD.toString())

    const targetSize = Math.max(minSize, Math.min(maxSize, Math.floor(minSize + (1 - pressure) * (maxSize - minSize))))
    // 体积采用 BigInt 线性插值（整数近似）
    const minVolNum = Number(minVol)
    const maxVolNum = Number(maxVol)
    const targetVolNum = Math.max(minVolNum, Math.min(maxVolNum, Math.floor(minVolNum + (1 - pressure) * (maxVolNum - minVolNum))))
    const targetVol = BigInt(targetVolNum)

    // 平滑调整：当前值向目标值移动一段比例
    const rate = Math.max(0, Math.min(1, Number(process.env.ADAP_BATCH_ADJUST_RATE ?? ADAPTIVE_BATCH_CONFIG.ADJUST_RATE)))
    const nextSize = Math.round(this.state.sizeThreshold + (targetSize - this.state.sizeThreshold) * rate)
    const nextVolNum = Math.floor(Number(this.state.volumeThreshold) + (targetVolNum - Number(this.state.volumeThreshold)) * rate)
    const nextVol = BigInt(nextVolNum)

    this.state = {
      sizeThreshold: Math.max(minSize, Math.min(maxSize, nextSize)),
      volumeThreshold: nextVol < minVol ? minVol : (nextVol > maxVol ? maxVol : nextVol),
      lastAdjust: now,
      pressure,
    }
    return { sizeThreshold: this.state.sizeThreshold, volumeThreshold: this.state.volumeThreshold }
  }

  getState() {
    return { ...this.state, windowMs: Number(process.env.ADAP_BATCH_WINDOW_MS) || ADAPTIVE_BATCH_CONFIG.WINDOW_MS }
  }
}

export const adaptiveBatchController = new AdaptiveBatchController()