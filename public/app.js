// State
const state = {
  wallet: 'OOBEagnt111111111111111111111111111111111111',
  active: true,
  dailyVol: 850.0,
  maxDailyVol: 10000.0,
  assets: {
    SOL: { symbol: 'SOL', balance: 14.50, price: 215.40, target: 0.50 },
    USDC: { symbol: 'USDC', balance: 1500.0, price: 1.00, target: 0.30 },
    JitoSOL: { symbol: 'JitoSOL', balance: 4.20, price: 242.15, target: 0.20 }
  },
  logs: [
    { time: '10:04:12', level: 'INFO', msg: 'OOBE Capital Agent initialized with Pyth Oracle & Jupiter v6 DEX.' },
    { time: '10:05:01', level: 'TRADE', msg: 'Rebalanced 1.2 SOL -> 258.48 USDC via Jupiter Whirlpool. TX: 4kPq8...9ZxM' },
    { time: '10:06:33', level: 'INFO', msg: 'Pyth Oracle price sync complete. Confidence ±0.05%.' }
  ],
  trades: [
    { id: 'ord_9f8a12', strategy: 'REBALANCE', pair: 'SOL -> USDC', in: '1.2000 SOL', out: '258.48 USDC', slip: '0.08%', tx: '4kPq81jMn...9ZxM', status: 'EXECUTED' },
    { id: 'ord_3b4c91', strategy: 'DCA', pair: 'USDC -> JitoSOL', in: '100.00 USDC', out: '0.4132 JitoSOL', slip: '0.04%', tx: '7vRt38pLm...2WqP', status: 'EXECUTED' },
    { id: 'ord_1a7e55', strategy: 'STOP_LOSS', pair: 'BONK -> USDC', in: '1500000 BONK', out: '57.75 USDC', slip: '0.12%', tx: '9mKx14wQo...8LtY', status: 'EXECUTED' }
  ]
};

function getTotalValue() {
  let total = 0;
  for (const a of Object.values(state.assets)) {
    total += a.balance * a.price;
  }
  return total;
}

function updateUI() {
  const total = getTotalValue();
  document.getElementById('kpiTotalVal').innerText = '$' + total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  document.getElementById('kpiDailyVol').innerHTML = `$${state.dailyVol.toFixed(2)} <span class="kpi-limit">/ $${state.maxDailyVol.toLocaleString()}</span>`;
  document.getElementById('kpiVolFill').style.width = `${Math.min(100, (state.dailyVol / state.maxDailyVol) * 100)}%`;

  // Render Assets
  const list = document.getElementById('assetList');
  list.innerHTML = '';
  for (const [sym, asset] of Object.entries(state.assets)) {
    const val = asset.balance * asset.price;
    const currentWeight = (val / total) * 100;
    const targetWeight = asset.target * 100;
    const diff = currentWeight - targetWeight;

    const div = document.createElement('div');
    div.className = 'asset-item';
    div.innerHTML = `
      <div class="asset-top">
        <span class="asset-name">${sym}</span>
        <span class="asset-val">$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>
      <div class="asset-metrics">
        <span>${asset.balance.toFixed(4)} @ $${asset.price.toFixed(2)}</span>
        <span>Alloc: <strong>${currentWeight.toFixed(1)}%</strong> (Target ${targetWeight.toFixed(0)}% | ${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%)</span>
      </div>
      <div class="progress-bar-bg mt-2">
        <div class="progress-bar-fill" style="width: ${Math.min(100, currentWeight)}%"></div>
      </div>
    `;
    list.appendChild(div);
  }

  // Render Logs
  const stream = document.getElementById('logStream');
  stream.innerHTML = state.logs.map(l => `
    <div class="log-entry">
      <span class="log-time">[${l.time}]</span>
      <span class="log-level ${l.level}">${l.level}</span>
      <span>${l.msg}</span>
    </div>
  `).join('');

  // Render Trades
  const tbody = document.getElementById('tradeTableBody');
  tbody.innerHTML = state.trades.map(t => `
    <tr>
      <td>${t.id}</td>
      <td><span class="badge">${t.strategy}</span></td>
      <td><strong>${t.pair}</strong></td>
      <td>${t.in}</td>
      <td>${t.out}</td>
      <td>${t.slip}</td>
      <td><code>${t.tx}</code></td>
      <td><span class="status-badge ${t.status}">${t.status}</span></td>
    </tr>
  `).join('');

  document.getElementById('tradeCountBadge').innerText = `${state.trades.length} Executed`;
}

