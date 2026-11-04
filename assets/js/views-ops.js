/* GeoThermX views: Operation (measured data), Alerts, Risks */
(function () {
  'use strict';
  const U = window.GXUI, S = window.GXStore, E = window.GXEngine, A = window.GXAlerts;
  const GX = window.GX; const esc = U.esc;

  /* ================= OPERATION (measured monthly data, same path for every project) ================= */
  GX.views.monitoring = {
    name: 'Operation', header: { mode: 'title', title: () => GX.shortName() + ' — Operation' },
    render(el) { el.innerHTML = '<div id="mon"></div>'; this.paint(el); },
    paint(el) { return GX.opsData.paint(el); },
    foot: () => `<span class="spacer"></span><button class="btn btn-ghost" id="op-add" data-edit>Add month</button><button class="btn btn-ghost" id="op-up" data-edit>Upload CSV</button>${(S.cur().ops.rows || []).length ? '<button class="btn btn-ghost" id="op-exp">Export data</button><button class="btn btn-accent" id="mon-report">Generate Performance Report</button>' : '<button class="btn btn-ghost" id="op-tpl">CSV template</button>'}`
  };
  document.addEventListener('click', e => {
    if (e.target.closest('#mon-report')) { GX.views.reports.create('Operational Performance Report', 'MONITORING'); GX.go('reports'); }
    if (e.target.closest('#mon-adjust')) {
      if (!GX.guard()) return;
      const c = S.cur(), m = c.mitigation;
      U.modal({ title: 'Adjust system settings', body: `
        <div class="field"><label for="ad-flow">Circulation flow per loop: <b id="ad-flow-v">${U.flow(c.design.flow)}</b></label><input type="range" class="range" id="ad-flow" min="0.3" max="1.6" step="0.05" value="${c.design.flow}"></div>
        <div class="between"><div><b style="font-size:13.5px">Load rebalancing</b><div class="muted" style="font-size:12.5px">Even out seasonal heat flows across the borefield.</div></div><button class="toggle ${m.rebalance ? 'on' : ''}" id="ad-reb" aria-label="Load rebalancing"></button></div>
        <div class="between"><div><b style="font-size:13.5px">Off-peak pump trim</b><div class="muted" style="font-size:12.5px">Cap flow at ${U.flow(0.95)} per loop outside peak hours.</div></div><button class="toggle ${m.flowOpt ? 'on' : ''}" id="ad-trim" aria-label="Off-peak pump trim"></button></div>
        <div class="between"><div><b style="font-size:13.5px">Raise return flow temperature +${U.dT(2, 0)}</b><div class="muted" style="font-size:12.5px">Reduces heat rejection stress in cooling season.</div></div><button class="toggle ${m.returnTemp ? 'on' : ''}" id="ad-ret" aria-label="Raise return temperature"></button></div>
        <div class="insight" id="ad-prev"></div>`,
        onMount: (s) => {
          const st = { flow: c.design.flow, reb: m.rebalance, trim: m.flowOpt, ret: !!m.returnTemp };
          const prev = () => { const w = GX.whatIf({ flow: st.flow }, { rebalance: st.reb, flowOpt: st.trim, returnTemp: st.ret ? 2 : 0 }); const r = S.result(); U.$('#ad-prev', s).innerHTML = `Preview: COP <b>${w.SCOP.toFixed(2)}</b> (${U.signed((w.SCOP / r.SCOP - 1) * 100, 1, '%')}) · savings <b>${U.money(w.annualSavings)}</b>/yr · risk <b>${w.risk.score}</b>`; };
          U.$('#ad-flow', s).oninput = e => { st.flow = +e.target.value; U.$('#ad-flow-v', s).textContent = U.flow(st.flow); prev(); };
          [['#ad-reb', 'reb'], ['#ad-trim', 'trim'], ['#ad-ret', 'ret']].forEach(([id, k]) => { U.$(id, s).onclick = ev => { st[k] = !st[k]; ev.currentTarget.classList.toggle('on', st[k]); prev(); }; });
          prev(); s._st = st;
        },
        actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Apply to system', kind: 'accent', onClick: s => { const st = s._st; S.setMitigation({ rebalance: st.reb, flowOpt: st.trim, returnTemp: st.ret ? 2 : 0 }); if (st.flow !== c.design.flow) S.setDesign({ flow: st.flow }, 'ops'); S.log(`Operator settings: flow ${U.flow(st.flow)}, rebalance ${st.reb ? 'on' : 'off'}, trim ${st.trim ? 'on' : 'off'}`, 'Config', 'Modified'); U.toast('System settings applied'); } }]
      });
    }
  });

  /* ================= ALERTS & ISSUES ================= */
  GX.views.alerts = {
    name: 'Alerts', header: { mode: 'title', title: () => GX.shortName() + ' — Alerts Center', demo: true },
    state: { sel: null, filter: 'all' },
    render(el) { el.innerHTML = '<div id="al"></div>'; this.paint(el); },
    mount(el) { this.clk = setInterval(() => { const x = U.$('#scan-clock'); if (x) x.textContent = U.time(); }, 1000); },
    unmount() { clearInterval(this.clk); },
    paint(el) {
      const list = A.list(), cnt = A.counts(), f = this.state.filter;
      const shown = list.filter(a => f === 'all' ? true : f === 'critical' ? a.sev === 'critical' && a.status !== 'resolved' : f === 'warnings' ? a.sev === 'warning' && a.status !== 'resolved' : f === 'active' ? a.status !== 'resolved' && a.sev !== 'info' && a.sev !== 'scheduled' : a.status === 'resolved');
      if (!list.length) { U.$('#al', el).innerHTML = `<div class="card empty-state"><div class="es-ico">✓</div><h2>No open alerts</h2><p class="muted">${(S.cur().ops.rows || []).length ? 'Measured performance in the latest months is within 10% of the design model.' : 'Alerts are generated from your monthly operating data. Upload data in Monitoring to start tracking deviations.'}</p><div class="row" style="justify-content:center"><button class="btn btn-accent" data-go="monitoring">Open Monitoring</button></div></div>`; return; }
      if (!this.state.sel || !list.find(a => a.id === this.state.sel)) this.state.sel = (list.find(a => a.status !== 'resolved' && a.sev === 'critical') || list[0]).id;
      const sel = list.find(a => a.id === this.state.sel);
      const pill = a => { const m = { investigating: ['red', 'Investigating'], active: [a.sev === 'critical' ? 'red' : 'amber', 'Active'], resolved: ['green', 'Resolved'], info: ['gray', 'Info'], scheduled: ['gray', 'Scheduled'], assigned: ['blue', 'Assigned'] }[a.status] || ['gray', a.status]; return `<span class="pill ${m[0]}">${m[1]}</span>`; };
      const border = a => a.sev === 'critical' ? 'var(--red)' : a.sev === 'warning' ? 'var(--amber)' : 'var(--blue)';
      U.$('#al', el).innerHTML = `
        <div class="al-kpis">
          ${([['critical', 'Critical', cnt.critical, 'red', '', 'red'], ['warnings', 'Warnings', cnt.warnings, 'amber', '', 'muted'], ['active', 'Open', cnt.active, '', '', 'green'], ['resolved', 'Resolved', cnt.resolved, 'green', '', 'green']]).map(([k, l, v, c, sub, sc]) => `<button class="card kpi-sm al-k ${f === k ? 'on' : ''}" data-f="${k}"><div class="lbl">${l}</div><div class="val num"><span class="${c}" style="font-size:30px">${String(v).padStart(2, '0')}</span> <small class="${sc}" style="font-size:15px">${sub}</small></div></button>`).join('')}
        </div>
        <div class="al-grid">
          <div class="al-list">${f !== 'all' ? `<div class="between" style="margin-bottom:-4px"><span class="muted" style="font-size:13px">Filtered: ${f} (${shown.length})</span><button class="link-btn" data-f="all">Show all</button></div>` : ''}
            ${shown.map(a => `<button class="al-item ${a.id === sel.id ? 'sel' : ''}" data-id="${a.id}" style="--bc:${border(a)}"><div class="between" style="align-items:flex-start"><div><b>${esc(a.title)}</b><p>${esc(a.desc)}</p></div>${pill(a)}</div><div class="al-meta"><span>Time: ${a.time}</span><span>${a.areaLabel || 'Area'}: ${esc(a.area)}</span>${a.code ? `<span>ID: ${a.code}</span>` : ''}</div></button>`).join('') || '<div class="empty-ok">No alerts in this filter.</div>'}
          </div>
          <div class="card al-detail">
            <div class="ald-b">
              <h2>${esc(sel.detailTitle)}</h2><p class="muted">${esc(sel.detail)}</p>
              <div class="grid" style="grid-template-columns:1fr 1fr;gap:16px;margin-top:18px">
                <div class="mini-box"><div class="v ${sel.impact < 0 ? 'red' : 'green'}">${sel.impact < 0 ? sel.impact : '0.0'}%</div><div class="l up">Efficiency Impact</div></div>
                <div class="mini-box"><div class="v" style="color:${sel.risk === 'High' ? 'var(--amber)' : sel.risk === 'Medium' ? 'var(--amber)' : 'var(--green)'}">${sel.risk}</div><div class="l up">System Risk</div></div></div>
              <h3 class="card-title" style="margin-top:26px">Root Cause Analysis</h3>
              <div class="insight rc">${esc(sel.cause)}</div>
              <h3 class="card-title" style="margin-top:26px">Recommended Actions</h3>
              <div class="acts">${sel.actions.map((t, i) => `<button class="act ${(sel.done || []).includes(i) ? 'done' : ''}" data-act="${i}"><span class="n">${(sel.done || []).includes(i) ? '✓' : i + 1}</span>${esc(t)}</button>`).join('')}</div>
            </div>
            <div class="ald-f"><button class="btn btn-ghost" id="al-assign" data-edit ${sel.status === 'resolved' ? 'disabled' : ''}>${sel.status === 'assigned' ? 'Assigned ✓' : 'Assign to Maintenance'}</button><button class="btn btn-accent" id="al-fix" data-edit ${sel.status === 'resolved' || !sel.fix ? 'disabled' : ''}>${sel.status === 'resolved' ? 'Resolved ✓' : 'Apply Recommended Settings'}</button></div>
          </div>
        </div>`;
      el.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { this.state.filter = this.state.filter === b.dataset.f ? 'all' : b.dataset.f; this.paint(el); });
      el.querySelectorAll('[data-id]').forEach(b => b.onclick = () => { this.state.sel = b.dataset.id; this.paint(el); });
      el.querySelectorAll('[data-act]').forEach(b => b.onclick = () => { const i = +b.dataset.act; sel.done = sel.done || []; const k = sel.done.indexOf(i); if (k >= 0) sel.done.splice(k, 1); else sel.done.push(i); S.persist(); this.paint(el); });
      U.$('#al-assign', el).onclick = () => { if (!GX.guard()) return; A.setStatus(sel.id, 'assigned'); S.log(`Assigned to maintenance: ${sel.title}`, 'System', 'Active'); U.toast('Work order created for the maintenance team'); this.paint(el); };
      U.$('#al-fix', el).onclick = () => {
        if (!GX.guard()) return; const btn = U.$('#al-fix', el); btn.innerHTML = '<span class="spin"></span>Applying…'; btn.disabled = true;
        const before = S.result(); setTimeout(() => { A.applyFix(sel.id); const after = S.result(); U.toast(`Recommended settings applied. COP ${before.SCOP.toFixed(2)} → <b>${after.SCOP.toFixed(2)}</b>, risk ${before.risk.score} → <b>${after.risk.score}</b>`); }, 900);
      };
    },
    foot: () => { const c = A.counts(); return `<span class="row" style="gap:28px;font-size:14px;font-weight:500;color:var(--ink-3);flex-wrap:wrap"><span class="row" style="gap:8px"><span class="dot" style="background:var(--red)"></span>${c.critical} critical</span><span class="row" style="gap:8px"><span class="dot" style="background:var(--amber)"></span>${c.warnings} warnings</span></span><span class="spacer"></span><button class="btn btn-ghost" data-go="monitoring">Operating data</button>`; return `<span class="row" style="gap:28px;font-size:14px;font-weight:500;color:var(--ink-3);flex-wrap:wrap"><span class="row" style="gap:8px"><span class="dot" style="background:var(--red)"></span>${c.critical} Critical Active</span><span class="row" style="gap:8px"><span class="dot" style="background:var(--amber)"></span>${c.warnings} Warnings Pending</span><span class="row" style="gap:8px"><span class="dot" style="background:var(--green)"></span>${c.resolved} Resolved Today</span></span><span class="spacer"></span><span class="note">Last System Scan: <span id="scan-clock" class="num">${U.time()}</span> (Live)</span>`; }
  };

  /* ================= RISK ENGINE ================= */
  GX.views['risk-engine'] = {
    name: 'Risks', header: { mode: 'title', title: () => GX.shortName() + ' — Predictive Risk Center' },
    render(el) { el.innerHTML = '<div id="rk"></div>'; this.paint(el); },
    model() {
      const r = S.result(), P = r.risk.parts, c = S.cur(), m = c.mitigation;
      const risks = [
        { name: 'Thermal Overload', prob: U.clamp(28 + P.overload * 45 + P.imbalance * 32, 3, 97), hz: P.overload > 0.5 ? '3–6 mo' : '9–12 mo' },
        { name: 'Subsurface Saturation', prob: U.clamp(10 + P.saturation * 64, 3, 95), hz: Math.max(6, Math.round(14 - P.saturation * 6)) + ' mo' },
        { name: 'Pump Cavitation Trend', prob: U.clamp(P.cavitation * 62, 2, 95), hz: P.cavitation > 0.4 ? '8 wk' : '6 mo' },
        { name: 'Freeze Protection', prob: U.clamp(P.freeze * 80, 1, 95), hz: 'Winter' },
        { name: 'Drilling Deviation', prob: U.clamp(P.drilling * 70, 1, 95), hz: 'Drilling' }
      ].sort((a, b) => b.prob - a.prob).slice(0, 3);
      const cop12 = r.SCOP * (1 - 0.12 * P.imbalance - 0.1 * P.saturation - 0.05 * P.overload);
      const mitigated = GX.whatIf(null, { rebalance: true, returnTemp: 2, flowOpt: true });
      const opexSave = Math.max(0, mitigated.annualSavings - r.annualSavings) + (r.SCOP - cop12) / r.SCOP * r.gshpCost * 0.5;
      const spaced = GX.whatIf({ spacing: Math.min(9, c.design.spacing + 1.5) }, { rebalance: true });
      const riskCut = U.clamp((r.risk.score - spaced.risk.score) / Math.max(1, r.risk.score - 5) * 100, 5, 95);
      const applied = m.rebalance && m.returnTemp && m.flowOpt;
      return { r, P, risks, cop12, mitigated, opexSave, riskCut, applied };
    },
    paint(el) {
      const k = this._k = this.model(), r = k.r, sc = r.risk.score;
      const col = sc < 40 ? 'var(--green)' : sc < 72 ? 'var(--amber)' : 'var(--red)';
      const pillC = sc < 40 ? 'green' : sc < 72 ? 'amber' : 'red';
      const circ = 2 * Math.PI * 34;
      const cooling = S.cur().project.coolDemand > S.cur().project.heatDemand;
      const thr = 85; const qtr = (() => { const months = Math.max(2, Math.round(12 * (1 - k.P.imbalance) + 3)); const d = new Date(); d.setMonth(d.getMonth() + months); return 'Q' + (Math.floor(d.getMonth() / 3) + 1) + ' ' + d.getFullYear(); })();
      const steps = [
        ['Optimization Peak', 'Now', `System at max COP (${r.SCOP.toFixed(1)}). ${k.P.imbalance > 0.3 ? 'Early thermal accumulation detected.' : 'Thermal field stable.'}`, false],
        ['Efficiency Drift', '3 Months', `Borehole delta-T variance increases. ROI begins ${k.P.effDrop > 0.4 ? 'measurable' : 'marginal'} drift.`, false],
        ['Thermal Imbalance', '6 Months', `Ground saturation risk around the borefield becomes ${k.P.imbalance > 0.5 ? 'critical. Auto-throttling likely.' : 'elevated.'}`, k.P.imbalance > 0.5],
        ['Full Saturation', '12 Months', `System COP drops to ${k.cop12.toFixed(1)}. ${k.P.saturation > 0.4 ? 'Permanent heat plume detected.' : 'Recovery possible with rebalancing.'}`, false]];
      const actions = [];
      if (k.P.imbalance > 0.3) actions.push('Rebalance heating/cooling load across the borefield');
      actions.push('Adjust return flow temp +' + U.dT(2, 0));
      if (k.P.cavitation > 0.3) actions.push('Trim pump flow to ' + U.flow(0.95) + ' per loop off-peak'); else actions.push('Verify loop flow balance across all boreholes');
      U.$('#rk', el).innerHTML = `
        <div class="card rk-agg">
          <div class="ring"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" fill="none" stroke="#f1f5f9" stroke-width="7"/><circle cx="40" cy="40" r="34" fill="none" stroke="${col}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - sc / 100)}" transform="rotate(-90 40 40)" class="ring-arc" style="--c:${circ}"/></svg><b>${U.count(sc, 'n0', 'rk-sc')}</b></div>
          <div><div class="row" style="gap:14px;flex-wrap:wrap"><h2>${GX.deployed() ? 'Aggregate System Risk' : 'Projected System Risk'} ${GX.info('risk')}</h2><span class="pill ${pillC}" style="text-transform:none;font-size:13px;height:26px;padding:0 12px">${r.risk.label}</span>${k.applied ? '<span class="pill teal" style="text-transform:none;font-size:12px">Mitigation active</span>' : ''}</div>
          <p class="muted">${k.P.imbalance > 0.3 ? `Current geothermal load analysis indicates a seasonal thermal imbalance in the borefield. Without load rebalancing, the system efficiency is projected to drop below the ${thr}% stability threshold by ${qtr}.` : `Thermal field is within tolerance. The main residual exposure is ${k.risks[0].name.toLowerCase()} (${k.risks[0].prob.toFixed(0)}% probability).`}</p></div>
        </div>
        <div class="rk-grid">
          <div><h3 class="card-title ink3 rk-h">Priority Risks (Top 3) <span class="est-tag" title="Probabilities and horizons are estimated by the model from the current design — not measured data.">model estimate</span></h3>
            <div class="pr-list">${k.risks.map((x, i) => `<div class="card pr" style="--bc:${i === 0 && x.prob > 60 ? 'var(--red)' : 'var(--amber)'}"><b>${x.name}</b><div class="between"><span class="muted">Prob: <span style="color:${i === 0 && x.prob > 60 ? 'var(--red)' : 'inherit'};font-weight:${i === 0 ? 700 : 500}">${x.prob.toFixed(0)}%</span></span><span class="muted">Horizon: ${x.hz}</span></div><div class="progress"><i style="width:${x.prob}%;background:${i === 0 && x.prob > 60 ? 'var(--red)' : 'var(--amber)'}"></i></div></div>`).join('')}</div></div>
          <div>
            <div class="card pad rk-path"><h3 class="card-title ink3">Risk Evolution Pathway</h3>
              <div class="path">${steps.map((s, i) => `<div class="pstep ${s[3] ? 'crit' : ''}" style="animation-delay:${i * 90}ms"><b>${s[0]}</b><span class="when">${s[1]}</span><i></i><p>${s[2]}</p></div>`).join('')}</div></div>
            <h3 class="card-title ink3 rk-h" style="margin-top:28px">Recommended Mitigation Plan</h3>
            <div class="grid r-2" style="grid-template-columns:1fr 1fr;gap:20px">
              <div class="card pad"><div class="teal b" style="font-size:13.5px">Immediate (Next 48h)</div><div class="mit">${actions.map(a => `<div>→ <b>${a}</b></div>`).join('')}</div></div>
              <div class="card pad"><div class="teal b" style="font-size:13.5px">Projected Impact (Prevented)</div><div class="grid" style="grid-template-columns:1fr 1fr;gap:12px;margin-top:14px">
                <div class="mini-box"><div class="v red">-${((r.SCOP - k.cop12) / r.SCOP * 100).toFixed(0)}%</div><div class="l up">Eff. Loss</div></div><div class="mini-box"><div class="v red">+${U.moneyK(k.opexSave)}</div><div class="l up">OPEX Save / yr</div></div></div></div>
            </div>
            <div class="insight" style="margin-top:20px"><b class="teal6">Insight:</b> Imbalance is driven by asymmetrical building demand (${cooling ? 'cooling' : 'heating'} ${Math.round(Math.abs(S.cur().project.coolDemand - S.cur().project.heatDemand) / Math.min(S.cur().project.coolDemand, S.cur().project.heatDemand) * 100)}% higher). Increasing borehole spacing in the next design revision will eliminate ${k.riskCut.toFixed(0)}% of current risk.</div>
          </div>
        </div>`;
    },
    foot: () => `<span class="spacer"></span><button class="btn btn-ghost" data-go="simulation-lab">Adjust Simulation Parameters</button><button class="btn btn-ghost" id="rk-export">Export Decision Data</button><button class="btn btn-accent" id="rk-apply" data-edit>${S.cur().mitigation.rebalance && S.cur().mitigation.returnTemp && S.cur().mitigation.flowOpt ? 'Revert Mitigation Plan' : 'Apply Mitigation Plan'}</button>`
  };
  document.addEventListener('click', e => {
    if (e.target.closest('#rk-apply')) {
      if (!GX.guard()) return; const m = S.cur().mitigation; const on = !(m.rebalance && m.returnTemp && m.flowOpt);
      const before = S.result().risk.score;
      S.setMitigation(on ? { rebalance: true, returnTemp: 2, flowOpt: true } : { rebalance: false, returnTemp: 0, flowOpt: false });
      S.log(on ? 'Risk mitigation plan applied' : 'Risk mitigation reverted', 'Intelligence', on ? 'Completed' : 'Modified');
      U.toast(on ? `Mitigation applied. Risk ${before} → <b>${S.result().risk.score}</b>` : 'Mitigation reverted');
    }
    if (e.target.closest('#rk-export')) {
      const k = GX.views['risk-engine'].model(), r = k.r;
      const data = { project: S.cur().project.name, generated: new Date().toISOString(), aggregateRisk: r.risk.score, label: r.risk.label, components: Object.fromEntries(Object.entries(r.risk.parts).map(([a, b]) => [a, +b.toFixed(3)])), priorityRisks: k.risks.map(x => ({ name: x.name, probability: +x.prob.toFixed(1), horizon: x.hz })), cop: { now: +r.SCOP.toFixed(2), month12Unmitigated: +k.cop12.toFixed(2) }, mitigation: S.cur().mitigation };
      U.exportData('Decision data', `${S.cur().project.ref}-risk.json`, JSON.stringify(data, null, 2), 'application/json'); S.log('Exported risk decision data', 'Intelligence', 'Success');
    }
  });

})();

