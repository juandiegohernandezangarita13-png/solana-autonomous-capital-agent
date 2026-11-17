export const KNOWN_MINTS = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  JitoSOL: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'
};

export class SolanaWalletService {
  private agentPublicKey: string;

  constructor(publicKey: string = 'OOBEagnt111111111111111111111111111111111111') {
    this.agentPublicKey = publicKey;
  }

  public getPublicKey(): string {
    return this.agentPublicKey;
  }

  public async getSolBalance(): Promise<number> {
    return 14.52; // Default simulated SOL balance
  }

  public async getTokenBalance(mint: string): Promise<number> {
    if (mint === KNOWN_MINTS.USDC) return 1500.0;
    if (mint === KNOWN_MINTS.JitoSOL) return 4.20;
    if (mint === KNOWN_MINTS.BONK) return 25000000.0;
    return 0;
  }
}
