import { CapitalAgent } from './agent/CapitalAgent';
import { McpCapitalServer } from './mcp/server';

async function main() {
  console.log('====================================================');
  console.log('🤖 OOBE Protocol: Solana Autonomous Capital Agent');
  console.log('====================================================\n');

  const agent = new CapitalAgent();
  console.log(`🔑 Agent Wallet: ${agent.portfolio.walletAddress}`);
  console.log(`📊 Initial Portfolio Value: \$${agent.portfolio.totalValueUsd.toFixed(2)} USD\n`);

  console.log('--- Step 1: Syncing Oracle Feeds ---');
  await agent.syncMarketPrices();

  console.log('\n--- Step 2: Evaluating Portfolio Allocation ---');
  for (const [sym, asset] of Object.entries(agent.portfolio.assets)) {
    const val = asset.balance * asset.priceUsd;
    const weight = (val / agent.portfolio.totalValueUsd) * 100;
    console.log(`  - ${sym}: ${asset.balance.toFixed(4)} units @ \$${asset.priceUsd} = \$${val.toFixed(2)} (${weight.toFixed(1)}% / target ${(asset.targetWeight * 100)}%)`);
  }

  console.log('\n--- Step 3: Running Autonomous Evaluation Cycle ---');
  const result = await agent.runEvaluationCycle();
  console.log(`✅ Actions Taken: ${result.actionsTaken}`);

  console.log('\n--- Step 4: MCP Server Initialized ---');
  const mcp = new McpCapitalServer(agent);
  console.log(`Available Tools: ${mcp.getTools().map(t => t.name).join(', ')}`);

  console.log('\n✨ Agent loop ready and operational.');
}

if (require.main === module) {
  main().catch(console.error);
}

export { CapitalAgent, McpCapitalServer };
