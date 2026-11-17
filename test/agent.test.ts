import { test, describe } from 'node:test';
import assert from 'node:assert';
import { CapitalAgent } from '../src/agent/CapitalAgent';
import { RiskGuardrails } from '../src/guardrails/RiskGuardrails';
import { RebalanceStrategy } from '../src/strategies/RebalanceStrategy';
import { McpCapitalServer } from '../src/mcp/server';

describe('OOBE Capital Agent Test Suite', () => {
  test('Portfolio valuation calculates accurately', () => {
    const agent = new CapitalAgent();
    const total = agent.calculatePortfolioValue();
    assert.ok(total > 0, 'Portfolio total USD must be positive');
  });

  test('Risk guardrails reject orders exceeding maximum trade size', () => {
    const guardrails = new RiskGuardrails({ maxTradeSizeUsd: 1000 });
    const check = guardrails.validateOrder({
      id: 'test_1',
      inputMint: 'mintA',
      outputMint: 'mintB',
      amountIn: 10,
      estimatedAmountOut: 10,
      priceImpactPct: 0.1,
      strategy: 'REBALANCE',
      timestamp: Date.now(),
      status: 'PENDING'
    }, 1500); // $1500 > $1000 limit

    assert.strictEqual(check.allowed, false);
    assert.match(check.reason || '', /EXCEEDS_MAX_TRADE_SIZE/);
  });

  test('Circuit breaker halts all operations when triggered', () => {
    const agent = new CapitalAgent();
    agent.guardrails.triggerCircuitBreaker('Market crash detected');
    assert.strictEqual(agent.guardrails.isCircuitBreakerActive(), true);

    const check = agent.guardrails.validateOrder({
      id: 'test_2',
      inputMint: 'mintA',
      outputMint: 'mintB',
      amountIn: 1,
      estimatedAmountOut: 1,
      priceImpactPct: 0.1,
      strategy: 'REBALANCE',
      timestamp: Date.now(),
      status: 'PENDING'
    }, 50);

    assert.strictEqual(check.allowed, false);
    assert.match(check.reason || '', /CIRCUIT_BREAKER_ACTIVE/);
  });

  test('RebalanceStrategy detects deviation and generates compensating orders', () => {
    const rebalancer = new RebalanceStrategy(3.0);
    const mockPortfolio = {
      walletAddress: 'MockWallet1111111111111111111111111111111111',
      totalValueUsd: 10000,
      assets: {
        SOL: { symbol: 'SOL', mint: 'mintSol', decimals: 9, balance: 35, priceUsd: 200, targetWeight: 0.50 }, // $7,000 (70% vs 50% target -> +20% deviation)
        USDC: { symbol: 'USDC', mint: 'mintUsdc', decimals: 6, balance: 3000, priceUsd: 1, targetWeight: 0.50 } // $3,000 (30% vs 50% target -> -20% deviation)
      },
      lastUpdated: Date.now()
    };

    const res = rebalancer.analyze(mockPortfolio);
    assert.strictEqual(res.needed, true);
    assert.ok(res.orders.length > 0, 'Must produce rebalance orders');
    assert.strictEqual(res.orders[0].inputSymbol, 'SOL');
    assert.strictEqual(res.orders[0].outputSymbol, 'USDC');
  });

  test('MCP Capital Server handles tool calls correctly', async () => {
    const agent = new CapitalAgent();
    const mcp = new McpCapitalServer(agent);

    const tools = mcp.getTools();
    assert.strictEqual(tools.length, 4);

    const state = await mcp.handleToolCall('get_portfolio_state', {});
    assert.ok(state.content[0].text.includes('walletAddress'));
  });
});
