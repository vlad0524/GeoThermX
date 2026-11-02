/* GeoThermX views: Simulation Lab, Scenario Comparison, Financial Analysis */
(function () {
  'use strict';
  const U = window.GXUI, S = window.GXStore, E = window.GXEngine;
  const GX = window.GX; const esc = U.esc;

  /* ================= SIMULATION LAB ================= */
  const SCN = { standard: ['Standard Operation', 0, 0], winter: ['Extreme Winter Load', -12, 25], cooling: ['Maximum Cooling (Summer)', 8, 20] };
  GX.views['simulation-lab'] = {
    name: 'Simulation Lab', header: { mode: 'step', step: 5, label: 'Simulation Lab' },
    state: { show: { eff: true, load: false, thermal: true }, cursor: null, animate: true },
    render(el) {
      const s = S.cur().sim;
      el.innerHTML = `<div class="sim-grid">
        <div class="card sim-ctl">
          <h3 class="card-title">Simulation Controls</h3>
          <div class="sim-lbl">Scenario Type</div>
          <div class="scn-list">${Object.entries(SCN).map(([k, v]) => `<button data-scn="${k}" class="${s.scenario === k ? 'on' : ''}">${v[0]}</button>`).join('')}</div>
          <div class="sim-lbl" style="margin-top:26px">Input Variables</div>
          ${slider('sim-amb', 'Ambient Temp Shift', -20, 15, 1, s.ambient, v => (v > 0 ? '+' : '') + U.dT(v, 0))}
          ${slider('sim-lv', 'Load Variation', -30, 50, 5, s.loadVar, v => (v > 0 ? '+' : '') + v + '%')}
          ${slider('sim-dem', 'Energy Demand', 0.2, 10, 0.05, s.demand, v => (+v).toFixed(2) + ' GWh')}
          <div class="sim-lbl" style="margin-top:26px">Simulation Range</div>
          <div class="range-seg">${[1, 5, 10].map(y => `<button data-yrs="${y}" class="${s.years === y ? 'on' : ''}">${y}Y</button>`).join('')}</div>
          <button class="btn btn-accent btn-block sim-run" id="sim-run">Run Simulation</button>
        </div>
        <div class="card sim-chart">
          <div class="between"><h3 class="card-title">Thermal Performance Visualization</h3>
            <div class="tabs-dark">${[['eff', 'Efficiency'], ['load', 'Load'], ['thermal', 'Thermal']].map(([k, l]) => `<button data-ser="${k}" class="${this.state.show[k] ? 'on' : ''}" aria-pressed="${this.state.show[k]}">${l}</button>`).join('')}</div></div>
          <div class="sim-plot" id="sim-plot"></div>
          <div class="timeline"><div class="between"><span class="card-title" style="color:var(--ink-3)">Full Lifecycle Timeline</span></div>
            <div class="tl-bar" id="tl-bar"><div class="tl-mark" id="tl-mark"><span id="tl-lbl">Month 1</span></div></div>
            <div class="tl-ticks" id="tl-ticks"></div></div>
        </div>
        <div class="card sim-met" id="sim-met"></div>
      </div>`;
      function slider(id, label, min, max, step, val, f) { return `<div class="sl"><div class="between"><label for="${id}">${label}</label><span class="muted num" id="${id}-v">${f(val)}</span></div><input type="range" class="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}" data-edit></div>`; }
      const fm = { 'sim-amb': ['ambient', v => (v > 0 ? '+' : '') + U.dT(+v, 0)], 'sim-lv': ['loadVar', v => (v > 0 ? '+' : '') + v + '%'], 'sim-dem': ['demand', v => (+v).toFixed(2) + ' GWh'] };
      Object.keys(fm).forEach(id => {
        const inp = U.$('#' + id, el);
        const paintFill = () => { const p = (inp.value - inp.min) / (inp.max - inp.min) * 100; inp.style.background = `linear-gradient(90deg, var(--line) ${p}%, var(--line) ${p}%)`; };
        paintFill();
        inp.addEventListener('input', () => { U.$('#' + id + '-v', el).textContent = fm[id][1](inp.value); S.setSim({ [fm[id][0]]: +inp.value }); this.state.animate = false; this.paint(el); });
      });
      el.querySelectorAll('[data-scn]').forEach(b => b.onclick = () => {
        const v = SCN[b.dataset.scn]; S.setSim({ scenario: b.dataset.scn, ambient: v[1], loadVar: v[2] });
        el.querySelectorAll('[data-scn]').forEach(x => x.classList.toggle('on', x === b));
        U.$('#sim-amb', el).value = v[1]; U.$('#sim-lv', el).value = v[2];
        U.$('#sim-amb-v', el).textContent = fm['sim-amb'][1](v[1]); U.$('#sim-lv-v', el).textContent = fm['sim-lv'][1](v[2]);
        this.state.animate = true; this.state.cursor = null; this.paint(el); U.animateNumbers(el, {});
      });
      el.querySelectorAll('[data-yrs]').forEach(b => b.onclick = () => { S.setSim({ years: +b.dataset.yrs }); el.querySelectorAll('[data-yrs]').forEach(x => x.classList.toggle('on', x === b)); this.state.animate = true; this.state.cursor = null; this.paint(el); U.animateNumbers(el, {}); });
      el.querySelectorAll('[data-ser]').forEach(b => b.onclick = () => { const k = b.dataset.ser; this.state.show[k] = !this.state.show[k]; if (!Object.values(this.state.show).some(Boolean)) this.state.show[k] = true; b.classList.toggle('on', this.state.show[k]); b.setAttribute('aria-pressed', this.state.show[k]); this.state.animate = false; this.paint(el); });
      U.$('#sim-run', el).onclick = () => {
        const btn = U.$('#sim-run', el); btn.innerHTML = '<span class="spin"></span>Simulating…'; btn.disabled = true;
        const plot = U.$('#sim-plot', el); plot.classList.add('busy');
        setTimeout(() => { btn.innerHTML = 'Run Simulation'; btn.disabled = false; plot.classList.remove('busy'); this.state.animate = true; this.state.cursor = null; this.paint(el); U.animateNumbers(el, {}); const sim = this._sim; U.toast(`Simulated ${sim.years * 12} months: avg COP <b>${sim.avgCop.toFixed(2)}</b>, min ${sim.minCop.toFixed(2)}`); S.log(`Simulation run: ${SCN[S.cur().sim.scenario][0]}, ${sim.years}Y`, 'Intelligence', 'Completed'); }, 900);
      };
      // timeline scrub
      const bar = U.$('#tl-bar', el);
      const scrub = e => { const rc = bar.getBoundingClientRect(); const x = U.clamp(((e.touches ? e.touches[0].clientX : e.clientX) - rc.left) / rc.width, 0, 1); this.state.cursor = Math.round(x * (this._sim.months.length - 1)); this.state.animate = false; this.paintCursor(el); };
      let drag = false;
      bar.addEventListener('mousedown', e => { drag = true; scrub(e); });
      window.addEventListener('mousemove', this._mm = e => { if (drag) scrub(e); });
      window.addEventListener('mouseup', this._mu = () => { drag = false; });
      bar.addEventListener('touchstart', scrub, { passive: true }); bar.addEventListener('touchmove', scrub, { passive: true });
      this.paint(el);
    },
    unmount() { window.removeEventListener('mousemove', this._mm); window.removeEventListener('mouseup', this._mu); },
    paint(el) {
      const c = S.cur(), s = c.sim;
      const sim = this._sim = E.simulate(c.project, c.design, S.state.settings, c.mitigation, s);
      const N = sim.months.length;
      const W = 700, H = 600, pt = 30, pb = 30;
      const xs = sim.months.map(i => (N === 1 ? W / 2 : i / (N - 1) * W));
      const norm = (arr, lo, hi) => { const a = Math.min(...arr), b = Math.max(...arr); const pad = (b - a) * 0.6 + 1e-6; return arr.map(v => U.scale(a - pad, b + pad, H - pb - lo, pt + hi)(v)); };
      const yE = norm(sim.cop, 120, 140), yL = norm(sim.load, 80, 160), yT = norm(sim.ground, 100, 120);
      const worst = sim.worstMonth; const bandW = Math.max(14, W / N * 3);
      const anim = this.state.animate;
      const path = (ys, cls, stroke, dash, w) => { const d = U.smooth(xs.map((x, i) => [x, ys[i]])); const len = Math.round(U.pathLen(d)) + 10; return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w || 2.2}" ${dash ? `stroke-dasharray="${dash}"` : ''} class="${anim && !dash ? 'line-anim' : ''}" style="--len:${len}" stroke-linecap="round"/>`; };
      const grid = []; for (let i = 1; i < 6; i++) grid.push(`<line x1="0" x2="${W}" y1="${i * H / 6}" y2="${i * H / 6}" stroke="#eef2f6"/>`);
      U.$('#sim-plot', el).innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="chart" id="sim-svg" style="height:100%">${grid.join('')}
        <rect x="${U.clamp(xs[worst] - bandW / 2, 0, W - bandW)}" y="${H * 0.35}" width="${bandW}" height="${H * 0.36}" fill="#fdecec" opacity=".75"/>
        ${this.state.show.load ? path(yL, '', '#334155', '3 4', 1.4) : ''}
        ${this.state.show.thermal ? path(yT, '', '#64748b', '2 4', 1.3) : ''}
        ${this.state.show.eff ? path(yE, '', '#14b8a6', null, 2.4) : ''}
        <line id="sim-cur" x1="0" x2="0" y1="0" y2="${H}" stroke="#0f172a" stroke-dasharray="3 3" opacity="0"/></svg>
        <div class="sim-stats"><div class="ss"><b class="green">${U.count(sim.maxCop, 'n2', 'sm-pk')}</b><span>Peak COP</span></div><div class="ss"><b class="red">${U.count(sim.minCop, 'n2', 'sm-mn')}</b><span>Min. Efficiency</span></div><div class="ss"><b>${U.count(sim.avgLoad, 'n0', 'sm-al')} kW</b><span>Avg. Load</span></div></div>
        <div class="sim-legend">${this.state.show.eff ? '<span><i style="background:#14b8a6"></i>COP</span>' : ''}${this.state.show.load ? '<span><i class="dash" style="border-color:#334155"></i>Load</span>' : ''}${this.state.show.thermal ? '<span><i class="dash" style="border-color:#64748b"></i>Ground temp</span>' : ''}<span><i style="background:#fdecec"></i>Peak stress</span></div>`;
      U.bindLineHover(U.$('#sim-svg', el), xs, i => `Month ${i + 1} · ${E.MONTHS[i % 12]} Y${Math.floor(i / 12) + 1}`, [
        { name: 'COP', values: sim.cop, fmt: v => v.toFixed(2) }, { name: 'Load', values: sim.load, fmt: v => U.n(v, 0) + ' kW' }, { name: 'Ground', values: sim.ground, fmt: v => U.temp(v) }], { ys: yE });
      // timeline gradient from stress
      const mn = sim.minCop, mx = sim.maxCop; const stops = [];
      const sev = U.clamp(0.55 + sim.overloadProb / 120 + sim.degPerYr / 6 + (sim.imbalanceLabel === 'High' ? 0.2 : sim.imbalanceLabel === 'Moderate' ? 0.1 : 0), 0.4, 1.15);
      const seg = 8; for (let s2 = 0; s2 <= seg; s2++) { const i0 = Math.round(s2 / seg * (N - 1)); const win = sim.cop.slice(Math.max(0, i0 - 6), i0 + 6); const st = 1 - (win.reduce((x, y) => x + y, 0) / win.length - mn) / ((mx - mn) || 1); const age = s2 / seg; const t = U.clamp(Math.pow(age, 1.3) * sev * 0.92 + st * 0.12, 0, 1); stops.push(`${colorAt(t)} ${(age * 100).toFixed(1)}%`); }
      U.$('#tl-bar', el).style.background = `linear-gradient(90deg, ${stops.join(',')})`;
      const tk = s.years === 1 ? [0, 3, 6, 9, 12] : s.years === 5 ? [0, 24, 48, 60] : [0, 30, 60, 90, 120];
      U.$('#tl-ticks', el).innerHTML = tk.map(m => `<span style="left:${m / Math.max(1, N) * 100}%">Month ${m}</span>`).join('');
      if (this.state.cursor == null || this.state.cursor >= N) this.state.cursor = Math.min(N - 1, Math.max(worst, Math.round(N * 0.9)) );
      this.paintCursor(el);
      const hb = sim.worstBorehole;
      U.$('#sim-met', el).innerHTML = `
        <h3 class="card-title">Key Metrics Summary</h3>
        <div class="km"><span>Avg. Efficiency</span><b>${U.count(sim.avgCop, 'n2', 'sm-avg')} COP</b></div>
        <div class="km"><span>Peak Load Capacity</span><b>${U.count(sim.peakCap, 'pct0', 'sm-cap')}</b></div>
        <div class="km"><span>Stability Score</span><b style="color:${sim.stability === 'Excellent' ? 'var(--green)' : sim.stability === 'Good' ? 'var(--teal-600)' : 'var(--amber)'}">${sim.stability}</b></div>
        <h3 class="card-title" style="margin-top:30px">AI Predictive Insights</h3>
        <div class="pi"><div class="pi-t">✦ Thermal Balance</div>System loses ${sim.lossPct.toFixed(0)}% efficiency during ${SCN[s.scenario][0].toLowerCase().replace(' (summer)', '')} simulations due to ${s.scenario === 'cooling' ? 'elevated loop return temperatures' : 'fluid viscosity changes'}.</div>
        <div class="pi"><b>Month ${sim.worstMonth + 1}:</b> Peak load creates the largest temporary thermal imbalance of the year in the borefield core.</div>
        <h3 class="card-title" style="margin-top:30px">Risk Simulation</h3>
        <div class="rs"><div class="between"><span>Overload Probability</span><span>${sim.overloadProb.toFixed(0)}%</span></div><div class="progress"><i style="width:${sim.overloadProb}%"></i></div></div>
        <div class="rs"><div class="between"><span>System Degradation</span><span>${sim.degPerYr.toFixed(1)}% / Year</span></div><div class="progress"><i style="width:${U.clamp(sim.degPerYr * 12, 3, 100)}%"></i></div></div>
        <div class="rs"><div class="between"><span>Thermal Imbalance</span><span>${sim.imbalanceLabel}</span></div><div class="progress"><i style="width:${sim.imbalanceVal * 100}%;background:var(--amber)"></i></div></div>`;
      function colorAt(t) { const a = [237, 253, 249], b = [245, 152, 16], c2 = [239, 73, 65]; const m = (x, y, k) => x.map((v, i) => Math.round(v + (y[i] - v) * k)); const col = t < 0.5 ? m(a, b, t / 0.5) : m(b, c2, (t - 0.5) / 0.5); return `rgb(${col.join(',')})`; }
    },
    paintCursor(el) {
      const sim = this._sim, N = sim.months.length, i = this.state.cursor;
      const x = N === 1 ? 0.5 : i / (N - 1);
      U.$('#tl-mark', el).style.left = x * 100 + '%';
      U.$('#tl-lbl', el).textContent = 'Month ' + (i + 1);
      const cur = U.$('#sim-cur', el); if (cur) { cur.setAttribute('x1', x * 700); cur.setAttribute('x2', x * 700); cur.setAttribute('opacity', '.5'); }
      U.$('#tl-mark', el).title = `COP ${sim.cop[i].toFixed(2)} · Load ${U.n(sim.load[i], 0)} kW · Ground ${sim.ground[i].toFixed(1)}°C`;
    },
    foot: () => `<span class="spacer"></span><button class="btn btn-ghost" data-go="system-design">Back to Layout</button><button class="btn btn-accent" data-go="scenario-comparison">Compare with Scenario B</button><button class="btn btn-dark" id="sim-final">Finalize Simulation</button>`
  };
  document.addEventListener('click', e => {
    if (!e.target.closest('#sim-final')) return;
    const v = GX.views['simulation-lab'], sim = v._sim; if (!sim) return;
    const c = S.cur();
    S.addReport({ id: 'r' + Date.now(), title: `Simulation: ${SCN[c.sim.scenario][0]} (${sim.years}Y)`, date: U.today(), type: 'SIMULATION', snap: { avgCop: sim.avgCop, minCop: sim.minCop, deg: sim.degPerYr, overload: sim.overloadProb } });
    S.log(`Simulation finalized: ${SCN[c.sim.scenario][0]}, ${sim.years}Y`, 'Intelligence', 'Completed');
    U.toast('Simulation finalized and saved to Reports');
  });

  /* ================= SCENARIO COMPARISON ================= */
  GX.views['scenario-comparison'] = {
    name: 'Scenario Comparison', header: { mode: 'step', step: 6, label: 'Scenario Comparison' },
    state: { tab: 'tech', sel: null },
    render(el) { el.innerHTML = `<div class="tabs-outline sc-tabs">${[['global', 'Global View'], ['tech', 'Technical Metrics'], ['fin', 'Financial Forecast']].map(([k, l]) => `<button data-t="${k}" class="${this.state.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div><div id="sc-body"></div>`;
      el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { this.state.tab = b.dataset.t; el.querySelectorAll('[data-t]').forEach(x => x.classList.toggle('on', x === b)); this.paint(el); U.animateNumbers(el, {}); });
      this.paint(el);
    },
    paint(el) {
      const sc = S.scenarios(), list = sc.list, best = sc.best, t = this.state.tab, r0 = S.result();
      const rows = s => {
        const r = s.r, other = list.filter(x => x !== s);
        const isMax = (k, f) => other.every(o => f(r) >= f(o.r)), isMin = f => other.every(o => f(r) <= f(o.r));
        const mark = (cond, up) => cond ? ` <span>${up ? '↑' : '↓'}</span>` : '';
        const green = c => c ? 'green' : '';
        if (t === 'tech') return [
          ['Seasonal COP', `<span class="${green(isMax(0, x => x.SCOP))}">${U.count(r.SCOP, 'n2')}${mark(isMax(0, x => x.SCOP), 1)}</span>`],
          ['Annual Output', `<span class="${green(isMax(0, x => x.annualOutput))}">${U.count(r.annualOutput, 'n0')} MWh${mark(isMax(0, x => x.annualOutput) && other.some(o => o.r.annualOutput < r.annualOutput - 1), 1)}</span>`],
          ['CAPEX Cost', `<span class="${green(isMin(x => x.capex))}">${U.count(r.capex, 'money')}${mark(isMin(x => x.capex), 0)}</span>`],
          ['Payback Period', `<span class="${green(isMin(x => x.paybackYears))}">${U.count(r.paybackYears, 'n1')} Years${mark(isMin(x => x.paybackYears), 0)}</span>`],
          ['Risk Rating', `<span style="color:${s.riskLabel === 'Minimal' || s.riskLabel === 'Low' ? 'var(--green)' : s.riskLabel === 'Moderate' ? 'var(--amber)' : 'var(--red)'}">${s.riskLabel}</span>`]];
        if (t === 'fin') return [
          ['Net CAPEX (after incentives)', U.count(r.netCapex, 'money')], ['Annual Savings', `<span class="green">${U.count(r.annualSavings, 'money')}</span>`],
          ['Net Profit (10Y)', U.count(r.netProfit10, 'money')], ['IRR (20Y)', r.irr != null ? U.count(r.irr * 100, 'pct1') : '—'], ['NPV @ ' + (S.state.settings.discount * 100).toFixed(0) + '%', U.count(r.npv20, 'money')]];
        return [
          ['Configuration', `${s.design.n} × ${U.len(s.design.depth)}`], ['Spacing / Loop Length', `${U.len(s.design.spacing, 1)} · ${U.len(r.L)}`], ['Loop ratio', U.loopRatio(r)], ['CO₂ Avoided', U.count(r.co2Saved, 'n0') + ' t/yr'], ['Overall Score', `<b class="teal6">${U.count(s.score, 'n1')}</b> / 100`]];
      };
      const mini = s => {
        let vals, lbl;
        if (t === 'fin') { vals = [2, 4, 6, 8, 10].map(y => s.r.cum[y]); lbl = y => `Year ${[2, 4, 6, 8, 10][y]}`; }
        else { const sim = E.simulate(S.cur().project, s.design, S.state.settings, S.cur().mitigation, { years: 5 }); vals = [0, 1, 2, 3, 4].map(y => sim.cop.slice(y * 12, y * 12 + 12).reduce((a, b) => a + b, 0) / 12 * (t === 'global' ? 1 : s.r.coverage)); lbl = y => `Year ${y + 1}`; }
        const mx = Math.max(...vals.map(Math.abs)) || 1;
        const lo = t === 'fin' ? 0 : Math.min(...vals) * 0.8;
        return `<div class="mini-bars ${s.best ? 'best' : ''}">${vals.map((v, i) => { const h = t === 'fin' ? Math.abs(v) / mx * 100 : (v - lo) / ((mx - lo) || 1) * 100; return `<i class="bar-anim ${v < 0 ? 'neg' : ''}" style="height:${U.clamp(h, 8, 100)}%;animation-delay:${i * 50}ms" data-tip="${lbl(i)}: <b>${t === 'fin' ? U.money(v) : 'COP ' + v.toFixed(2)}</b>"></i>`; }).join('')}</div>`;
      };
      const isCurrent = s => s.design.n === S.cur().design.n && s.design.depth === S.cur().design.depth && Math.abs(s.design.spacing - S.cur().design.spacing) < 0.05;
      const others = list.filter(x => x !== best);
      const capexDelta = (best.r.capex / list[0].r.capex - 1) * 100;
      const breakM = Math.round(Math.max(1, (best.r.capex - list[0].r.capex) / Math.max(1, (best.r.annualSavings - list[0].r.annualSavings) / 12)));
      U.$('#sc-body', el).innerHTML = `
        <div class="sc-cards stagger">${list.map(s => `<div class="card sc-card ${s.best ? 'best' : ''}" data-sc="${s.id}">${s.best ? '<span class="sc-badge">Best ROI &amp; Stability</span>' : ''}
          <div class="between"><h3>${s.name}</h3>${isCurrent(s) ? '<span class="pill teal">Current</span>' : ''}</div>
          <div class="sc-rows">${rows(s).map(([k, v]) => `<div class="kv"><span class="k muted">${k}</span><span class="v">${v}</span></div>`).join('')}</div>
          <div class="sc-foot">${mini(s)}<button class="btn btn-sm ${s.best ? 'btn-accent' : 'btn-ghost'} sc-apply" data-apply="${s.id}" data-edit>${isCurrent(s) ? 'Applied' : 'Apply to Design'}</button></div></div>`).join('')}</div>
        <div class="dark-card sc-rec">
          <div><div class="sc-rec-t">Recommended: ${best.name}</div>
          <p>Based on ${S.cur().sim.years}-year simulation data, Scenario ${String.fromCharCode(65 + list.indexOf(best))} provides the most stable thermal exchange with the ${best.r.risk.score <= Math.min(...others.map(o => o.r.risk.score)) ? 'lowest' : 'a low'} degradation risk. ${capexDelta > 0 ? `The ${capexDelta.toFixed(0)}% increase in CAPEX is offset by energy savings within the first ${breakM} months.` : `It also costs ${Math.abs(capexDelta).toFixed(0)}% less CAPEX than the standard design.`}</p>
          <div class="chips"><span>✦ ${best.r.SCOP.toFixed(2)} Seasonal COP</span><span>✦ Optimized spacing ${U.len(best.design.spacing, 1)}</span><span>✦ ${best.r.ratio >= 1 ? 'Future-Proof Load Ready' : 'Capacity margin ' + ((best.r.ratio - 1) * 100).toFixed(0) + '%'}</span></div></div>
          <div class="trust"><span>Recommendation confidence</span><b style="font-size:28px">${sc.trust > 93 ? 'High' : sc.trust > 87 ? 'Medium' : 'Low'}</b><span style="text-transform:none;margin-top:4px">score lead ${(best.score - Math.max(...others.map(o => o.score))).toFixed(1)} pts</span></div></div>`;
      el.querySelectorAll('[data-apply]').forEach(b => b.onclick = ev => {
        ev.stopPropagation(); if (!GX.guard()) return; const s = list.find(x => x.id === b.dataset.apply);
        if (S.cur().locked) { U.toast('System Design is locked. Unlock it to apply a scenario.', 'warn'); return; }
        S.setDesign({ n: s.design.n, depth: s.design.depth, spacing: s.design.spacing, flow: s.design.flow }); S.log(`Applied scenario: ${s.name}`, 'Config', 'Success');
        U.toast(`<b>${s.name}</b> applied to System Design`);
      });
    },
    foot: () => `<span class="spacer"></span><button class="btn btn-ghost" data-go="simulation-lab">Back to Simulation</button><button class="btn btn-ghost" id="sc-export">Export Comparison Report</button><button class="btn btn-accent" data-go="financial-analysis">Proceed to Financial Analysis</button>`
  };
  document.addEventListener('click', e => {
    if (!e.target.closest('#sc-export')) return;
    const sc = S.scenarios();
    const rows = [['Metric', ...sc.list.map(s => s.name)], ['Boreholes', ...sc.list.map(s => s.design.n)], ['Depth (m)', ...sc.list.map(s => s.design.depth)], ['Spacing (m)', ...sc.list.map(s => s.design.spacing)], ['Efficiency score (%)', ...sc.list.map(s => s.r.effScore.toFixed(1))], ['Seasonal COP', ...sc.list.map(s => s.r.SCOP.toFixed(2))], ['Annual output (MWh)', ...sc.list.map(s => s.r.annualOutput.toFixed(0))], ['CAPEX (USD)', ...sc.list.map(s => Math.round(s.r.capex))], ['Annual savings (USD)', ...sc.list.map(s => Math.round(s.r.annualSavings))], ['Payback (years)', ...sc.list.map(s => s.r.paybackYears.toFixed(1))], ['Risk', ...sc.list.map(s => s.riskLabel)], ['Recommended', ...sc.list.map(s => s.best ? 'YES' : '')]];
    U.exportData('Scenario comparison', `${S.cur().project.ref}-scenarios.csv`, U.csv(rows), 'text/csv'); S.log('Exported scenario comparison', 'Config', 'Success');
  });

  /* ================= FINANCIAL ANALYSIS ================= */
  GX.views['financial-analysis'] = {
    name: 'Financial Analysis', header: { mode: 'title', title: () => GX.shortName() + ' — Financial Intelligence' },
    render(el) { el.innerHTML = '<div id="fin"></div>'; this.paint(el); },
    paint(el) {
      const r = S.result(), st = S.state.settings;
      const noItc = GX.whatIf(null, null, { includeItc: false });
      const itcMonths = Math.max(0, Math.round((noItc.paybackYears - r.paybackYears) * 12));
      let roi100 = null; for (let y = 1; y <= 25; y++) { if (r.cum[y] >= r.netCapex) { const prev = r.cum[y - 1]; roi100 = y - 1 + (r.netCapex - prev) / (r.cum[y] - prev); break; } }
      const viability = r.irr != null && r.irr > 0.12 && r.paybackYears < 8 ? 'High Viability' : r.paybackYears < 12 ? 'Moderate Viability' : 'Low Viability';
      const target = 7.0;
      const W = 760, H = 330, pl = 42, pr = 14, pt = 16, pb = 34;
      const yrs = [...Array(11).keys()];
      const cumSav = yrs.map(y => y === 0 ? 0 : r.cum[y] + r.netCapex);
      const ymax = Math.max(r.netCapex * 1.15, cumSav[10] * 1.05);
      const X = U.scale(0, 10, pl, W - pr), Y = U.scale(0, ymax, H - pb, pt);
      const pts = yrs.map(y => [X(y), Y(cumSav[y])]);
      const d = U.linePath(pts); const len = Math.round(U.pathLen(d)) + 10;
      const be = Math.min(10, r.paybackYears);
      const bx = X(be), by = Y(r.netCapex);
      const areaStart = Math.min(10, be);
      const ap = pts.filter((p, i) => i >= Math.floor(areaStart));
      const area = `M${bx},${H - pb} L${bx},${by} ` + ap.filter(p => p[0] > bx).map(p => `L${p[0]},${p[1]}`).join(' ') + ` L${X(10)},${H - pb} Z`;
      const ticks = [0, 2.5, 5, 7.5, 10];
      const gl = [0.25, 0.5, 0.75, 1].map(f => ymax * f);
      el.querySelector('#fin').innerHTML = `
      <div class="fin-kpis stagger">
        <div class="card kpi-sm"><div class="lbl">Total Investment ${GX.info('capex')}</div><div class="val">${U.count(r.capex, 'money', 'f-cap')}</div><div class="sub" style="color:var(--ink)">CAPEX (Current)</div></div>
        <div class="card kpi-sm"><div class="lbl">Annual Savings ${GX.info('savings')}</div><div class="val">${U.count(r.annualSavings, 'money', 'f-sav')}</div><div class="sub green">↑ ${(r.annualSavings / r.baselineCost * 100).toFixed(1)}% vs HVAC</div></div>
        <div class="card kpi-sm"><div class="lbl">Net Profit (10Y)</div><div class="val">${U.count(r.netProfit10, 'money', 'f-np')}</div><div class="sub ${r.netProfit10 > 0 ? 'green' : 'red'}">${r.netProfit10 > 0 ? '↑ High Confidence' : '↓ Below break-even'}</div></div>
        <div class="card kpi-sm"><div class="lbl">Payback Period ${GX.info('payback')}</div><div class="val">${U.count(r.paybackYears, 'n1', 'f-pb')} Years</div><div class="sub ${r.paybackYears <= target ? 'green' : 'amber'}">Target: ${target.toFixed(1)}y</div></div>
        <div class="card kpi-sm"><div class="lbl">ROI (10 Years)</div><div class="val">${U.count(r.roi10, 'pct0', 'f-roi')}</div><div class="sub muted">Payback range ${r.paybackLow.toFixed(1)}–${r.paybackHigh.toFixed(1)} y</div></div>
        <div class="card kpi-sm"><div class="lbl">Tax Credits &amp; Grants</div><div class="val">${U.count(r.incentives, 'money', 'f-inc')}</div><div class="sub" style="color:var(--ink)">Federal + Local</div></div>
      </div>
      <div class="fin-grid">
        <div class="fin-l">
          <div class="card pad fin-chart">
            <div class="between"><h3 class="card-title">Cumulative ROI Projection (10 Year Lifecycle)</h3><div class="row" style="gap:16px;font-size:12px"><span class="row" style="gap:6px;color:var(--red)"><span class="dot" style="background:var(--red)"></span>Net Investment</span><span class="row" style="gap:6px;color:var(--teal-500)"><span class="dot" style="background:var(--teal-500)"></span>Cumulative Savings</span><button class="link-btn" id="fin-assump">Assumptions</button></div></div>
            <svg viewBox="0 0 ${W} ${H}" class="chart" id="fin-svg" style="margin-top:12px">
              ${gl.map(v => `<line x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}" stroke="#f1f5f9"/><text x="${pl - 8}" y="${Y(v) + 3}" text-anchor="end">${U.moneyK(v)}</text>`).join('')}
              <line x1="${pl}" x2="${pl}" y1="${pt}" y2="${H - pb}" stroke="#e2e8f0"/><line x1="${pl}" x2="${W - pr}" y1="${H - pb}" y2="${H - pb}" stroke="#e2e8f0"/>
              ${r.paybackYears <= 10 ? `<path d="${area}" fill="#14b8a6" opacity=".07"/>` : ''}
              <line x1="${pl}" x2="${W - pr}" y1="${by}" y2="${by}" stroke="#ef4444" stroke-opacity=".55" stroke-width="1"/>
              <path d="${d}" fill="none" stroke="#14b8a6" stroke-width="3" stroke-linejoin="round" class="line-anim" style="--len:${len}"/>
              ${r.paybackYears <= 10 ? `<circle cx="${bx}" cy="${by}" r="7" fill="#fff" stroke="#14b8a6" stroke-width="2" class="pop-in"/><circle cx="${bx}" cy="${by}" r="3" fill="#14b8a6"/><text x="${bx - 12}" y="${by - 14}" text-anchor="end" style="fill:#14b8a6;font-weight:700;font-size:12px">BREAK-EVEN: ${r.paybackYears.toFixed(1)}Y</text>` : `<text x="${W - pr}" y="${by - 8}" text-anchor="end" style="fill:#ef4444;font-weight:600">Break-even after year 10 (${r.paybackYears.toFixed(1)}y)</text>`}
              ${ticks.map(tk => `<text x="${X(tk)}" y="${H - 12}" text-anchor="middle">Year ${tk}</text>`).join('')}
            </svg>
          </div>
          <div class="dark-card inv-sum">
            <div class="inv-t">Investment Summary: ${viability}</div>
            <p>The current configuration delivers an internal rate of return (IRR) of ${r.irr != null ? (r.irr * 100).toFixed(1) + '%' : 'n/a'} over 20 years. Total 10-year savings ${r.sav10 > r.netCapex ? `outweigh the net investment by ${((r.sav10 / r.netCapex - 1) * 100).toFixed(0)}%` : `recover ${(r.sav10 / r.netCapex * 100).toFixed(0)}% of the net investment`}, making this a ${r.sav10 > r.netCapex ? 'primary asset for operational cost reduction' : 'long-horizon asset'}.</p>
            <div class="row" style="gap:16px;margin-top:22px;flex-wrap:wrap"><button class="btn btn-ghost inv-b1" id="fin-pdf">Generate PDF Report</button><button class="btn btn-accent inv-b2" id="fin-deploy">Proceed to Deployment</button></div>
          </div>
        </div>
        <div class="fin-r">
          <div class="card pad"><h3 class="card-title">Cost Structure</h3><div class="cs">
            <div class="between"><span>Drilling &amp; Loop</span><b>${U.money(r.drilling)}</b></div><div class="between"><span>Heat Pump Units</span><b>${U.money(r.equipment)}</b></div><div class="between"><span>System Integration</span><b>${U.money(r.integration)}</b></div>
            <div class="between cs-tot"><span>Total CAPEX</span><b>${U.money(r.capex)}</b></div></div></div>
          <div class="card pad"><h3 class="card-title">Financial Insights</h3><div class="fi">
            <div class="insight bar">✦ ${roi100 ? `System achieves 100% ROI in Year ${roi100.toFixed(1)}.` : 'System does not reach 100% ROI within 25 years.'} Post-payback annual cash flow is projected at ${U.money(r.annualSavings)}.</div>
            <div class="insight bar">✦ Operating energy costs are ${((1 - r.gshpCost / r.baselineCost) * 100).toFixed(0)}% lower than traditional gas/electric HVAC over a 10-year span.</div>
            <div class="insight bar">✦ ${st.includeItc ? `Federal tax credits cover ${(st.itc * 100).toFixed(0)}% of initial installation costs, reducing break-even by ${itcMonths} months.` : `Enabling the ${(st.itc * 100).toFixed(0)}% federal tax credit would cut break-even by ${Math.max(0, Math.round((r.paybackYears - GX.whatIf(null, null, { includeItc: true }).paybackYears) * 12))} months.`}</div></div></div>
          <div class="card pad"><h3 class="card-title">Incentives &amp; Credits</h3><div class="inc">
            ${[['includeItc', `Federal Tax Credit (${(st.itc * 100).toFixed(0)}%)`, r.inputs.s.itc * r.capex], ['includeGrant', 'Energy Efficiency Grant', st.grant], ['includeRebate', 'Local Utility Rebate', st.utilityRebate], ['includeCarbon', 'Carbon Offset Credit', Math.round(r.co2Saved * st.carbonPrice)]].map(([k, l, v]) => `<button class="inc-row ${st[k] ? '' : 'off'}" data-inc="${k}" data-edit title="Click to ${st[k] ? 'exclude' : 'include'}"><span>${l}</span><b>${st[k] ? '+' : ''}${U.money(v)}</b></button>`).join('')}</div></div>
        </div>
      </div>`;
      const svg = U.$('#fin-svg', el);
      U.bindLineHover(svg, yrs.map(X), i => `Year ${i}`, [{ name: 'Cumulative savings', values: cumSav, fmt: v => U.money(v) }, { name: 'Net position', values: yrs.map(y => r.cum[y]), fmt: v => U.money(v) }], { ys: pts.map(p => p[1]), top: pt, bottom: pb });
      el.querySelectorAll('[data-inc]').forEach(b => b.onclick = () => { if (!GX.guard()) return; const k = b.dataset.inc; S.setSettings({ [k]: !S.state.settings[k] }); S.log(`Incentive ${k} ${S.state.settings[k] ? 'included' : 'excluded'}`, 'Config'); });
      U.$('#fin-assump', el).onclick = () => GX.assumptions();
      U.$('#fin-pdf', el).onclick = () => { GX.views.reports.create('Financial Investment Report', 'FINANCIAL'); GX.go('reports'); };
      U.$('#fin-deploy', el).onclick = () => { S.log('Project moved to deployment & live monitoring', 'System', 'Success'); U.toast('Deployment started. Live monitoring is now active.'); GX.go('monitoring'); };
    }
  };

  GX.assumptions = () => {
    const s = S.state.settings;
    const f = (id, l, v, step, suf) => `<div class="field"><label for="${id}">${l}${suf ? ` <span class="muted" style="font-weight:400">(${suf})</span>` : ''}</label><input class="input num" id="${id}" type="number" step="${step}" value="${v}"></div>`;
    U.modal({ title: 'Financial assumptions', body: `<div class="grid r-2" style="grid-template-columns:1fr 1fr;gap:12px">
      ${f('as-elec', 'Electricity price', s.elec, 0.01, '$/kWh')}${f('as-gas', 'Natural gas price', s.gas, 0.005, '$/kWh fuel')}
      ${f('as-esc', 'Energy price escalation', (s.escalation * 100).toFixed(1), 0.1, '%/yr')}${f('as-disc', 'Discount rate', (s.discount * 100).toFixed(1), 0.1, '%')}
      ${f('as-itc', 'Federal tax credit', (s.itc * 100).toFixed(0), 1, '% of CAPEX')}${f('as-maint', 'Maintenance savings', s.maintSave, 500, '$/yr')}
      ${f('as-drill', 'Drilling cost multiplier', s.drillMult, 0.05, '× regional rate')}${f('as-eq', 'Heat pump equipment', s.equipRate, 5, '$/kW')}</div>
      <div class="muted" style="font-size:12.5px">Incentive eligibility and rates change; confirm the current federal and local programs for your project before relying on these values.</div>`,
      actions: [{ label: 'Reset defaults', kind: 'ghost', onClick: () => { if (!GX.guard()) return false; const D = E.DEFAULT_SETTINGS; S.setSettings({ elec: D.elec, gas: D.gas, escalation: D.escalation, discount: D.discount, itc: D.itc, maintSave: D.maintSave, drillMult: D.drillMult, equipRate: D.equipRate }); U.toast('Assumptions reset'); } },
        { label: 'Apply', kind: 'primary', onClick: m => { if (!GX.guard()) return false; const g = id => parseFloat(U.$('#' + id, m).value);
          S.setSettings({ elec: U.clamp(g('as-elec'), 0.01, 1), gas: U.clamp(g('as-gas'), 0.005, 0.5), escalation: U.clamp(g('as-esc') / 100, -0.05, 0.15), discount: U.clamp(g('as-disc') / 100, 0, 0.3), itc: U.clamp(g('as-itc') / 100, 0, 0.6), maintSave: U.clamp(g('as-maint'), 0, 1e6), drillMult: U.clamp(g('as-drill'), 0.3, 3), equipRate: U.clamp(g('as-eq'), 50, 2000) });
          S.log('Financial assumptions updated', 'Config'); U.toast('Assumptions applied. All modules recalculated.'); } }] });
  };
})();
