export interface DcaPlan {
  targetSymbol: string;
  sourceSymbol: string;
  allocationUsdPerInterval: number;
  intervalMs: number;
  lastExecuted: number;
}

export class DcaStrategy {
  private plan: DcaPlan;

  constructor(plan?: Partial<DcaPlan>) {
    this.plan = {
      targetSymbol: 'SOL',
      sourceSymbol: 'USDC',
      allocationUsdPerInterval: 50.0,
      intervalMs: 3600000, // 1 hour
      lastExecuted: 0,
      ...plan,
    };
  }

  public shouldExecute(currentTime: number = Date.now()): boolean {
    return (currentTime - this.plan.lastExecuted) >= this.plan.intervalMs;
  }

  public generateOrder(sourcePriceUsd: number = 1.0): { amountIn: number; valueUsd: number } {
    return {
      amountIn: this.plan.allocationUsdPerInterval / sourcePriceUsd,
      valueUsd: this.plan.allocationUsdPerInterval
    };
  }

  public recordExecution(timestamp: number = Date.now()): void {
    this.plan.lastExecuted = timestamp;
  }

  public getPlan(): DcaPlan {
    return { ...this.plan };
  }
}
