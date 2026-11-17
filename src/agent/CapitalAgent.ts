import { PortfolioState, TradeOrder, ExecutionLog } from '../types';
import { PythOracleService } from '../tools/pythTools';
import { JupiterDexService } from '../tools/jupiterTools';
import { SolanaWalletService, KNOWN_MINTS } from '../tools/solanaTools';
import { RiskGuardrails } from '../guardrails/RiskGuardrails';
import { RebalanceStrategy } from '../strategies/RebalanceStrategy';
import { DcaStrategy } from '../strategies/DCAStrategy';

export class CapitalAgent {
  public portfolio: PortfolioState;
  public guardrails: RiskGuardrails;
  public oracle: PythOracleService;
  public dex: JupiterDexService;
  public wallet: SolanaWalletService;
  public rebalancer: RebalanceStrategy;
  public dca: DcaStrategy;
  public logs: ExecutionLog[] = [];
  public tradeHistory: TradeOrder[] = [];
  private isRunning: boolean = false;

  constructor() {
    this.guardrails = new RiskGuardrails();
    this.oracle = new PythOracleService();
    this.dex = new JupiterDexService();
    this.wallet = new SolanaWalletService();
    this.rebalancer = new RebalanceStrategy(3.0);
    this.dca = new DcaStrategy();

    this.portfolio = {
      walletAddress: this.wallet.getPublicKey(),
      totalValueUsd: 0,
      assets: {
        SOL: {
          symbol: 'SOL',
          mint: KNOWN_MINTS.SOL,
          decimals: 9,
          balance: 14.5,
          priceUsd: 215.40,
          targetWeight: 0.50 // 50% target
        },
        USDC: {
          symbol: 'USDC',
          mint: KNOWN_MINTS.USDC,
          decimals: 6,
          balance: 1500.0,
          priceUsd: 1.00,
          targetWeight: 0.30 // 30% target
        },
        JitoSOL: {
          symbol: 'JitoSOL',
          mint: KNOWN_MINTS.JitoSOL,
          decimals: 9,
          balance: 4.2,
          priceUsd: 242.15,
          targetWeight: 0.20 // 20% target
        }
      },
      lastUpdated: Date.now()
    };

    this.calculatePortfolioValue();
    this.log('INFO', 'OOBE Capital Agent initialized with 50/30/20 target allocation on Solana.');
  }

  public log(level: ExecutionLog['level'], message: string, details?: any): void {
    const entry: ExecutionLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      level,
      message,
      details
    };
    this.logs.unshift(entry);
    if (this.logs.length > 100) this.logs.pop();
  }

  public calculatePortfolioValue(): number {
    let total = 0;
    for (const asset of Object.values(this.portfolio.assets)) {
      total += asset.balance * asset.priceUsd;
    }
    this.portfolio.totalValueUsd = Number(total.toFixed(2));
    this.portfolio.lastUpdated = Date.now();
    return this.portfolio.totalValueUsd;
  }

  public async syncMarketPrices(): Promise<void> {
    const symbols = Object.keys(this.portfolio.assets);
    const prices = await this.oracle.getPrices(symbols);
    for (const [sym, data] of Object.entries(prices)) {
      if (this.portfolio.assets[sym]) {
        this.portfolio.assets[sym].priceUsd = data.price;
      }
    }
    this.calculatePortfolioValue();
    this.log('INFO', `Synchronized oracle prices. Total Portfolio: \$${this.portfolio.totalValueUsd.toFixed(2)} USD.`);
  }

  public async runEvaluationCycle(): Promise<{ actionsTaken: number; orders: TradeOrder[] }> {
    await this.syncMarketPrices();
    const executedOrders: TradeOrder[] = [];

    // 1. Check Circuit Breaker
    if (this.guardrails.isCircuitBreakerActive()) {
      this.log('WARN', 'Autonomous evaluation skipped: Circuit Breaker is ACTIVE.');
      return { actionsTaken: 0, orders: [] };
    }

    // 2. Check Rebalance Strategy
    const rebalance = this.rebalancer.analyze(this.portfolio);
    if (rebalance.needed) {
      this.log('INFO', `Rebalance triggered. Max deviation: ${rebalance.maxDeviationPct}%. Processing ${rebalance.orders.length} orders.`);

      for (const req of rebalance.orders) {
        const inputAsset = this.portfolio.assets[req.inputSymbol];
        const outputAsset = this.portfolio.assets[req.outputSymbol];

        const order: TradeOrder = {
          id: 'ord_' + Math.random().toString(36).substring(2, 9),
          inputMint: inputAsset.mint,
          outputMint: outputAsset.mint,
          amountIn: req.amountIn,
          estimatedAmountOut: 0,
          priceImpactPct: 0,
          strategy: 'REBALANCE',
          timestamp: Date.now(),
          status: 'PENDING'
        };

        // Guardrail validation
        const check = this.guardrails.validateOrder(order, req.valueUsd);
        if (!check.allowed) {
          order.status = 'REJECTED';
          order.reason = check.reason;
          this.log('WARN', `Order rejected by Guardrails: ${check.reason}`, { order });
          this.tradeHistory.unshift(order);
          continue;
        }

        // Get DEX quote & route
        const quote = await this.dex.getQuote(order.inputMint, order.outputMint, order.amountIn);
        order.estimatedAmountOut = Number(quote.outAmount);
        order.priceImpactPct = quote.priceImpactPct;

        // Execute Swap
        const res = await this.dex.executeSwap(quote, this.portfolio.walletAddress);
        if (res.success) {
          order.status = 'EXECUTED';
          order.txSignature = res.txHash;
          this.guardrails.recordExecution(req.valueUsd);

          // Update local balances
          inputAsset.balance -= req.amountIn;
          outputAsset.balance += order.estimatedAmountOut;
          this.calculatePortfolioValue();

          this.log('TRADE', `Executed ${req.inputSymbol} -> ${req.outputSymbol} swap via Jupiter: ${req.amountIn} ${req.inputSymbol} for ${order.estimatedAmountOut} ${req.outputSymbol}. TX: ${res.txHash.slice(0, 16)}...`, {
            orderId: order.id,
            txHash: res.txHash
          });

          this.tradeHistory.unshift(order);
          executedOrders.push(order);
        }
      }
    } else {
      this.log('INFO', `Portfolio balanced within ${this.rebalancer['deviationThresholdPct']}% tolerance.`);
    }

    return { actionsTaken: executedOrders.length, orders: executedOrders };
  }
}