function addLog(level, msg) {
  const d = new Date();
  const time = d.toTimeString().split(' ')[0];
  state.logs.unshift({ time, level, msg });
  if (state.logs.length > 50) state.logs.pop();
  updateUI();
}

// Button Listeners
document.getElementById('btnRunCycle').addEventListener('click', () => {
  if (!state.active) {
    addLog('WARN', 'Autonomous cycle aborted: Emergency Circuit Breaker is active.');
    return;
  }
  addLog('INFO', 'Evaluating portfolio weights against Pyth oracle prices...');

  const total = getTotalValue();
  let maxDev = 0;
  let overSym = null;
  let underSym = null;

  for (const [sym, a] of Object.entries(state.assets)) {
    const curW = (a.balance * a.price) / total;
    const dev = (curW - a.target) * 100;
    if (Math.abs(dev) > maxDev) maxDev = Math.abs(dev);
    if (dev > 2.0) overSym = sym;
    if (dev < -2.0) underSym = sym;
  }

  if (overSym && underSym && maxDev > 2.0) {
    const rebalanceUsd = 120.0;
    const inAmount = rebalanceUsd / state.assets[overSym].price;
    const outAmount = (rebalanceUsd * 0.998) / state.assets[underSym].price; // 0.2% fee

    state.assets[overSym].balance -= inAmount;
    state.assets[underSym].balance += outAmount;
    state.dailyVol += rebalanceUsd;

    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let tx = '';
    for (let i = 0; i < 16; i++) tx += chars.charAt(Math.floor(Math.random() * chars.length));

    state.trades.unshift({
      id: 'ord_' + Math.random().toString(36).substring(2, 8),
      strategy: 'REBALANCE',
      pair: `${overSym} -> ${underSym}`,
      in: `${inAmount.toFixed(4)} ${overSym}`,
      out: `${outAmount.toFixed(4)} ${underSym}`,
      slip: '0.07%',
      tx: tx + '...',
      status: 'EXECUTED'
    });

    addLog('TRADE', `Rebalanced: Swapped ${inAmount.toFixed(4)} ${overSym} for ${outAmount.toFixed(4)} ${underSym} via Jupiter. TX: ${tx}...`);
  } else {
    addLog('INFO', `Portfolio deviation is ${maxDev.toFixed(1)}% (within ±2% target range). No swaps required.`);
  }
  updateUI();
});

document.getElementById('btnSimulateSolRally').addEventListener('click', () => {
  state.assets.SOL.price *= 1.15;
  addLog('INFO', `Simulated market event: SOL pumped +15% to $${state.assets.SOL.price.toFixed(2)}. Allocation skew created!`);
  updateUI();
});

document.getElementById('btnSimulateDrop').addEventListener('click', () => {
  state.assets.SOL.price *= 0.90;
  addLog('WARN', `Simulated market event: SOL dropped -10% to $${state.assets.SOL.price.toFixed(2)}.`);
  updateUI();
});

document.getElementById('btnCircuitBreaker').addEventListener('click', () => {
  state.active = !state.active;
  const badge = document.getElementById('agentStatusBadge');
  const txt = document.getElementById('agentStatusText');
  const riskKpi = document.getElementById('kpiRiskStatus');

  if (!state.active) {
    badge.className = 'status-indicator halted';
    txt.innerText = 'EMERGENCY HALTED';
    riskKpi.className = 'kpi-value text-danger';
    riskKpi.innerText = 'HALTED (CIRCUIT)';
    addLog('ERROR', '🚨 EMERGENCY CIRCUIT BREAKER ACTIVATED: All autonomous execution halted.');
  } else {
    badge.className = 'status-indicator active';
    txt.innerText = 'AGENT ACTIVE';
    riskKpi.className = 'kpi-value safe';
    riskKpi.innerText = 'STRICT ENFORCED';
    addLog('INFO', 'Circuit breaker reset. Agent resumed autonomous monitoring.');
  }
});

document.getElementById('btnClearLogs').addEventListener('click', () => {
  state.logs = [];
  updateUI();
});

// Initial Render
updateUI();
