export interface OraclePrice {
  symbol: string;
  price: number;
  confidence: number;
  timestamp: number;
}

export class PythOracleService {
  private mockPrices: Record<string, number> = {
    SOL: 215.40,
    USDC: 1.00,
    JitoSOL: 242.15,
    BONK: 0.0000385,
  };

  public async getPrice(symbol: string): Promise<OraclePrice> {
    const basePrice = this.mockPrices[symbol] || 1.0;
    // Add small realistic oracle jitter (+- 0.15%)
    const jitter = (Math.random() - 0.5) * 0.003 * basePrice;
    const finalPrice = Math.max(0.000001, basePrice + jitter);

    return {
      symbol,
      price: Number(finalPrice.toFixed(finalPrice < 1 ? 8 : 4)),
      confidence: 0.0005 * finalPrice,
      timestamp: Date.now(),
    };
  }

  public async getPrices(symbols: string[]): Promise<Record<string, OraclePrice>> {
    const results: Record<string, OraclePrice> = {};
    for (const sym of symbols) {
      results[sym] = await this.getPrice(sym);
    }
    return results;
  }

  public setMockPrice(symbol: string, price: number): void {
    this.mockPrices[symbol] = price;
  }
}
