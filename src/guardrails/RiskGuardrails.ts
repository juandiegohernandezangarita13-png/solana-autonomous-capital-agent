import { GuardrailConfig, TradeOrder } from '../types';

export class RiskGuardrails {
  private config: GuardrailConfig;
  private dailyVolumeAccumulator: number = 0;
  private lastResetDay: number = new Date().getUTCDate();
  private lastTradeTimestamp: number = 0;
  private circuitBreakerActive: boolean = false;

  constructor(config?: Partial<GuardrailConfig>) {
    this.config = {
      maxDailyVolumeUsd: 10000,
      maxTradeSizeUsd: 2500,
      maxSlippageBps: 150, // 1.5%
      stopLossThresholdPercent: 12.0, // 12% max drawdown
      blacklistedMints: [
        'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263_scam_sample',
        'ToxicTokenSample11111111111111111111111111111'
      ],
      cooldownPeriodMs: 15000, // 15 seconds between autonomous trades
      ...config,
    };
  }

  public validateOrder(order: TradeOrder, tradeValueUsd: number): { allowed: boolean; reason?: string } {
    this.checkDailyReset();

    if (this.circuitBreakerActive) {
      return { allowed: false, reason: 'CIRCUIT_BREAKER_ACTIVE: Emergency stop triggered.' };
    }

    if (this.config.blacklistedMints.includes(order.inputMint) || this.config.blacklistedMints.includes(order.outputMint)) {
      return { allowed: false, reason: 'SECURITY_VIOLATION: Token is on security blacklist.' };
    }

    if (tradeValueUsd > this.config.maxTradeSizeUsd) {
      return {
        allowed: false,
        reason: `EXCEEDS_MAX_TRADE_SIZE: Requested \$${tradeValueUsd.toFixed(2)} exceeds limit of \$${this.config.maxTradeSizeUsd}`,
      };
    }

    if (this.dailyVolumeAccumulator + tradeValueUsd > this.config.maxDailyVolumeUsd) {
      return {
        allowed: false,
        reason: `EXCEEDS_DAILY_VOLUME: Cumulative daily volume would reach \$${(this.dailyVolumeAccumulator + tradeValueUsd).toFixed(2)}, limit is \$${this.config.maxDailyVolumeUsd}`,
      };
    }

    const now = Date.now();
    if (now - this.lastTradeTimestamp < this.config.cooldownPeriodMs) {
      const waitSec = ((this.config.cooldownPeriodMs - (now - this.lastTradeTimestamp)) / 1000).toFixed(1);
      return {
        allowed: false,
        reason: `COOLDOWN_ACTIVE: Agent must wait ${waitSec}s before initiating another capital reallocation.`,
      };
    }

    return { allowed: true };
  }

  public recordExecution(tradeValueUsd: number): void {
    this.checkDailyReset();
    this.dailyVolumeAccumulator += tradeValueUsd;
    this.lastTradeTimestamp = Date.now();
  }

  public triggerCircuitBreaker(reason: string): void {
    this.circuitBreakerActive = true;
  }

  public resetCircuitBreaker(): void {
    this.circuitBreakerActive = false;
  }

  public isCircuitBreakerActive(): boolean {
    return this.circuitBreakerActive;
  }

  public getDailyVolume(): number {
    this.checkDailyReset();
    return this.dailyVolumeAccumulator;
  }

  public getConfig(): GuardrailConfig {
    return { ...this.config };
  }

  private checkDailyReset(): void {
    const currentDay = new Date().getUTCDate();
    if (currentDay !== this.lastResetDay) {
      this.dailyVolumeAccumulator = 0;
      this.lastResetDay = currentDay;
    }
  }
}
