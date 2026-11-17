export interface TokenAsset {
  symbol: string;
  mint: string;
  decimals: number;
  balance: number;
  priceUsd: number;
  targetWeight: number; // e.g. 0.50 for 50%
}

export interface PortfolioState {
  walletAddress: string;
  totalValueUsd: number;
  assets: Record<string, TokenAsset>;
  lastUpdated: number;
}

export interface GuardrailConfig {
  maxDailyVolumeUsd: number;
  maxTradeSizeUsd: number;
  maxSlippageBps: number; // e.g. 100 bps = 1%
  stopLossThresholdPercent: number; // e.g. 15% draw-down
  blacklistedMints: string[];
  cooldownPeriodMs: number;
}

export interface TradeOrder {
  id: string;
  inputMint: string;
  outputMint: string;
  amountIn: number;
  estimatedAmountOut: number;
  priceImpactPct: number;
  strategy: 'REBALANCE' | 'DCA' | 'STOP_LOSS' | 'MANUAL';
  timestamp: number;
  status: 'PENDING' | 'EXECUTED' | 'REJECTED' | 'FAILED';
  txSignature?: string;
  reason?: string;
}

export interface ExecutionLog {
  id: string;
  timestamp: number;
  level: 'INFO' | 'WARN' | 'ERROR' | 'TRADE';
  message: string;
  details?: any;
}
