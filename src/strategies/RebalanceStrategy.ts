import { PortfolioState, TradeOrder } from '../types';
import { KNOWN_MINTS } from '../tools/solanaTools';

export interface RebalanceSuggestion {
  needed: boolean;
  maxDeviationPct: number;
  orders: Array<{
    inputSymbol: string;
    outputSymbol: string;
    amountIn: number;
    valueUsd: number;
    reason: string;
  }>;
}

export class RebalanceStrategy {
  private deviationThresholdPct: number;

  constructor(deviationThresholdPct: number = 3.0) {
    this.deviationThresholdPct = deviationThresholdPct;
  }

  public analyze(portfolio: PortfolioState): RebalanceSuggestion {
    const totalUsd = portfolio.totalValueUsd;
    if (totalUsd <= 0) {
      return { needed: false, maxDeviationPct: 0, orders: [] };
    }

    const overweighted: Array<{ symbol: string; excessUsd: number; excessUnits: number }> = [];
    const underweighted: Array<{ symbol: string; deficitUsd: number }> = [];

    let maxDeviation = 0;

    for (const [symbol, asset] of Object.entries(portfolio.assets)) {
      const currentValUsd = asset.balance * asset.priceUsd;
      const currentWeight = currentValUsd / totalUsd;
      const targetWeight = asset.targetWeight;
      const deviationPct = (currentWeight - targetWeight) * 100;

      if (Math.abs(deviationPct) > maxDeviation) {
        maxDeviation = Math.abs(deviationPct);
      }

      if (deviationPct > this.deviationThresholdPct) {
        const excessUsd = currentValUsd - (totalUsd * targetWeight);
        overweighted.push({
          symbol,
          excessUsd,
          excessUnits: excessUsd / asset.priceUsd
        });
      } else if (deviationPct < -this.deviationThresholdPct) {
        const deficitUsd = (totalUsd * targetWeight) - currentValUsd;
        underweighted.push({
          symbol,
          deficitUsd
        });
      }
    }

    if (overweighted.length === 0 || underweighted.length === 0) {
      return { needed: false, maxDeviationPct: maxDeviation, orders: [] };
    }

    const orders: RebalanceSuggestion['orders'] = [];

    for (const over of overweighted) {
      for (const under of underweighted) {
        const tradeValUsd = Math.min(over.excessUsd, under.deficitUsd);
        if (tradeValUsd > 10) { // Minimum $10 trade threshold
          const assetIn = portfolio.assets[over.symbol];
          orders.push({
            inputSymbol: over.symbol,
            outputSymbol: under.symbol,
            amountIn: Number((tradeValUsd / assetIn.priceUsd).toFixed(6)),
            valueUsd: Number(tradeValUsd.toFixed(2)),
            reason: `Rebalance: ${over.symbol} is over target weight, routing to ${under.symbol}`
          });
        }
      }
    }

    return {
      needed: orders.length > 0,
      maxDeviationPct: Number(maxDeviation.toFixed(2)),
      orders
    };
  }
}
