import { CapitalAgent } from '../agent/CapitalAgent';

/**
 * Model Context Protocol (MCP) Tool Definition for OOBE Capital Agent
 */
export class McpCapitalServer {
  private agent: CapitalAgent;

  constructor(agent: CapitalAgent) {
    this.agent = agent;
  }

  public getTools() {
    return [
      {
        name: 'get_portfolio_state',
        description: 'Returns the current Solana token balances, Pyth valuations, target weights, and total USD value of the agent portfolio.',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'run_rebalance_check',
        description: 'Runs autonomous evaluation cycle against target allocations and executes Jupiter DEX rebalancing if deviations exceed threshold.',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'get_risk_guardrails',
        description: 'Inspects current safety limits, daily volume caps, and circuit breaker status.',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'trigger_emergency_circuit_breaker',
        description: 'Activates emergency stop, immediately freezing all autonomous swaps and capital movements.',
        inputSchema: {
          type: 'object',
          properties: {
            reason: { type: 'string', description: 'Justification for triggering emergency stop' }
          },
          required: ['reason']
        }
      }
    ];
  }

  public async handleToolCall(name: string, args: any) {
    switch (name) {
      case 'get_portfolio_state':
        await this.agent.syncMarketPrices();
        return {
          content: [{ type: 'text', text: JSON.stringify(this.agent.portfolio, null, 2) }]
        };
      case 'run_rebalance_check':
        const res = await this.agent.runEvaluationCycle();
        return {
          content: [{ type: 'text', text: JSON.stringify(res, null, 2) }]
        };
      case 'get_risk_guardrails':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              config: this.agent.guardrails.getConfig(),
              dailyVolumeUsed: this.agent.guardrails.getDailyVolume(),
              circuitBreakerActive: this.agent.guardrails.isCircuitBreakerActive()
            }, null, 2)
          }]
        };
      case 'trigger_emergency_circuit_breaker':
        this.agent.guardrails.triggerCircuitBreaker(args.reason || 'Manual emergency call');
        this.agent.log('ERROR', `CIRCUIT BREAKER TRIGGERED: ${args.reason}`);
        return {
          content: [{ type: 'text', text: `Emergency circuit breaker activated. Reason: ${args.reason}` }]
        };
      default:
        throw new Error(`Unknown MCP tool: ${name}`);
    }
  }
}