/* ===== Operating data (real monitoring from user-uploaded monthly data) ===== */
(function () {
  'use strict';
  const U = window.GXUI, S = window.GXStore, E = window.GXEngine, GX = window.GX; const esc = U.esc;
  const MN = E.MONTHS;
  const mIdx = m => { const k = parseInt(String(m).slice(5, 7), 10); return isFinite(k) ? k - 1 : 0; };
  const label = m => { const d = new Date(m + '-15T12:00:00'); return isNaN(d) ? m : d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); };
  const O = GX.opsData = {
    expected() { const c = S.cur(); const sim = E.simulate(c.project, c.design, S.state.settings, c.mitigation, { years: 1 }); const r = S.result();
      return { cop: sim.cop, thermal: E.MONTHS.map((_, i) => (c.project.heatDemand * E.HEAT_W[i] + c.project.coolDemand * E.COOL_W[i]) * r.coverage), ewth: r.EWTh, ewtc: r.EWTc }; },
    rows() { return (S.cur().ops.rows || []).slice().sort((a, b) => a.month.localeCompare(b.month)); },
    enrich() { const ex = O.expected(); return O.rows().map(r => { const i = mIdx(r.month); const cop = r.elec > 0 ? r.thermal / r.elec : null; const ecop = ex.cop[i]; const dev = cop ? (cop / ecop - 1) * 100 : null; const tdev = (r.thermal / ex.thermal[i] - 1) * 100;
      const loopBad = r.loop != null && r.loop !== '' && (r.loop > ex.ewtc + 6 || r.loop < ex.ewth - 5);
      const st = dev == null ? 'gray' : dev < -20 ? 'red' : dev < -10 || loopBad ? 'amber' : 'green'; return Object.assign({}, r, { cop, ecop, dev, tdev, loopBad, st, i, ethermal: ex.thermal[i] }); }); },
    parse(text) {
      const rows = []; const isF = /loop_temp_f/i.test(text.split(/\r?\n/)[0] || '');
      text.split(/\r?\n/).forEach(line => { const c = line.split(/[,;\t]/).map(x => x.trim()); if (c.length < 3) return; let m = c[0];
        if (/^\d{4}-\d{1,2}$/.test(m)) m = m.slice(0, 5) + m.slice(5).padStart(2, '0'); else if (/^\d{1,2}\/\d{4}$/.test(m)) { const [mm, yy] = m.split('/'); m = yy + '-' + mm.padStart(2, '0'); } else return;
        const th = parseFloat(c[1]), el = parseFloat(c[2]); if (!(th >= 0) || !(el > 0)) return; const lp = c[3] !== undefined && c[3] !== '' ? parseFloat(c[3]) : null;
        rows.push({ month: m, thermal: th, elec: el, loop: isFinite(lp) && lp !== null ? (isF ? (lp - 32) * 5 / 9 : lp) : null }); });
      return rows;
    },
    merge(newRows) { const map = {}; (S.cur().ops.rows || []).forEach(r => map[r.month] = r); newRows.forEach(r => map[r.month] = r); S.setOps(Object.values(map)); },
    template() { const ex = O.expected(); const y = new Date().getFullYear() - 1; return 'month,thermal_kwh,electricity_kwh,' + (U.imp() ? 'loop_temp_f' : 'loop_temp_c') + '\n' + MN.map((m, i) => `${y}-${String(i + 1).padStart(2, '0')},${Math.round(ex.thermal[i])},${Math.round(ex.thermal[i] / ex.cop[i])},`).join('\n'); },
    paint(el) {
      const host = U.$('#mon', el) || el; const rows = O.enrich(); const r = S.result();
      if (!rows.length) {
        host.innerHTML = `<div class="card empty-state" style="max-width:720px"><div class="es-ico">⇪</div><h2>Connect operating data</h2>
          <p class="muted">Upload monthly readings from the building's meters or BMS. GeoThermX compares the measured efficiency with what the design predicts for each month and flags deviations in Alerts.</p>
          <table class="ex-t" style="text-align:left;margin:6px 0 16px"><tr><td><b>month</b></td><td>YYYY-MM, e.g. 2026-09</td></tr><tr><td><b>thermal_kwh</b></td><td>Heat delivered + heat removed by the heat pumps</td></tr><tr><td><b>electricity_kwh</b></td><td>Electricity used by heat pumps and circulation pumps</td></tr><tr><td><b>${U.imp() ? 'loop_temp_f' : 'loop_temp_c'}</b></td><td>Optional: average loop return temperature, ${U.tempU()}C</td></tr></table>
          <div class="row" style="gap:12px;justify-content:center;flex-wrap:wrap"><button class="btn btn-accent" id="op-up2" data-edit>Upload CSV</button><button class="btn btn-ghost" id="op-add2" data-edit>Enter a month manually</button><button class="btn btn-ghost" id="op-tpl2">Download template</button></div></div>`;
        return;
      }
      const last = rows[rows.length - 1];
      const mx = Math.max(...rows.map(x => Math.max(x.cop || 0, x.ecop))) * 1.15, mn = Math.min(...rows.map(x => Math.min(x.cop || x.ecop, x.ecop))) * 0.8;
      const W = 1000, H = 220, n = rows.length, X = i => n === 1 ? W / 2 : 30 + i / (n - 1) * (W - 60), Y = v => H - 24 - (v - mn) / ((mx - mn) || 1) * (H - 44);
      const pathOf = k => rows.map((x, i) => x[k] ? `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(x[k]).toFixed(1)}` : '').join(' ');
      const tmax = Math.max(...rows.map(x => Math.max(x.thermal, x.ethermal))) || 1;
      host.innerHTML = `
        <div class="mon-kpis">
          <div class="card kpi-sm"><div class="lbl">Measured COP · ${label(last.month)}</div><div class="val num">${last.cop ? last.cop.toFixed(2) : '—'} ${last.dev != null ? `<small class="${last.dev >= -10 ? 'green' : last.dev >= -20 ? 'amber' : 'red'}">${U.signed(last.dev, 0, '%')}</small>` : ''}</div></div>
          <div class="card kpi-sm"><div class="lbl">Expected COP ${GX.info('cop')}</div><div class="val num">${last.ecop.toFixed(2)}</div></div>
          <div class="card kpi-sm"><div class="lbl">Thermal energy</div><div class="val num">${U.n(last.thermal / 1000, 1)} <small style="color:var(--muted)">MWh</small></div></div>
          <div class="card kpi-sm"><div class="lbl">Electricity</div><div class="val num">${U.n(last.elec / 1000, 1)} <small style="color:var(--muted)">MWh</small></div></div>
          <div class="card kpi-sm"><div class="lbl">Loop temperature</div><div class="val num ${last.loopBad ? 'amber' : ''}">${last.loop != null ? U.temp(last.loop) : '—'}</div></div>
        </div>
        <div class="grid r-2" style="grid-template-columns:1.4fr 1fr;gap:21px;margin-top:22px">
          <div class="card pad"><div class="between"><span class="mc-t">Measured vs. expected COP</span><span class="row" style="gap:14px;font-size:12px"><span class="row" style="gap:6px"><span class="dot" style="background:var(--teal-500)"></span>Measured</span><span class="row" style="gap:6px"><span class="dot" style="background:#94a3b8"></span>Expected (design model)</span></span></div>
            <svg viewBox="0 0 ${W} ${H}" class="chart" style="margin-top:10px"><path d="${pathOf('ecop')}" fill="none" stroke="#94a3b8" stroke-width="2" stroke-dasharray="6 5"/><path d="${pathOf('cop')}" fill="none" stroke="#14b8a6" stroke-width="2.6"/>
              ${rows.map((x, i) => `${x.cop ? `<circle cx="${X(i)}" cy="${Y(x.cop)}" r="5" fill="${x.st === 'red' ? '#ef4444' : x.st === 'amber' ? '#f59e0b' : '#14b8a6'}" stroke="#fff" stroke-width="2" data-tip="${label(x.month)}: measured <b>${x.cop.toFixed(2)}</b> · expected ${x.ecop.toFixed(2)}"/>` : ''}<text x="${X(i)}" y="${H - 4}" text-anchor="middle">${MN[x.i]}</text>`).join('')}</svg></div>
          <div class="card pad"><span class="mc-t">Thermal energy: measured vs. design</span>
            <div class="op-bars">${rows.slice(-12).map(x => `<div data-tip="${label(x.month)}: <b>${U.n(x.thermal / 1000, 1)} MWh</b> measured · ${U.n(x.ethermal / 1000, 1)} MWh design"><i class="bar-anim" style="height:${x.thermal / tmax * 100}%"></i><i class="bar-anim e" style="height:${x.ethermal / tmax * 100}%"></i><span>${MN[x.i][0]}</span></div>`).join('')}</div></div>
        </div>
        <div class="card pad" style="margin-top:22px"><div class="between"><h3 class="card-title dark">Monthly operating data</h3><span class="muted" style="font-size:12.5px">${rows.length} month${rows.length > 1 ? 's' : ''} · updated ${U.stamp(S.cur().ops.updatedAt || new Date().toISOString()).slice(0, 10)}</span></div>
          <div class="op-table"><div class="op-r op-h"><span>Month</span><span>Thermal (kWh)</span><span>Electricity (kWh)</span><span>Measured COP</span><span>Expected COP</span><span>Deviation</span><span>Loop temp</span><span>Status</span><span></span></div>
          ${rows.slice().reverse().map(x => `<div class="op-r"><span>${label(x.month)}</span><span class="num">${U.n(x.thermal)}</span><span class="num">${U.n(x.elec)}</span><span class="num b">${x.cop ? x.cop.toFixed(2) : '—'}</span><span class="num">${x.ecop.toFixed(2)}</span><span class="num ${x.st}">${x.dev != null ? U.signed(x.dev, 1, '%') : '—'}</span><span class="num">${x.loop != null ? U.temp(x.loop) : '—'}</span><span><span class="pill ${x.st === 'gray' ? 'gray' : x.st}" style="text-transform:none">${x.st === 'green' ? 'On target' : x.st === 'amber' ? 'Check' : x.st === 'red' ? 'Below target' : '—'}</span></span><span><button class="link-btn" data-op-del="${x.month}" data-edit>Remove</button></span></div>`).join('')}</div></div>`;
      U.bindTips(host);
    },
    addModal() {
      const now = new Date(); now.setMonth(now.getMonth() - 1); const m = now.toISOString().slice(0, 7);
      U.modal({ title: 'Add monthly reading', body: `<div class="pair"><div class="field"><label for="om-m">Month</label><input class="input" id="om-m" type="month" value="${m}"></div><div class="field"><label for="om-l">Loop return temp (${U.tempU()}, optional)</label><input class="input" id="om-l" type="number" step="0.1"></div></div>
        <div class="pair"><div class="field"><label for="om-t">Thermal energy (kWh)</label><input class="input" id="om-t" type="number" min="0"></div><div class="field"><label for="om-e">Electricity (kWh)</label><input class="input" id="om-e" type="number" min="1"></div></div><div class="muted" style="font-size:12.5px" id="om-err"></div>`,
        actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Save reading', kind: 'accent', onClick: md => { const mo = U.$('#om-m', md).value, t = parseFloat(U.$('#om-t', md).value), e = parseFloat(U.$('#om-e', md).value), l = U.$('#om-l', md).value;
          if (!/^\d{4}-\d{2}$/.test(mo) || !(t >= 0) || !(e > 0)) { U.$('#om-err', md).textContent = 'Enter a month, thermal energy and electricity.'; return false; }
          O.merge([{ month: mo, thermal: t, elec: e, loop: l !== '' ? U.tempIn(parseFloat(l)) : null }]); S.log('Operating data added for ' + mo, 'System', 'Success'); U.toast('Reading saved'); } }] });
    },
    upload() { const f = document.createElement('input'); f.type = 'file'; f.accept = '.csv,text/csv'; f.onchange = () => { const file = f.files[0]; if (!file) return; const rd = new FileReader(); rd.onload = () => { const rows = O.parse(String(rd.result)); if (!rows.length) { U.toast('No valid rows. Columns: month (YYYY-MM), thermal_kwh, electricity_kwh, loop_temp_f or loop_temp_c', 'err'); return; } O.merge(rows); S.log(`Imported ${rows.length} months of operating data`, 'System', 'Success'); U.toast(`Imported <b>${rows.length}</b> month(s) of operating data`); }; rd.readAsText(file); }; f.click(); }
  };
  document.addEventListener('click', e => {
    if (e.target.closest('#op-up,#op-up2')) O.upload();
    if (e.target.closest('#op-add,#op-add2')) O.addModal();
    if (e.target.closest('#op-tpl,#op-tpl2')) U.exportData('Operating data template', 'geothermx-operating-data-template.csv', O.template(), 'text/csv');
    if (e.target.closest('#op-exp')) U.exportData('Operating data', `${S.cur().project.ref}-operating-data.csv`, U.csv([['month', 'thermal_kwh', 'electricity_kwh', U.imp() ? 'loop_temp_f' : 'loop_temp_c', 'measured_cop', 'expected_cop', 'deviation_pct']].concat(O.enrich().map(x => [x.month, x.thermal, x.elec, x.loop == null ? '' : +U.tempV(x.loop).toFixed(1), x.cop ? x.cop.toFixed(3) : '', x.ecop.toFixed(3), x.dev != null ? x.dev.toFixed(1) : '']))), 'text/csv');
    const d = e.target.closest('[data-op-del]'); if (d) { S.setOps((S.cur().ops.rows || []).filter(r => r.month !== d.dataset.opDel)); U.toast('Month removed'); }
  });
})();
