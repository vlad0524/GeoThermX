/* GeoThermX views: Dashboard, Site Intelligence, Project Setup, System Design, Drilling Optimization */
(function () {
  'use strict';
  const U = window.GXUI, S = window.GXStore, E = window.GXEngine, A = window.GXAlerts;
  const GX = window.GX = window.GX || {}; GX.views = GX.views || {};
  const esc = U.esc;

  GX.whatIf = (dp, mp, sp) => { const c = S.cur(); return E.compute(c.project, Object.assign({}, c.design, dp || {}), Object.assign({}, S.state.settings, sp || {}), Object.assign({}, c.mitigation, mp || {})); };
  GX.ago = t => { const m = { '12:42:08': '12 mins ago', '12:38:15': '16 mins ago', '12:10:44': '1 hour ago', '11:58:20': '2 hours ago', '11:52:31': '3 hours ago' }; return m[t] || '4 hours ago'; };
  const lvlColor = l => l === 'Low' ? 'var(--green)' : l === 'Medium' ? 'var(--amber)' : 'var(--red)';

  /* ================= DASHBOARD ================= */
  GX.views.dashboard = {
    name: 'Overview', header: { mode: 'dashboard' },
    state: { tab: 'output' },
    render(el) { el.innerHTML = '<div id="dash"></div>'; this.paint(el); },
    paint(el) {
      const r = S.result(), c = S.cur(), sc = S.scenarios(), std = sc.list[0].r;
      const sim = E.simulate(c.project, c.design, S.state.settings, c.mitigation, { years: 1 });
      const cnt = A.counts(); const crit = cnt.critical;
      const status = r.stability > 0.8 && r.risk.score < 72 ? 'Optimal' : r.stability > 0.65 ? 'Stable' : 'Attention';
      const nowM = new Date().getMonth(); const idx = []; for (let i = 7; i >= 0; i--) idx.push((nowM - i + 12) % 12);
      const t = this.state.tab;
      const series = idx.map(m => t === 'output' ? (c.project.heatDemand * E.HEAT_W[m] + c.project.coolDemand * E.COOL_W[m]) / 1000 * r.coverage : t === 'load' ? sim.load[m] : sim.ground[m]);
      const unit = t === 'output' ? 'MWh' : t === 'load' ? U.powU() : U.tempU();
      if (t === 'load' && U.imp()) for (let i = 0; i < series.length; i++) series[i] = series[i] / 3.517;
      if (t === 'temp' && U.imp()) for (let i = 0; i < series.length; i++) series[i] = series[i] * 9 / 5 + 32;
      const dep = GX.deployed(); const cmp = GX.complianceHtml(true);
      const peakLoad = Math.max(...idx.map(m => Math.max(c.design.heatPeak * E.HEAT_W[m] / Math.max(...E.HEAT_W), c.design.coolPeak * E.COOL_W[m] / Math.max(...E.COOL_W))));
      const eW = idx.map(m => c.project.heatDemand * E.HEAT_W[m] + c.project.coolDemand * E.COOL_W[m]); const avgEff = eW.reduce((a, b) => a + b, 0) / idx.reduce((a, m, i) => a + eW[i] / sim.cop[m], 0) * 20;
      const alerts = A.list().filter(a => a.status !== 'resolved' && (a.sev === 'critical' || a.sev === 'warning')).sort((a, b) => (a.sev === 'critical' ? 0 : 1) - (b.sev === 'critical' ? 0 : 1)).slice(0, 3);
      const flowOpt = GX.whatIf({ flow: 0.95 });
      const roiGain = (flowOpt.roi10 - r.roi10);
      const opt = sc.list[1].design;
      const depthDelta = c.design.depth - opt.depth;
      const scaleDays = Math.max(12, Math.round(90 - r.pumpKw * 2.2));
      const L = r.loc;
      const recBox = [
        c.design.flow > 1.0
          ? { tag: 'OPTIMIZATION', text: `Reduce pump speed by ${Math.round((1 - 0.95 / c.design.flow) * 100)}% during off-peak for ${U.signed(roiGain, 1, '%')} ROI.`, act: 'flow' }
          : { tag: 'OPTIMIZATION', text: `Enable load rebalancing to cut ground drift by 38% and lift COP ${U.signed((GX.whatIf(null, { rebalance: true }).SCOP / r.SCOP - 1) * 100, 1, '%')}.`, act: 'rebalance' },
        dep && GX.isSample() ? { tag: 'MAINTENANCE', text: `Predicted scale buildup in the plate heat exchanger within ${scaleDays} days.`, act: 'alerts' } : dep ? { tag: 'OPERATING DATA', text: (c.ops.rows || []).length ? `${c.ops.rows.length} month(s) of measured data. Upload new readings monthly to keep tracking efficiency.` : 'Upload monthly meter data to compare measured and expected COP.', act: 'monitoring' } : { tag: 'COMPLIANCE', text: `${cmp.counts.actions} permit and safety actions open before drilling${cmp.counts.issues ? `, ${cmp.counts.issues} design issue(s)` : ''}.`, act: 'drill' },
        { tag: 'DRILLING', text: depthDelta > 0 ? `Borehole depth can be reduced by ${U.len(depthDelta)} in ${r.g.layer} without losing performance.` : `Borehole depth is already optimal at ${U.len(c.design.depth)} for the ${r.g.layer}.`, act: 'drill' }
      ];
      const maxV = Math.max(...series) * 1.12, minV = t === 'temp' ? Math.min(...series) * 0.8 : 0;
      const bars = series.map((v, i) => {
        const h = U.clamp((v - minV) / (maxV - minV), 0.04, 1) * 100;
        return `<div class="dbar-col" data-tip="${E.MONTHS[idx[i]]}: <b>${U.n(v, t === 'temp' ? 1 : 0)} ${unit}</b>"><i class="bar-anim" style="height:${h}%;animation-delay:${i * 45}ms"></i></div>`;
      }).join('');
      const drillShare = r.drilling / r.capex * 100, eqShare = r.equipment / r.capex * 100;
      el.querySelector('#dash').innerHTML = `
      <div class="dash-grid stagger">
        ${dep && GX.isSample() ? `<div class="card kpi" style="grid-column:span 1"><div class="lbl">System Status</div><div class="val" style="color:${status === 'Optimal' ? 'var(--green)' : status === 'Stable' ? 'var(--teal-600)' : 'var(--amber)'}">${status}</div><div class="sub green">+0.5% uptime improvement</div></div>` : dep ? (() => { const rows = GX.opsData.enrich(); const lx = rows[rows.length - 1]; const st = !lx || lx.dev == null ? ['No data yet', 'var(--muted)', 'Upload operating data'] : lx.dev >= -10 ? ['On target', 'var(--green)', `Measured COP ${lx.cop.toFixed(2)} (${U.signed(lx.dev, 0, '%')})`] : ['Below target', 'var(--amber)', `Measured COP ${lx.cop.toFixed(2)} (${U.signed(lx.dev, 0, '%')})`]; return `<div class="card kpi hover-lift" data-go="monitoring" style="cursor:pointer"><div class="lbl">System Status</div><div class="val" style="color:${st[1]};font-size:${st[0].length > 9 ? 22 : 28}px">${st[0]}</div><div class="sub muted">${st[2]}</div></div>`; })() : `<div class="card kpi hover-lift" data-go="projects" style="cursor:pointer"><div class="lbl">Project Stage</div><div class="val" style="color:${GX.stage() === 'design' ? 'var(--blue)' : 'var(--amber)'}">${GX.STAGES[GX.stage()][0]}</div><div class="sub muted">Not yet installed</div></div>`}
        <div class="card kpi"><div class="lbl">Seasonal COP ${GX.info('cop')}</div><div class="val">${U.count(r.SCOP, 'n2', 'd-eff')}</div><div class="sub ${r.SCOP >= std.SCOP ? 'green' : 'red'}">${r.SCOP >= std.SCOP ? '↑' : '↓'} ${U.signed(r.SCOP - std.SCOP, 2)} vs standard design</div></div>
        <div class="card kpi"><div class="lbl">Net Savings (25 yr)</div><div class="val">${U.count(r.cum[25], 'moneyK', 'd-roi')}</div><div class="sub ${r.cum[25] > 0 ? 'green' : 'red'}">${r.irr != null ? 'IRR ' + (r.irr * 100).toFixed(1) + '%' : 'No positive return'} · after net investment</div></div>
        <div class="card kpi"><div class="lbl">Payback Period</div><div class="val">${r.paybackYears >= 25 ? '&gt;25' : U.count(r.paybackYears, 'n1', 'd-pb')} <small>yrs</small></div><div class="sub muted">vs ${esc(r.baseline.short)}${r.paybackYears < 25 ? ` · ${r.paybackLow.toFixed(1)}–${Math.min(25, r.paybackHigh).toFixed(1)} yrs` : ''}</div></div>
        ${dep ? `<div class="card kpi hover-lift" data-go="alerts" style="cursor:pointer"><div class="lbl">Active Alerts</div><div class="val">${U.count(cnt.active, 'n0', 'd-al')}</div><div class="sub ${crit ? 'red' : 'green'}">${crit ? crit + ' High Severity Alert' + (crit > 1 ? 's' : '') : 'No high severity alerts'}</div></div>` : `<div class="card kpi hover-lift" data-go="drilling-optimization" style="cursor:pointer"><div class="lbl">Design Checks</div><div class="val">${U.count(cmp.counts.issues + cmp.counts.actions, 'n0', 'd-al')}</div><div class="sub ${cmp.counts.issues ? 'red' : 'amber'}">${cmp.counts.issues ? cmp.counts.issues + ' design issue(s)' : cmp.counts.actions + ' permit / safety actions'}</div></div>`}
        <div class="card kpi"><div class="lbl">CO₂ Reduction ${GX.info('co2')}</div><div class="val">-${U.count(r.co2Pct, 'pct0', 'd-co2')}</div><div class="sub green">${U.n(r.co2Saved, 0)} t CO₂ avoided / yr</div></div>

        <div class="card perf" style="grid-column:span 4">
          <div class="perf-main">
            <div class="between"><h3 class="card-title">Thermal Energy Performance</h3>
              <div class="tabs" role="tablist">${[['output', 'Output'], ['load', 'Load'], ['temp', 'Temp']].map(([k, l]) => `<button role="tab" data-tab="${k}" class="${t === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
            <div class="dbars">${bars}</div>
          </div>
          <div class="perf-side">
            <div><div class="ps-l">Peak Load</div><div class="ps-v">${U.pow(peakLoad, U.imp() ? 0 : 1)}</div></div>
            <div><div class="ps-l">Avg COP</div><div class="ps-v">${U.count(avgEff / 20, 'n2', 'd-ae')}</div></div>
            ${GX.isSample() ? '<div><div class="ps-l">System Uptime</div><div class="ps-v green">99.98%</div></div>' : `<div><div class="ps-l">Annual Output</div><div class="ps-v">${U.n(r.annualOutput, 0)} MWh</div></div>`}
          </div>
        </div>

        <div class="card site-cfg" style="grid-column:span 2">
          <h3 class="card-title">Site Configuration</h3>
          <div class="sc-rows">
            <div class="kv"><span class="k">Location</span><span class="v">${esc(L.city)}</span></div>
            <div class="kv"><span class="k">Climate Zone</span><span class="v">${esc(r.c.label)}</span></div>
            <div class="kv"><span class="k">Soil Type</span><span class="v">${esc(c.project.ground)}</span></div>
            <div class="kv"><span class="k">Suitability Score ${GX.info('suit')}</span><span class="v"><span class="score-pill">${U.count(r.suit, 'n0', 'd-suit')} / 100</span></span></div>
          </div>
          <div class="insight bar ai-assess"><div class="tag">Assessment</div>${esc(assessText(r, c))}</div>
        </div>

        <div class="card fin-life" style="grid-column:span 2">
          <h3 class="card-title">Financial Lifecycle</h3>
          <div style="margin-top:58px"><div class="fl-l">Total Investment</div><div class="fl-v">${U.count(r.capex, 'money', 'd-capex')}</div></div>
          <div style="margin-top:44px"><div class="fl-l">Annual Savings</div><div class="fl-v green">${U.count(r.annualSavings, 'money', 'd-sav')}</div></div>
          <div class="fl-bars">
            <div class="fl-bar" data-tip="Drilling: <b>${U.money(r.drilling)}</b> (${drillShare.toFixed(0)}%)"><span>Drilling</span><div class="progress"><i style="width:${drillShare}%"></i></div></div>
            <div class="fl-bar" data-tip="Equipment: <b>${U.money(r.equipment)}</b> (${eqShare.toFixed(0)}%)"><span>Equipment</span><div class="progress"><i style="width:${eqShare}%"></i></div></div>
          </div>
        </div>

        <div class="card crit" style="grid-column:span 2">
          <h3 class="card-title">${dep ? 'Critical Alerts' : 'Design Checks'}</h3>
          ${!dep ? `<div class="crit-list">${E.compliance(r, c.project, c.design, U).filter(i => i.status === 'fail' || i.status === 'warn' || (i.status === 'action' && !(c.checks || {})[i.title])).slice(0, 3).map(i => `<button class="crit-item ${i.status === 'fail' ? 'critical' : ''}" data-go="drilling-optimization"><b>${esc(i.title)}</b><span>${esc(i.cat)} • ${esc(i.ref)}</span></button>`).join('') || '<div class="empty-ok">All design checks passed.</div>'}</div>` : `<div class="crit-list">${alerts.length ? alerts.map(a => `<button class="crit-item ${a.sev}" data-alert="${a.id}"><b>${esc(a.title.replace(' detected in', ' -').replace('Thermal imbalance -', 'Thermal Imbalance -'))}</b><span>${a.month || GX.ago(a.time)} • ${esc(a.month ? a.area : shortDesc(a))}</span></button>`).join('') : '<div class="empty-ok">All systems nominal. No open alerts.</div>'}</div>`}
        </div>

        <div class="dark-card ai-eng" style="grid-column:span 2">
          <h3 class="card-title">Recommendations</h3>
          <div class="ai-list">${recBox.map(b => `<button class="ai-item" data-act="${b.act}"><div class="tag">${b.tag}</div><div>${esc(b.text)}</div></button>`).join('')}</div>
        </div>
      </div>`;
      const root = el.querySelector('#dash');
      root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { this.state.tab = b.dataset.tab; this.paint(el); U.animateNumbers(el, {}); U.bindTips(el); });
      root.querySelectorAll('[data-alert]').forEach(b => b.onclick = () => { GX.views.alerts.state.sel = b.dataset.alert; GX.go('alerts'); });
      root.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
        const a = b.dataset.act;
        if (a === 'flow') { if (!GX.guard()) return; S.setDesign({ flow: 0.95 }, 'ai'); S.log('Pump flow reduced to ' + U.flow(0.95) + ' per loop', 'Config', 'Completed'); U.toast('Pump flow trimmed to ' + U.flow(0.95) + ' per loop. ROI and payback updated.'); }
        else if (a === 'rebalance') { if (!GX.guard()) return; S.setMitigation({ rebalance: true }); S.log('AI: load rebalancing enabled', 'Intelligence', 'Completed'); U.toast('Load rebalancing enabled.'); }
        else if (a === 'alerts') GX.go('alerts');
        else if (a === 'monitoring') GX.go('monitoring');
        else GX.go('drilling-optimization');
      });
    }
  };
  function shortDesc(a) {
    if (a.id === 'thermal-imbalance') return 'Delta exceeded ' + (a.desc.match(/(\d+)%/) || ['', '15'])[1] + '%';
    if (a.id === 'pump-cavitation') return 'Delta exceeded ' + U.pres(-0.5);
    if (a.id === 'capacity') return 'Loop margin < 5%';
    if (a.id === 'drift') return 'Ground drift ' + U.dTyr(S.result().drift, 2);
    if (a.id === 'fluid-conc') return 'Freeze margin low';
    return a.area;
  }
  function assessText(r, c) {
    const typ = (c.design.orient === 'horizontal' ? 'horizontal ' : 'vertical ') + (c.design.loop === 'open' ? 'open-loop wells' : 'closed-loop heat exchangers');
    if (r.suit >= 85) return `Conditions are optimal for ${typ}.`;
    if (r.suit >= 70) return `Conditions are favorable for ${typ}; confirm with a test borehole or thermal response test before drilling.`;
    return `Site conditions are marginal. A thermal response test is recommended before committing to ${typ}.`;
  }

  /* ================= SITE INTELLIGENCE ================= */
  const LAYERS = {
    thermal: { label: 'Thermal Potential', legend: [['var(--green)', 'High Efficiency (> 4.8 COP)'], ['var(--amber)', 'Moderate (3.2 - 4.8 COP)'], ['var(--red)', 'Constraint Zone']] },
    soil: { label: 'Soil Conductivity', get legend() { return [['#2563eb', `High (> ${U.cond(2.8)})`], ['#22c55e', `Medium (${U.condV(1.8).toFixed(1)} – ${U.condV(2.8).toFixed(1)})`], ['#eab308', `Low (< ${U.cond(1.8)})`]]; } },
    drill: { label: 'Drilling Feasibility', legend: [['var(--green)', 'Easy drilling'], ['var(--amber)', 'Moderate (casing likely)'], ['var(--red)', 'Hard rock / restricted']] },
    hydro: { label: 'Hydrology', get legend() { return [['#1d4ed8', `Shallow water table (< ${U.len(6)})`], ['#60a5fa', `Moderate (${U.len(6)} – ${U.len(12)})`], ['#e0f2fe', `Deep / dry (> ${U.len(12)})`]]; } }
  };
  GX.views['site-intelligence'] = {
    name: 'Site', header: { mode: 'step', step: 1, label: 'Site' },
    state: { layer: 'thermal', probe: { x: 0.5, y: 0.5 }, pending: null, busy: false },
    render(el) {
      const c = S.cur(), p = c.project;
      const pend = this.state.pending = { locationId: p.locationId, city: p.city || '', zone: p.zone, ground: p.ground, kOverride: p.kOverride || '', fidelity: p.fidelity };
      const stName = id => { const L = E.location(id); return L.state; };
      el.innerHTML = `
      <div class="site-bar">
        <div class="field"><label for="si-loc">State</label><select class="select si-in" id="si-loc" data-edit style="width:190px">${E.LOCATIONS.slice().sort((a, b) => a.state.localeCompare(b.state)).map(l => `<option value="${l.id}" ${l.id === pend.locationId ? 'selected' : ''}>${l.state}</option>`).join('')}</select></div>
        <div class="field"><label for="si-city">City / address</label><input class="input si-in" id="si-city" data-edit style="width:200px;background:#fff" value="${esc(pend.city)}" placeholder="${esc(E.location(pend.locationId).city)}"></div>
        <div class="field"><label for="si-zone">Climate Zone</label><select class="select si-in" id="si-zone" data-edit style="width:190px">${Object.entries(E.CLIMATE).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `<option value="${k}" ${k === pend.zone ? 'selected' : ''}>${v.label}</option>`).join('')}</select></div>
        <div class="field"><label for="si-ground">Ground Type</label><select class="select si-in" id="si-ground" data-edit style="width:180px">${Object.keys(E.GROUND).map(g => `<option ${g === pend.ground ? 'selected' : ''}>${g}</option>`).join('')}</select></div>
        <div class="field"><label for="si-k" title="From a thermal response test (TRT), if available">Measured k (optional)</label><input class="input si-in num" id="si-k" type="number" step="0.1" min="0.3" max="6" data-edit style="width:130px;background:#fff" value="${pend.kOverride ? +U.condV(pend.kOverride).toFixed(2) : ''}" placeholder="${U.condU()}"></div>
        <div class="field"><label for="si-fid">Ground data source</label><select class="select si-in" id="si-fid" data-edit style="width:240px">${Object.keys(E.FIDELITY).map(k => `<option ${k === pend.fidelity ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
        <button class="btn btn-primary" id="si-run" data-edit style="height:37px;align-self:flex-end;width:148px">Run Site Analysis</button>
        <div class="si-meta muted hide-sm" id="si-meta"></div>
      </div>
      <div class="site-grid">
        <div class="card heat-card">
          <div class="between heat-h"><h3 class="card-title">Subsurface Model (indicative)</h3><span class="gps num" id="si-gps"></span></div>
          <div class="heat-wrap" id="heat-wrap">
            <img src="assets/img/site-heatmap.jpg" alt="Isometric site model with subsurface thermal heatmap" id="heat-img" draggable="false">
            <canvas id="heat-cv"></canvas>
            <div class="scan" id="scan" hidden></div>
            <div class="layer-btns">${Object.entries(LAYERS).map(([k, v]) => `<button data-layer="${k}" class="${k === this.state.layer ? 'on' : ''}">${v.label}</button>`).join('')}</div>
            <div class="probe" id="probe"><i></i></div>
            <div class="probe-card" id="probe-card"></div>
            <div class="legend" id="legend"></div>
            <div class="hint muted">Click the site to probe values · indicative model of regional data, not a survey</div>
          </div>
        </div>
        <div class="site-right" id="site-right"></div>
      </div>`;
      const sync = () => {
        const changed = pend.locationId !== p.locationId || pend.zone !== p.zone || pend.fidelity !== p.fidelity || pend.ground !== p.ground || (pend.city || '') !== (p.city || '') || String(pend.kOverride || '') !== String(p.kOverride || '') || !p.analyzedAt;
        U.$('#si-run', el).classList.toggle('pulse-btn', changed);
      };
      U.$('#si-loc', el).onchange = e => { pend.locationId = e.target.value; const L = E.location(pend.locationId); pend.zone = L.zone; pend.ground = L.ground; U.$('#si-zone', el).value = pend.zone; U.$('#si-ground', el).value = pend.ground; U.$('#si-city', el).placeholder = L.city; sync(); };
      U.$('#si-city', el).oninput = e => { pend.city = e.target.value.trim(); sync(); };
      U.$('#si-ground', el).onchange = e => { pend.ground = e.target.value; sync(); };
      U.$('#si-k', el).oninput = e => { const v = U.condIn(parseFloat(e.target.value)); pend.kOverride = v > 0.2 && v < 7 ? +v.toFixed(3) : ''; sync(); };
      U.$('#si-zone', el).onchange = e => { pend.zone = e.target.value; sync(); };
      U.$('#si-fid', el).onchange = e => { pend.fidelity = e.target.value; sync(); };
      U.$('#si-run', el).onclick = () => this.run(el);
      sync();
      el.querySelectorAll('[data-layer]').forEach(b => b.onclick = () => { this.state.layer = b.dataset.layer; el.querySelectorAll('[data-layer]').forEach(x => x.classList.toggle('on', x === b)); this.drawLayer(el); });
      const wrap = U.$('#heat-wrap', el);
      wrap.addEventListener('click', e => {
        if (e.target.closest('.layer-btns') || e.target.closest('.legend')) return;
        const rc = wrap.getBoundingClientRect();
        this.state.probe = { x: (e.clientX - rc.left) / rc.width, y: (e.clientY - rc.top) / rc.height };
        this.placeProbe(el, true);
      });
      this.paint(el);
      const ro = new ResizeObserver(() => this.drawLayer(el)); ro.observe(wrap); this._ro = ro;
    },
    unmount() { if (this._ro) this._ro.disconnect(); },
    run(el) {
      if (!GX.guard() || this.state.busy) return;
      const btn = U.$('#si-run', el); this.state.busy = true;
      btn.innerHTML = '<span class="spin"></span>Analyzing…'; btn.disabled = true;
      U.$('#scan', el).hidden = false;
      setTimeout(() => {
        const pend = this.state.pending;
        S.setProject({ locationId: pend.locationId, city: pend.city || '', zone: pend.zone, ground: pend.ground, kOverride: pend.kOverride || '', fidelity: pend.fidelity, analyzedAt: new Date().toISOString() });
        S.mark('site');
        S.log(`Site analysis run for ${S.result().loc.city} (${E.CLIMATE[pend.zone].label})`, 'Intelligence', 'Completed');
        this.state.busy = false;
        btn.innerHTML = 'Run Site Analysis'; btn.disabled = false; btn.classList.remove('pulse-btn');
        U.$('#scan', el).hidden = true;
        U.toast(`Site analysis complete: suitability <b>${S.result().suit}/100</b>`);
      }, 1700);
    },
    paint(el) {
      const r = S.result(), c = S.cur(), p = c.project;
      const pct = Math.round(E.normCdf((r.suit - 70) / 10) * 100);
      const lbl = r.suit >= 85 ? 'Excellent' : r.suit >= 70 ? 'Good' : r.suit >= 55 ? 'Fair' : 'Poor';
      const verdict = r.suit >= 75 ? ['GO - Optimal for Deployment', 'var(--teal-500)'] : r.suit >= 60 ? ['CONDITIONAL GO - Verify Geology', 'var(--amber)'] : ['NO-GO - High Site Risk', 'var(--red)'];
      const marg = (r.capacityC / c.design.coolPeak - 1) * 100;
      const hy = E.hybrid(r, p);
      const heatDom = p.heatDemand > p.coolDemand;
      const vectors = [];
      vectors.push(r.g.drillability > 0.85 ? ['green', 'Low Lithology Risk', `Rock layers are soft/drillable to ${U.len(Math.max(400, p.depthLimit))}.`] : r.g.drillability > 0.7 ? ['amber', 'Moderate Lithology Risk', 'Intermittent hard layers; casing may be required.'] : ['red', 'High Lithology Risk', 'Crystalline bedrock raises drilling cost and time.']);
      vectors.push(r.imbalance > 0.2 ? ['amber', 'Seasonal Load Variance', heatDom ? 'Winter peak may require storage buffering.' : 'Summer heat rejection exceeds winter extraction; plan load rebalancing.'] : ['green', 'Balanced Seasonal Load', 'Heat extraction and rejection are within 20%.']);
      if (r.g.water > 0.6 || c.design.loop === 'open') vectors.push(['blue', 'Groundwater Present', 'Favourable for heat transfer; permit check required for open loop.']);
      const L = r.loc;
      U.$('#si-gps', el).textContent = `GPS: ${L.lat.toFixed(4)}° N, ${Math.abs(L.lon).toFixed(4)}° W`;
      U.$('#si-meta', el).textContent = p.analyzedAt ? 'Last analysis: ' + U.date(p.analyzedAt) : 'Not analysed yet';
      U.$('#site-right', el).innerHTML = `
        <div class="card pad">
          <h3 class="card-title">Site Suitability Score ${GX.info('suit')}</h3>
          <div class="row" style="margin-top:14px;align-items:flex-start;gap:20px"><div class="big-score">${U.count(r.suit, 'n0', 's-suit')}</div>
            <div style="padding-top:8px"><span class="pill green" style="text-transform:none;font-size:13px;height:24px">${lbl}</span><div class="muted" style="font-size:13px;margin-top:6px">${pct}${['th', 'st', 'nd', 'rd'][(pct % 10 > 3 || Math.floor(pct / 10) === 1) ? 0 : pct % 10]} percentile vs. typical sites (model)</div></div></div>
          <div class="grid" style="grid-template-columns:1fr 1fr;gap:12px;margin-top:14px">
            <div class="mini-box"><div class="l">Conductivity</div><div class="v" style="font-size:${U.imp() ? 15 : 19}px">${U.cond(r.g.k)}</div></div>
            <div class="mini-box"><div class="l">Stability</div><div class="v">${U.count(r.g.stability * 100, 'pct1', 's-st')}</div></div>
          </div>
        </div>
        <div class="dark-card pad ai-rec">
          <h3 class="card-title">Recommendation</h3>
          <div class="verdict" style="color:${verdict[1]}">${verdict[0]}</div>
          <p>The site exhibits ${r.g.stability > 0.9 ? 'high' : 'moderate'} geological consistency with a ${esc(p.ground.toLowerCase().replace(' / ', '-'))} composition. ${marg >= 0 ? `Estimated thermal recharge capacity exceeds projected peak load by ${marg.toFixed(0)}%.` : `Loop capacity is ${Math.abs(marg).toFixed(0)}% short of the projected peak load; extend the borefield.`} ${c.design.orient === 'vertical' ? 'Vertical' : 'Horizontal'} loop configuration recommended.</p>
        </div>
        <div class="card pad">
          <h3 class="card-title">Risk Vectors</h3>
          <div class="vec-list">${vectors.map(v => `<div class="vec ${v[0]}"><b>${v[1]}</b><span>${v[2]}</span></div>`).join('')}</div>
        </div>
        <div class="card pad">
          <h3 class="card-title">Performance Projection ${GX.info('cop')}</h3>
          <div class="proj-big"><div class="muted" style="font-size:13px">Est. Annual Output</div><div class="pv">${U.count(r.annualOutput * 1000, 'n0', 's-out')} kWh</div></div>
          <div class="grid" style="grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
            <div class="mini-box"><div class="l">Efficiency (COP)</div><div class="v">${U.count(r.SCOP, 'n1', 's-cop')}</div></div>
            <div class="mini-box"><div class="l">Stability</div><div class="v">${U.count(r.stability, 'n2', 's-stab')}</div></div>
          </div>
        </div>
        <div class="card pad">
          <h3 class="card-title">Local Energy Prices</h3>
          <div class="grid" style="grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
            <div class="mini-box"><div class="l">Electricity</div><div class="v" style="font-size:18px">$${r.inputs.s.elec.toFixed(3)}<small style="font-size:12px;color:var(--muted)">/kWh</small></div></div>
            <div class="mini-box"><div class="l">Natural gas</div><div class="v" style="font-size:18px">$${(r.inputs.s.gas * 29.307).toFixed(2)}<small style="font-size:12px;color:var(--muted)">/therm</small></div></div>
          </div>
          <div class="muted" style="font-size:12px;margin-top:10px">${E.SECTOR[r.sector].label} rates for ${esc(r.loc.state)}${p.econ && (p.econ.elec != null || p.econ.gas != null) ? ' (edited)' : ' — EIA average, approx. 2024'} · <a href="#costs">edit in Costs &amp; Incentives</a></div>
        </div>
        <div class="card pad">
          <h3 class="card-title">Hybrid / Alternatives</h3>
          <div class="alt-box"><div class="between"><b>Solar-Geothermal Hybrid</b><span class="green b">+${hy.roiUp.toFixed(0)}% ROI</span></div><div class="muted">Utilize roof space for ${U.n(hy.kw, 0)} kW PV to offset pump electricity costs (${U.moneyK(hy.offset)}/yr).</div></div>
          <div class="alt-box"><div class="between"><b>Thermal Storage Buffer</b><span class="teal b">-${Math.round(8 + r.imbalance * 20)}% peak</span></div><div class="muted">A ${Math.round(c.design.coolPeak * 0.35)} kWh buffer tank shaves peak loop demand and evens seasonal load.</div></div>
        </div>`;
      this.placeProbe(el, false);
      this.drawLayer(el);
      U.$('#legend', el).innerHTML = LAYERS[this.state.layer].legend.map(([col, t]) => `<div><span class="dot" style="background:${col}"></span>${t}</div>`).join('');
    },
    placeProbe(el, show) {
      const pr = this.state.probe, w = U.$('#heat-wrap', el), probe = U.$('#probe', el), card = U.$('#probe-card', el);
      probe.style.left = pr.x * 100 + '%'; probe.style.top = pr.y * 100 + '%';
      probe.classList.remove('ping'); void probe.offsetWidth; if (show) probe.classList.add('ping');
      const v = E.probe(S.result(), pr.x, pr.y);
      card.innerHTML = `<div class="pc-h">Probe · ${U.len(pr.x * 120)} E, ${U.len(pr.y * 140)} S</div>
        <div class="pc-r"><span>Zone</span><b style="color:${v.zone === 'High Efficiency' ? 'var(--green)' : v.zone === 'Moderate' ? 'var(--amber)' : 'var(--red)'}">${v.zone}</b></div>
        <div class="pc-r"><span>Est. COP</span><b>${v.cop.toFixed(2)}</b></div><div class="pc-r"><span>Conductivity</span><b>${U.cond(v.k)}</b></div>
        <div class="pc-r"><span>Drillability</span><b>${Math.round(v.drill * 100)}%</b></div><div class="pc-r"><span>Water table</span><b>${U.len(v.water, 1)}</b></div>`;
      const left = pr.x > 0.62; card.style.left = left ? '' : `calc(${pr.x * 100}% + 70px)`; card.style.right = left ? `calc(${(1 - pr.x) * 100}% + 70px)` : '';
      card.style.top = `calc(${U.clamp(pr.y, 0.1, 0.8) * 100}% - 60px)`;
      card.classList.toggle('show', !!show || card.classList.contains('show'));
      if (w) w.classList.add('probed');
    },
    drawLayer(el) {
      const cv = U.$('#heat-cv', el), w = U.$('#heat-wrap', el); if (!cv || !w) return;
      const L = this.state.layer;
      const W = w.clientWidth, H = w.clientHeight; cv.width = Math.round(W / 6); cv.height = Math.round(H / 6);
      const ctx = cv.getContext('2d');
      if (L === 'thermal') { ctx.clearRect(0, 0, cv.width, cv.height); cv.style.opacity = 0; return; }
      const r = S.result(); const img = ctx.createImageData(cv.width, cv.height);
      for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
        const v = E.probe(r, x / cv.width, y / cv.height); let col;
        if (L === 'soil') { const t = U.clamp((v.k - 1.2) / 2.4, 0, 1); col = t > 0.6 ? [37, 99, 235] : t > 0.35 ? [34, 197, 94] : [234, 179, 8]; col = mix([234, 179, 8], [37, 99, 235], t); }
        else if (L === 'drill') { const t = v.drill; col = t > 0.85 ? [16, 185, 129] : t > 0.7 ? mix([245, 158, 11], [16, 185, 129], (t - 0.7) / 0.15) : mix([239, 68, 68], [245, 158, 11], t / 0.7); }
        else { const t = U.clamp((v.water - 2) / 16, 0, 1); col = mix([29, 78, 216], [224, 242, 254], t); }
        const i = (y * cv.width + x) * 4; img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0); cv.style.opacity = 1;
      U.$('#legend', el).innerHTML = LAYERS[L].legend.map(([col, t]) => `<div><span class="dot" style="background:${col}"></span>${t}</div>`).join('');
      function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
    }
  };

  /* ================= PROJECT SETUP ================= */
  GX.views['project-setup'] = {
    name: 'Building & Loads', header: { mode: 'step', step: 2, label: 'Building & Loads' },
    render(el) {
      const p = S.cur().project, known = p.loadMode !== 'calculated';
      const num = (id, v, attrs, dis) => `<input class="input num ps-in" id="${id}" type="number" value="${v}" ${attrs || ''} ${dis ? 'disabled' : ''} data-edit>`;
      const opt = (o, v) => Object.keys(o).map(k => `<option ${k === v ? 'selected' : ''}>${k}</option>`).join('');
      el.innerHTML = `
      <div class="cols3 setup-cols">
        <div class="col">
          <div class="card pad form-card hl-card"><div class="sec-t"><span>Current System &amp; Project ${GX.info('baseline')}</span></div>
            <div class="field"><label for="ps-base">Current heating &amp; cooling system</label><select class="select ps-in" id="ps-base" data-edit>${Object.entries(E.BASELINES).map(([k, b]) => `<option value="${k}" ${k === p.baseline ? 'selected' : ''}>${b.label}</option>`).join('')}</select><div class="fhint">Savings and payback are calculated against this system.</div></div>
            <div class="pair"><div class="field"><label for="ps-sector">Sector</label><select class="select ps-in" id="ps-sector" data-edit>${Object.entries(E.SECTOR).map(([k, x]) => `<option value="${k}" ${k === E.sectorOf(p) ? 'selected' : ''}>${x.label}</option>`).join('')}</select></div>
              <div class="field"><label for="ps-ptype">Project type</label><select class="select ps-in" id="ps-ptype" data-edit>${Object.entries(E.PROJECT_TYPES).map(([k, x]) => `<option value="${k}" ${k === (p.projectType || 'replace') ? 'selected' : ''}>${x.short}</option>`).join('')}</select></div></div>
          </div>
          <div class="card pad form-card"><div class="sec-t"><span>Building Information</span></div>
            <div class="field"><label for="ps-type">Building Type</label><select class="select ps-in" id="ps-type" data-edit>${opt(E.BUILDINGS, p.buildingType)}</select></div>
            <div class="pair"><div class="field"><label for="ps-area">Total Floor Area (${U.areaU()})</label>${num('ps-area', Math.round(U.areaV(p.floorArea)), 'min="1" step="100"')}</div><div class="field"><label for="ps-floors">Number of Floors</label>${num('ps-floors', p.floors, 'min="1" max="150"')}</div></div>
            <div class="pair"><div class="field"><label for="ps-vint">Construction / Envelope</label><select class="select ps-in" id="ps-vint" data-edit>${opt(E.VINTAGE, p.vintage)}</select></div><div class="field"><label for="ps-hours">Operating Schedule</label><select class="select ps-in" id="ps-hours" data-edit>${opt(E.HOURS, p.hours)}</select></div></div>
            <div class="field"><label for="ps-glz">Glazing Ratio</label><select class="select ps-in" id="ps-glz" data-edit>${opt(E.GLAZING, p.glazing)}</select></div>
          </div>
          <div class="card pad form-card"><div class="sec-t"><span>Energy Demand Profile ${GX.info('loads')}</span></div>
            <div class="seg" data-edit><button data-lm="calculated" class="${!known ? 'on' : ''}">Calculated</button><button data-lm="known" class="${known ? 'on' : ''}">Known (utility data)</button></div>
            <div class="pair"><div class="field"><label for="ps-heat">Heating Demand (kWh/y)</label>${num('ps-heat', p.heatDemand, 'min="0" step="10000"', !known)}</div><div class="field"><label for="ps-cool">Cooling Demand (kWh/y)</label>${num('ps-cool', p.coolDemand, 'min="0" step="10000"', !known)}</div></div>
            <div class="field"><label for="ps-peak">Peak Thermal Load (${U.powU()})</label>${num('ps-peak', Math.round(U.powV(p.peakLoad)), 'min="1" step="5"', !known)}</div>
            <div class="row" style="gap:16px;flex-wrap:wrap;justify-content:center">${known ? '<button class="link-btn" id="ps-csv" data-edit>Import 12-month utility CSV</button><button class="link-btn" id="ps-tpl">CSV template</button>' : '<span class="muted" style="font-size:12px">Degree-day method from building data and climate zone.</span>'}<input type="file" id="ps-file" accept=".csv,text/csv" hidden></div>
            <div class="load-cmp" id="ps-cmp"></div>
          </div>
          <div class="card pad form-card"><div class="sec-t"><span>Site & Environmental</span></div>
            <div class="pair"><div class="field"><label for="ps-zone">Climate Zone</label><input class="input" id="ps-zone" value="${esc(E.CLIMATE[p.zone].label)}" disabled title="Set on the Site page"></div>
              <div class="field"><label for="ps-ground">Ground Type</label><select class="select ps-in" id="ps-ground" data-edit style="background-color:#fff">${opt(E.GROUND, p.ground)}</select></div></div>
            <div class="pair"><div class="field"><label for="ps-depth">Drilling Depth Constraint (${U.lenU()})</label>${num('ps-depth', Math.round(U.lenV(p.depthLimit)), 'min="10" step="10"')}</div><div class="field"><label for="ps-site">Available Land (${U.areaU()})</label>${num('ps-site', Math.round(U.areaV(p.siteArea || 0)), 'min="0" step="100"')}</div></div>
          </div>
        </div>
        <div class="col mid"><div class="card preview-card">
          <div class="between pv-h"><h3 class="card-title">Real-Time Model Preview</h3><span class="sync" id="ps-sync"><span class="dot" style="background:var(--green)"></span>Model Synced</span></div>
          <div class="pv-stage" id="pv-stage"></div>
          <div class="pv-stats" id="pv-stats"></div>
        </div></div>
        <div class="col right"><div class="dark-card ai-sum" id="ai-sum"></div></div>
      </div>`;
      const map = { 'ps-base': 'baseline', 'ps-sector': 'sector', 'ps-ptype': 'projectType', 'ps-type': 'buildingType', 'ps-area': 'floorArea', 'ps-floors': 'floors', 'ps-heat': 'heatDemand', 'ps-cool': 'coolDemand', 'ps-peak': 'peakLoad', 'ps-ground': 'ground', 'ps-depth': 'depthLimit', 'ps-vint': 'vintage', 'ps-hours': 'hours', 'ps-glz': 'glazing', 'ps-site': 'siteArea' };
      const conv = { 'ps-area': U.areaIn, 'ps-site': U.areaIn, 'ps-depth': U.lenIn, 'ps-peak': U.powIn };
      const lim = { 'ps-area': [50, 1e6], 'ps-floors': [1, 150], 'ps-heat': [0, 5e7], 'ps-cool': [0, 5e7], 'ps-peak': [1, 50000], 'ps-depth': [30, 600], 'ps-site': [0, 1e7] };
      let tm;
      el.querySelectorAll('.ps-in').forEach(inp => {
        const commit = () => {
          if (!inp.isConnected) return;
          const key = map[inp.id]; let v = inp.value;
          if (inp.type === 'number') { v = parseFloat(v); if (conv[inp.id]) v = conv[inp.id](v); const [a, b] = lim[inp.id]; if (!isFinite(v) || v < a || v > b) { inp.classList.add('invalid'); U.toast(`Value out of range for ${inp.previousElementSibling ? inp.previousElementSibling.textContent : key}`, 'warn'); return; } inp.classList.remove('invalid'); v = Math.round(v * 100) / 100; }
          if (!GX.guard()) return;
          const sync = U.$('#ps-sync', el); sync.innerHTML = '<span class="dot" style="background:var(--amber)"></span>Syncing…';
          if (key === 'buildingType') { const sec = E.sectorOf({ buildingType: v }); S.setProject({ buildingType: v, sector: sec }); const ss = U.$('#ps-sector', el); if (ss) ss.value = sec; }
          else S.setProject({ [key]: v });
          S.log(`Project Setup: ${key} set to ${v}`, 'Config', 'Modified');
          this.syncLoads(el);
          setTimeout(() => { if (sync.isConnected) sync.innerHTML = '<span class="dot" style="background:var(--green)"></span>Model Synced'; }, 450);
        };
        inp.addEventListener('change', commit);
        if (inp.type === 'number') inp.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(commit, 700); });
      });
      el.querySelectorAll('[data-lm]').forEach(b => b.onclick = () => { if (!GX.guard()) return; S.setProject({ loadMode: b.dataset.lm }); S.log('Load mode: ' + b.dataset.lm, 'Config'); this.render(el); U.animateNumbers(el, {}); });
      const csv = U.$('#ps-csv', el), file = U.$('#ps-file', el), tpl = U.$('#ps-tpl', el);
      if (tpl) tpl.onclick = () => U.exportData('Utility data template', 'geothermx-utility-template.csv', 'month,heating_kwh,cooling_kwh\n' + E.MONTHS.map((m, i) => `${m},${Math.round(S.cur().project.heatDemand * E.HEAT_W[i])},${Math.round(S.cur().project.coolDemand * E.COOL_W[i])}`).join('\n'), 'text/csv');
      if (csv) csv.onclick = () => file.click();
      file.onchange = () => { const f = file.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => this.importCsv(el, String(rd.result)); rd.readAsText(f); file.value = ''; };
      this.paint(el);
    },
    importCsv(el, text) {
      if (!GX.guard()) return;
      const rows = text.split(/\r?\n/).map(l => l.split(/[,;\t]/).map(x => x.trim())).filter(r => r.length >= 3 && isFinite(parseFloat(r[1])) && isFinite(parseFloat(r[2])));
      if (rows.length < 1) { U.toast('No data rows found. Use columns: month, heating_kwh, cooling_kwh', 'err'); return; }
      const h = rows.reduce((a, r) => a + parseFloat(r[1]), 0), c = rows.reduce((a, r) => a + parseFloat(r[2]), 0);
      const scale = 12 / rows.length;
      const peakM = Math.max(...rows.map(r => Math.max(parseFloat(r[1]), parseFloat(r[2]))));
      S.setProject({ loadMode: 'known', heatDemand: Math.round(h * scale), coolDemand: Math.round(c * scale), peakLoad: Math.max(5, Math.round(peakM / 730 / 0.42 / 5) * 5) });
      S.log(`Imported utility data (${rows.length} months)`, 'Config', 'Success');
      U.toast(`Imported ${rows.length} months: heating <b>${U.n(h * scale / 1000)} MWh</b>, cooling <b>${U.n(c * scale / 1000)} MWh</b>${rows.length < 12 ? ' (annualized)' : ''}`);
      this.render(el); U.animateNumbers(el, {});
    },
    syncLoads(el) {
      const p = S.cur().project; const L = E.loadCalc(p);
      const set = (id, v) => { const x = U.$('#' + id, el); if (x && document.activeElement !== x) x.value = v; };
      if (p.loadMode === 'calculated') { set('ps-heat', p.heatDemand); set('ps-cool', p.coolDemand); set('ps-peak', Math.round(U.powV(p.peakLoad))); }
      const box = U.$('#ps-cmp', el); if (!box) return;
      const dev = p.loadMode === 'calculated' ? 0 : ((p.heatDemand + p.coolDemand) / Math.max(1, L.heat + L.cool) - 1) * 100;
      box.innerHTML = p.loadMode === 'calculated' ? `Peaks: <b>${U.pow(L.heatPeak)}</b> heating · <b>${U.pow(L.coolPeak)}</b> cooling · UA ${U.ua(L.UA)}` : `Calculated estimate: ${U.n(L.heat / 1000)} / ${U.n(L.cool / 1000)} MWh · known demand is <b class="${Math.abs(dev) > 30 ? 'amber' : ''}">${Math.abs(dev) < 0.5 ? 'within 1%' : U.signed(dev, 0, '%')}</b> of estimate${Math.abs(dev) > 30 ? ' · check inputs' : ''}`;
    },
    paint(el) {
      if (!U.$('#pv-stage', el)) return;
      this.syncLoads(el);
      const r = S.result(), c = S.cur(), p = c.project, d = c.design;
      const sim = E.simulate(p, d, S.state.settings, c.mitigation, { years: 1 });
      const floors = Math.min(p.floors, 40);
      const bh = 70 + Math.min(floors, 30) * 5.2, bw = 150;
      const lines = Math.min(d.n, 9), depthPx = 40 + Math.min(1, d.depth / 400) * 150;
      const by = 290 - bh;
      const win = []; for (let f = 0; f < Math.min(floors, 26); f++) { const y = by + 12 + f * ((bh - 24) / Math.max(1, Math.min(floors, 26))); win.push(`<rect x="${215 + 16}" y="${y.toFixed(1)}" width="${bw - 32}" height="${Math.max(2, (bh - 24) / Math.max(1, Math.min(floors, 26)) - 4).toFixed(1)}" rx="1" fill="#e2e8f0" opacity="${f < 2 ? 1 : .55}"/>`); }
      const pipes = []; for (let i = 0; i < lines; i++) { const x = 290 - (lines - 1) * 13 + i * 26; pipes.push(`<line x1="${x}" y1="304" x2="${x}" y2="${304 + depthPx}" stroke="url(#pg)" stroke-width="3" stroke-linecap="round" class="pipe" style="animation-delay:${i * 60}ms"/>`); }
      U.$('#pv-stage', el).innerHTML = `<svg viewBox="0 0 580 540" class="chart pv-svg"><defs><linearGradient id="pg" gradientUnits="userSpaceOnUse" x1="0" y1="304" x2="0" y2="${304 + depthPx}"><stop offset="0" stop-color="#14b8a6"/><stop offset="1" stop-color="#14b8a6" stop-opacity="0"/></linearGradient>
        <radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#f1f5f9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
        <circle cx="290" cy="270" r="250" fill="url(#glow)"/>
        <rect x="215" y="${by}" width="${bw}" height="${bh}" rx="3" fill="#cbd5e1" stroke="#94a3b8" stroke-width="2" class="bld"/>${win.join('')}
        <line x1="180" y1="295" x2="400" y2="295" stroke="#64748b" stroke-width="2"/>
        ${pipes.join('')}
        <text x="${290 + (lines - 1) * 13 + 22}" y="${304 + depthPx}" style="font-size:15px">${U.len(d.depth)}</text>
        <text x="${215 + bw + 14}" y="${by + 16}" style="font-size:15px">${p.floors} floors</text></svg>`;
      U.$('#pv-stats', el).innerHTML = `<div><span>Est. Boreholes</span><b>${U.count(d.n, 'n0', 'ps-n')}</b></div><div><span>Avg. Depth</span><b>${U.len(d.depth)}</b></div><div><span>System Type</span><b>${d.loop === 'open' ? 'Open Loop' : 'Closed Loop'}</b></div>`;
      const cfg = `${d.orient === 'vertical' ? 'Vertical' : 'Horizontal'} ${d.loop === 'open' ? 'Open-Loop (GWHP)' : 'Closed-Loop (GHE)'}`;
      const redund = ((r.ratio - 1) * 100);
      U.$('#ai-sum', el).innerHTML = `
        <div class="ai-sum-t">Project Summary</div>
        <div class="as-row"><div class="as-l">Recommended Configuration</div><div class="as-v">${cfg}</div></div>
        <div class="as-row"><div class="as-l">Efficiency Projection (COP)</div><div class="as-v teal">${U.count(r.SCOP, 'n2', 'ps-cop')} Avg / ${U.count(sim.maxCop, 'n1', 'ps-cpk')} Peak</div></div>
        <div class="as-row"><div class="as-l">Estimated CO₂ Offset</div><div class="as-v">${U.count(r.co2Saved, 'n0', 'ps-co2')} Tons / Year</div></div>
        <div class="as-row"><div class="as-l">Building Loads (${p.loadMode === 'calculated' ? 'calculated' : 'known demand'})</div><div class="as-v" style="font-size:15px">${U.n(p.heatDemand / 1000)} MWh heat · ${U.n(p.coolDemand / 1000)} MWh cool</div></div>
        <div class="as-row"><div class="as-l">Current energy cost (${esc(r.baseline.short)})</div><div class="as-v">${U.count(r.baselineCost, 'money', 'ps-bc')} / year</div></div>
        <div class="as-row"><div class="as-l">With geothermal</div><div class="as-v teal">${U.count(r.gshpCost, 'money', 'ps-gc')} / year</div></div>
        <div class="as-row" style="border:0"><div class="as-l">Initial CapEx Range</div><div class="as-v">${U.moneyK(r.capexLow)} — ${U.moneyK(r.capexHigh)}</div></div>
        <div class="as-quote">"Based on the ${U.n(p.coolDemand > p.heatDemand ? p.coolDemand / 1000 : p.heatDemand / 1000, 0)}MWh ${p.coolDemand > p.heatDemand ? 'cooling' : 'heating'} load and local ${esc(p.ground.toLowerCase().split(' /')[0])} conductivity, a ${d.n}-borehole array at ${U.len(d.depth)} depth provides the optimal ROI. System redundancy is calculated at ${redund.toFixed(0)}% to handle peak ${esc(r.loc.city.split(',')[0])} ${p.coolDemand > p.heatDemand ? 'summers' : 'winters'}."</div>`;
    },
    foot: () => `<button class="btn btn-ghost" data-go="site-intelligence">← Site</button><span class="spacer"></span><span class="note">All changes saved automatically</span><button class="btn btn-primary" data-go="system-design">Continue to Ground Loop →</button>`
  };

  /* ================= SYSTEM DESIGN ================= */
  GX.views['system-design'] = {
    name: 'Ground Loop', header: { mode: 'step', step: 3, label: 'Ground Loop' },
    state: { view: 'layout' },
    render(el) {
      el.innerHTML = `
      <div class="cols3 design-cols">
        <div class="col" id="sd-left"></div>
        <div class="col mid"><div class="cut-card" id="cut-card">
          <img src="assets/img/system-cutaway.jpg" alt="Cutaway of vertical closed-loop borefield under the building" id="cut-img" draggable="false">
          <div class="thermal-ov"></div>
          <div class="depth-svg" id="depth-svg"></div>
          <div class="cut-tabs">${[['layout', 'Layout View'], ['thermal', 'Thermal View'], ['depth', 'Depth Slice']].map(([k, l]) => `<button data-v="${k}" class="${this.state.view === k ? 'on' : ''}">${l}</button>`).join('')}</div>
          <div class="cut-info" id="cut-info"></div>
        </div></div>
        <div class="col right" id="sd-right"></div>
      </div>`;
      el.querySelectorAll('.cut-tabs button').forEach(b => b.onclick = () => { this.state.view = b.dataset.v; el.querySelectorAll('.cut-tabs button').forEach(x => x.classList.toggle('on', x === b)); this.paintCut(el); });
      this.paint(el);
    },
    paint(el, reason) {
      const r = S.result(), c = S.cur(), d = c.design, locked = c.locked;
      const dis = locked ? 'disabled' : '';
      const kv = (id, label, v, unit, step) => `<label class="kv-field" for="${id}"><span>${label}</span><span class="row" style="gap:0"><input id="${id}" class="sd-num num" type="number" value="${v}" step="${step}" ${dis} data-edit><span class="unit">${unit}</span><span class="step"><button type="button" data-inc="${id}" data-d="${step}" aria-label="Increase">▲</button><button type="button" data-inc="${id}" data-d="-${step}" aria-label="Decrease">▼</button></span></span></label>`;
      const focus = document.activeElement && document.activeElement.id;
      U.$('#sd-left', el).innerHTML = `
        ${locked ? '<div class="lock-note">🔒 Configuration locked. Unlock to edit.</div>' : ''}
        <div class="card pad sd-card"><h3 class="card-title">System Type Selection</h3>
          <div class="seg" style="margin-top:14px" data-edit>${['closed', 'open'].map(k => `<button data-loop="${k}" class="${d.loop === k ? 'on' : ''}" ${dis}>${k === 'closed' ? 'Closed Loop' : 'Open Loop'}</button>`).join('')}</div>
          <div class="seg" style="margin-top:12px" data-edit>${['vertical', 'horizontal'].map(k => `<button data-orient="${k}" class="${d.orient === k ? 'on' : ''}" ${dis}>${k === 'vertical' ? 'Vertical' : 'Horizontal'}</button>`).join('')}</div>
        </div>
        <div class="card pad sd-card"><h3 class="card-title">Borehole Configuration</h3><div class="kv-stack">
          ${kv('sd-n', 'Borehole Count', d.n, '', 1)}${kv('sd-depth', `Target Depth (${U.lenU()})`, +U.lenV(d.depth).toFixed(0), U.lenU(), U.imp() ? 25 : 10)}${kv('sd-sp', `Borehole Spacing (${U.lenU()})`, +U.lenV(d.spacing).toFixed(1), U.lenU(), U.imp() ? 1 : 0.5)}</div>
          <div class="sd-hint">Required loop length: <b>${U.len(r.Lreq)}</b> ${GX.info('loop')} · Installed: <b class="${r.ratio < 0.98 ? 'red' : 'green'}">${U.len(r.L)} (${(r.ratio * 100).toFixed(0)}%)</b><br>Reference check: <b class="${U.loopOk(r) ? 'green' : 'amber'}">${U.loopRatio(r)} ${U.loopOk(r) ? '✓' : '⚠'}</b> <span>typical ${U.loopRange()} for vertical closed loops</span>${!locked && Math.abs(r.ratio - 1.02) > 0.06 ? ` · <button class="link-btn" id="sd-auto" data-edit>Auto-size</button>` : ''}</div></div>
        <div class="card pad sd-card"><h3 class="card-title">Fluid & Flow Parameters</h3>
          <div class="field" style="margin-top:14px"><label for="sd-fluid">Fluid Medium</label><select class="select" id="sd-fluid" ${dis} data-edit style="background-color:#fff">${Object.keys(E.FLUIDS).map(f => `<option ${f === d.fluid ? 'selected' : ''}>${f}</option>`).join('')}</select></div>
          <div class="kv-stack" style="margin-top:10px">${kv('sd-flow', 'Flow per Loop', +U.flowV(d.flow).toFixed(U.imp() ? 1 : 2), U.flowU(), U.imp() ? 0.5 : 0.05)}</div></div>
        <div class="card pad sd-card"><h3 class="card-title">Building Load Calibration</h3><div class="kv-stack">
          ${kv('sd-hp', 'Heating Load (Peak)', +U.powV(d.heatPeak).toFixed(U.imp() ? 1 : 0), U.powU(), 5)}${kv('sd-cp', 'Cooling Load (Peak)', +U.powV(d.coolPeak).toFixed(U.imp() ? 1 : 0), U.powU(), 5)}</div></div>`;
      if (focus && U.$('#' + focus, el)) { const f = U.$('#' + focus, el); f.focus(); }
      const prev = c.prevEff;
      const stdr = S.scenarios().list[0].r; const imp = prev != null ? r.effScore - prev : r.effScore - stdr.effScore;
      const sugg = suggestions(r, c);
      U.$('#sd-right', el).innerHTML = `
        <div class="card pad"><h3 class="card-title">System Performance ${GX.info('cop')}</h3>
          <div class="sp-big">${U.count(r.SCOP, 'n2', 'sd-eff')} <small class="muted" style="font-size:13px;font-weight:600">SCOP</small></div>
          <div class="${imp >= 0 ? 'green' : 'red'} b" style="font-size:12.5px">${imp >= 0 ? '↑' : '↓'} ${Math.abs(imp * 0.05).toFixed(2)} COP ${prev != null ? 'vs previous' : 'vs standard design'}</div>
          <div class="kvs" style="margin-top:12px"><div class="between"><span class="muted">COP heating / cooling</span><b>${r.COPh.toFixed(2)} / ${r.COPc.toFixed(2)}</b></div></div>
          <div class="kvs"><div class="between"><span class="muted">Energy Output</span><b>${U.count(r.annualOutput, 'n0', 'sd-out')} MWh/a</b></div><div class="between"><span class="muted">Stability Score</span><b style="color:${r.stability > 0.85 ? 'var(--green)' : r.stability > 0.7 ? 'var(--amber)' : 'var(--red)'}">${r.stability > 0.85 ? 'High' : r.stability > 0.7 ? 'Medium' : 'Low'} (${r.stability.toFixed(2)})</b></div></div></div>
        <div class="card pad"><h3 class="card-title">OPEX / CAPEX Estimation ${GX.info('capex')}</h3>
          <div class="kvs"><div class="between"><span>Drilling Cost</span><b>${U.count(r.drilling, 'money', 'sd-dc')}</b></div><div class="between"><span>Equipment Cost</span><b>${U.count(r.equipment, 'money', 'sd-ec')}</b></div><div class="between muted" style="font-size:12.5px"><span>Annual OPEX</span><span>${U.money(r.gshpCost)}/yr</span></div></div>
          <div class="between"><span class="muted">Integration</span><b class="muted">${U.money(r.integration)}</b></div><div class="between tot"><span>Total CAPEX</span><b class="teal6">${U.count(r.capex, 'money', 'sd-tot')}</b></div></div>
        <div class="card pad"><h3 class="card-title">Recommendations</h3><div class="sugg-list">${sugg.map((s, i) => `<button class="insight bar sugg" data-sg="${i}" ${s.patch && !locked ? '' : 'data-static="1"'}><b>${s.k}:</b> ${esc(s.t)}${s.patch && !locked ? '<span class="apply">Apply</span>' : ''}</button>`).join('')}</div></div>
        <div class="card pad"><h3 class="card-title">Risk Analysis</h3><div class="risk-rows">
          ${[['Overheating Risk', r.risk.levels.overheating], ['Efficiency Drop', r.risk.levels.effDrop], ['Load Imbalance', r.risk.levels.imbalance]].map(([k, l]) => `<div class="between"><span>${k}</span><span class="row" style="gap:7px"><span class="dot" style="background:${lvlColor(l)}"></span>${l}</span></div>`).join('')}</div></div>`;
      // bind
      const ids = { 'sd-n': 'n', 'sd-depth': 'depth', 'sd-sp': 'spacing', 'sd-flow': 'flow', 'sd-hp': 'heatPeak', 'sd-cp': 'coolPeak' };
      const lim = { n: [1, 600], depth: [10, 600], spacing: [3, 15], flow: [0.1, 3], heatPeak: [1, 50000], coolPeak: [1, 50000] };
      const cin = { depth: U.lenIn, spacing: U.lenIn, heatPeak: U.powIn, coolPeak: U.powIn, flow: U.flowIn };
      const commit = (id, val) => {
        const k = ids[id]; let v = parseFloat(val); const [a, b] = lim[k];
        if (!isFinite(v)) return; if (cin[k]) v = cin[k](v); v = U.clamp(v, a, b); if (k === 'n') v = Math.round(v); else v = +v.toFixed(2);
        if (k === 'depth' && v > c.project.depthLimit) { U.toast(`Depth exceeds the ${U.len(c.project.depthLimit)} drilling constraint`, 'warn'); v = c.project.depthLimit; }
        if (!GX.guard()) return;
        S.setDesign({ [k]: v }); S.log(`System Design: ${k} = ${v}`, 'Config', 'Modified');
      };
      Object.keys(ids).forEach(id => { const inp = U.$('#' + id, el); if (inp) inp.addEventListener('change', () => commit(id, inp.value)); });
      el.querySelectorAll('[data-inc]').forEach(b => b.onclick = e => { e.preventDefault(); const inp = U.$('#' + b.dataset.inc, el); if (inp.disabled) return; commit(b.dataset.inc, parseFloat(inp.value) + parseFloat(b.dataset.d)); });
      el.querySelectorAll('[data-loop]').forEach(b => b.onclick = () => { if (GX.guard() && !locked) { S.setDesign({ loop: b.dataset.loop }); S.log('Loop type: ' + b.dataset.loop, 'Config'); } });
      el.querySelectorAll('[data-orient]').forEach(b => b.onclick = () => { if (GX.guard() && !locked) { S.setDesign({ orient: b.dataset.orient }); S.log('Orientation: ' + b.dataset.orient, 'Config'); } });
      const fl = U.$('#sd-fluid', el); if (fl) fl.onchange = () => { if (GX.guard()) { S.setDesign({ fluid: fl.value }); S.log('Fluid: ' + fl.value, 'Config'); } };
      const au = U.$('#sd-auto', el); if (au) au.onclick = () => { if (!GX.guard()) return; const n = Math.max(1, Math.ceil(r.Lreq * 1.02 / d.depth)); S.setDesign({ n }); U.toast(`Borehole count auto-sized to <b>${n}</b>`); };
      el.querySelectorAll('[data-sg]').forEach(b => b.onclick = () => { const s = sugg[+b.dataset.sg]; if (!s.patch || locked || !GX.guard()) return; S.setDesign(s.patch, 'ai'); S.log('AI suggestion applied: ' + s.k, 'Intelligence', 'Completed'); U.toast(`${s.k} suggestion applied`); });
      this.paintCut(el);
    },
    paintCut(el) {
      const r = S.result(), d = S.cur().design, v = this.state.view;
      const card = U.$('#cut-card', el); card.dataset.view = v;
      U.$('#cut-info', el).innerHTML = `<div class="between"><span>Boreholes</span><b>${d.n} Units</b></div><div class="between"><span>Effective Depth</span><b>${U.len(d.depth, 1)}</b></div><div class="between"><span>System Type</span><b>${d.loop === 'open' ? 'Open' : 'Closed'}-${d.orient === 'vertical' ? 'Vertical' : 'Horizontal'}</b></div><div class="between"><span>Seasonal COP</span><b>${r.SCOP.toFixed(2)}</b></div>`;
      if (v === 'depth') U.$('#depth-svg', el).innerHTML = depthSlice(r, d);
    },
    foot: () => {
      const locked = S.cur().locked;
      return `<button class="btn btn-ghost" data-go="project-setup">← Building &amp; Loads</button><span class="spacer"></span><button class="btn btn-ghost" id="sd-export">Export Specs</button><button class="btn btn-dark" data-go="drilling-optimization">Borefield &amp; drilling →</button><button class="btn btn-primary" id="sd-lock" data-edit>${locked ? '🔓 Unlock Configuration' : 'Save &amp; Lock Configuration'}</button>`;
    }
  };
  document.addEventListener('click', e => {
    if (e.target.closest('#sd-lock')) { if (!GX.guard()) return; const v = !S.cur().locked; S.setLocked(v); S.log(v ? 'Configuration saved & locked' : 'Configuration unlocked', 'Config', v ? 'Success' : 'Modified'); U.toast(v ? 'Configuration saved and locked' : 'Configuration unlocked'); }
    if (e.target.closest('#sd-export')) {
      const r = S.result(), c = S.cur(), d = c.design;
      const rows = [['Parameter', 'Value', 'Unit'], ['Project', c.project.name, ''], ['System type', `${d.loop}-${d.orient}`, ''], ['Borehole count', d.n, ''], ['Target depth', +U.lenV(d.depth).toFixed(0), U.lenU()], ['Spacing', +U.lenV(d.spacing).toFixed(1), U.lenU()], ['Total loop length', Math.round(U.lenV(r.L)), U.lenU()], ['Required loop length', Math.round(U.lenV(r.Lreq)), U.lenU()], ['Fluid', d.fluid, ''], ['Flow per loop', +U.flowV(d.flow).toFixed(2), U.flowU()], ['Heating peak', +U.powV(d.heatPeak).toFixed(1), U.powU()], ['Cooling peak', +U.powV(d.coolPeak).toFixed(1), U.powU()], ['Heating COP', r.COPh.toFixed(2), ''], ['Cooling COP', r.COPc.toFixed(2), ''], ['Seasonal COP', r.SCOP.toFixed(2), ''], ['Entering water temp (heating)', U.tempV(r.EWTh).toFixed(1), U.tempU()], ['Entering water temp (cooling)', U.tempV(r.EWTc).toFixed(1), U.tempU()], ['Ground drift', (r.drift * (U.imp() ? 1.8 : 1)).toFixed(3), U.tempU() + '/yr'], ['Drilling cost', Math.round(r.drilling), 'USD'], ['Equipment cost', Math.round(r.equipment), 'USD'], ['Total CAPEX', Math.round(r.capex), 'USD']];
      U.exportData('System specification', `${c.project.ref}-system-spec.csv`, U.csv(rows), 'text/csv');
      S.log('Exported system specification', 'Config', 'Success');
    }
  });
  function suggestions(r, c) {
    const d = c.design, out = [];
    const deeper = Math.min(c.project.depthLimit, d.depth + 10);
    if (deeper > d.depth) { const w = GX.whatIf({ depth: deeper }); out.push({ k: 'Efficiency', t: `Increase borehole depth by ${U.len(deeper - d.depth)} to gain ${U.signed((w.stability - r.stability) / r.stability * 100, 1, '%')} thermal stability.`, patch: { depth: deeper } }); }
    else out.push({ k: 'Efficiency', t: `Depth is at the ${U.len(c.project.depthLimit)} constraint; add ${Math.max(1, Math.ceil(r.Lreq * 1.04 / d.depth) - d.n)} boreholes for margin instead.`, patch: { n: Math.max(d.n + 1, Math.ceil(r.Lreq * 1.04 / d.depth)) } });
    const opt = E.optimize(c.project, d, S.state.settings, c.mitigation, { keepFlow: true }).design;
    if (Math.abs(opt.spacing - d.spacing) >= 0.3) out.push({ k: 'Spatial', t: `${opt.spacing < d.spacing ? 'Reduce' : 'Increase'} spacing to ${U.len(opt.spacing, 1)} to optimize footprint vs thermal interference.`, patch: { spacing: opt.spacing } });
    else out.push({ k: 'Spatial', t: `Spacing of ${U.len(d.spacing, 1)} balances footprint (${U.area(r.footprint)}) and thermal interference.` });
    if (d.loop === 'closed') out.push({ k: 'Looping', t: `Closed loop is recommended for the current ${c.project.ground.split(' /')[0]} soil profile.` });
    else out.push({ k: 'Looping', t: 'Open loop needs a groundwater permit and water-quality testing; closed loop lowers hydrology risk.', patch: { loop: 'closed' } });
    return out;
  }
  function depthSlice(r, d) {
    const W = 490, H = 900, top = 120, maxD = Math.max(400, d.depth + 40), sc = (H - top - 40) / maxD;
    const x0 = 170, x1 = W - 70;
    const layers = [['Topsoil / overburden', 0, 6, '#a8875f'], [r.g.layer.replace(/^\w/, m => m.toUpperCase()) + ' (assumed uniform)', 6, maxD, '#bfa285']];
    const n = Math.min(d.n, 10);
    const bores = []; for (let i = 0; i < n; i++) { const x = n === 1 ? (x0 + x1) / 2 : x0 + i * ((x1 - x0) / (n - 1)); bores.push(`<line x1="${x}" y1="${top}" x2="${x}" y2="${top + d.depth * sc}" stroke="#0f172a" stroke-width="3"/><line x1="${x}" y1="${top}" x2="${x}" y2="${top + d.depth * sc}" stroke="#14b8a6" stroke-width="1.5" stroke-dasharray="6 4" class="flow-dash"/>`); }
    const ticks = []; for (let m = 0; m <= maxD; m += 50) ticks.push(`<line x1="${W - 54}" x2="${W - 46}" y1="${top + m * sc}" y2="${top + m * sc}" stroke="#334155"/><text x="${W - 42}" y="${top + m * sc + 4}" style="fill:#fff;font-size:11px;font-weight:600;paint-order:stroke;stroke:rgba(15,23,42,.45);stroke-width:2.5px">${U.len(m).replace(' ', '')}</text>`);
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" class="chart" style="height:100%">
      <rect width="${W}" height="${top}" fill="#f1f5f9"/>
      ${layers.map(l => `<rect x="0" y="${top + l[1] * sc}" width="${W}" height="${(Math.min(l[2], maxD) - l[1]) * sc}" fill="${l[3]}"/>${l[2] - l[1] > 20 ? `<text x="14" y="${top + l[1] * sc + 20}" style="fill:#fff;font-size:12px;font-weight:600;paint-order:stroke;stroke:rgba(0,0,0,.3);stroke-width:2.5px">${l[0]}</text><text x="14" y="${top + l[1] * sc + 36}" style="fill:#fff;font-size:10.5px;opacity:.85">${U.len(l[1])}–${U.len(Math.min(l[2], maxD))}</text>` : ''}`).join('')}
      ${bores.join('')}${d.n > n ? `<text x="${x1}" y="${top - 8}" text-anchor="end" style="fill:#64748b;font-size:11px">showing ${n} of ${d.n}</text>` : ''}
      <line x1="0" x2="${W}" y1="${top + d.depth * sc}" y2="${top + d.depth * sc}" stroke="#ef4444" stroke-dasharray="5 5"/><text x="${(x0 + x1) / 2}" y="${top + d.depth * sc + 22}" text-anchor="middle" style="fill:#fff;font-size:12px;font-weight:700;paint-order:stroke;stroke:#ef4444;stroke-width:3px">Target ${U.len(d.depth)} · ${d.n} boreholes @ ${U.len(d.spacing, 1)}</text>
      ${ticks.join('')}
      <text x="${W / 2}" y="${top - 40}" text-anchor="middle" style="fill:#0f172a;font-size:13px;font-weight:600">Assumed profile · ground ${U.temp(r.c.tg)} · k = ${U.cond(r.g.k)}</text></svg>`;
  }

  /* ================= DRILLING OPTIMIZATION ================= */
  GX.views['drilling-optimization'] = {
    name: 'Borefield & drilling', header: { mode: 'step', step: 3, label: 'Ground Loop' },
    render(el) {
      el.innerHTML = `<div class="drill-grid">
        <div class="drill-left">
          <div class="card drill-ctl" id="drill-ctl"></div>
          <div class="card soil-card" id="soil-wrap"><img src="assets/img/drilling-soil.jpg" alt="Soil profile with borehole thermal field" draggable="false"><canvas id="soil-cv"></canvas><div class="soil-dots" id="soil-dots"></div>
            <div class="legend soil-leg"><div><span class="dot" style="background:var(--teal-500)"></span>Borehole</div><div><span class="grad-sw"></span>Heat Efficiency</div></div></div>
          <div class="card pad" id="cmp-card"></div>
        </div>
        <div class="drill-right" id="drill-right"></div></div>`;
      this.paint(el);
      const ro = new ResizeObserver(() => this.drawSoil(el)); ro.observe(U.$('#soil-wrap', el)); this._ro = ro;
    },
    unmount() { if (this._ro) this._ro.disconnect(); },
    calc() {
      const c = S.cur(), st = c.drill;
      const best = E.optimize(c.project, c.design, S.state.settings, c.mitigation);
      let d, r;
      if (st.auto) { d = best.design; r = best.result; }
      else { d = Object.assign({}, c.design, { n: st.n, depth: st.depth, spacing: best.design.spacing, flow: 0.95 }); r = E.compute(c.project, d, S.state.settings, c.mitigation); }
      const base = S.result();
      return { d, r, best, base };
    },
    paint(el) {
      const c = S.cur(), st = c.drill, k = this.calc(); this._k = k;
      const { d, r, base } = k;
      U.$('#drill-ctl', el).innerHTML = `<div class="row" style="gap:12px"><span class="b" style="font-size:14px">Auto-Optimization</span><button class="toggle ${st.auto ? 'on' : ''}" id="do-auto" aria-pressed="${st.auto}" aria-label="Auto-optimization" data-edit></button></div>
        <label class="row ctl-in" for="do-n"><span>Boreholes</span><input id="do-n" class="input num" type="number" min="1" value="${d.n}" ${st.auto ? 'disabled' : ''} data-edit></label>
        <label class="row ctl-in" for="do-d"><span>Depth (${U.lenU()})</span><input id="do-d" class="input num" type="number" min="30" step="10" value="${Math.round(U.lenV(d.depth))}" ${st.auto ? 'disabled' : ''} data-edit></label>
        <button class="btn btn-outline" id="do-recalc" style="height:32px">Recalculate</button>`;
      const thermalOut = r.capacityC;
      const tBase = base.capacityC;
      const effLabel = r.effScore > 90 ? ['Optimal Range', 'var(--green)'] : r.effScore > 80 ? ['Acceptable', 'var(--amber)'] : ['Below Target', 'var(--red)'];
      const L = r.L;
      U.$('#drill-right', el).innerHTML = `
        <div class="card pad dr-card"><h3 class="card-title">Optimal Configuration</h3>
          <div class="dr-kv"><span>Borehole Count</span><b>${U.count(d.n, 'n0', 'do-n')}</b></div><div class="dr-kv"><span>Target Depth</span><b>${U.count(U.lenV(d.depth), 'n0', 'do-dp')} <small>${U.lenU()}</small></b></div><div class="dr-kv"><span>Grid Spacing</span><b>${U.count(U.lenV(d.spacing), 'n1', 'do-sp')} <small>${U.lenU()}</small></b></div></div>
        <div class="card pad dr-card"><h3 class="card-title">System Performance</h3>
          <div class="dr-kv tall"><span>Seasonal COP ${GX.info('cop')}</span><div style="text-align:right"><b style="color:var(--green)">${U.count(r.SCOP, 'n2', 'do-eff')}</b><div class="b" style="font-size:12px;color:${effLabel[1]}">${effLabel[0]}</div></div></div>
          <div class="dr-kv tall"><span>Thermal Output</span><div style="text-align:right"><b>${U.count(U.powV(thermalOut), 'n0', 'do-to')} <small>${U.powU()}</small></b><div class="${thermalOut >= tBase ? 'green' : 'amber'} b" style="font-size:12px">${U.signed((thermalOut / tBase - 1) * 100, 0, '%')} vs Current Design</div></div></div></div>
        <div class="card pad dr-card"><h3 class="card-title">Financial Outlook</h3>
          <div class="dr-kv"><span>Drilling Cost</span><b>${U.count(r.drilling, 'money', 'do-dc')}</b></div><div class="dr-kv"><span>Est. Payback</span><b>${r.paybackYears >= 25 ? '&gt;25' : U.count(r.paybackYears, 'n1', 'do-pb')} <small>Years</small></b></div></div>
        <div class="card pad dr-card"><h3 class="card-title">Design Insights</h3><div class="dr-ins">
          <div class="ins-box"><b>✦ Thermal Plume Mitigation</b><span>${d.spacing >= 7 ? `Spacing of ${U.len(d.spacing, 1)} keeps thermal interference between boreholes low (${Math.round((1 - r.fsp) * 100)}% overlap penalty).` : `Spacing of ${U.len(d.spacing, 1)} gives a ${Math.round((1 - r.fsp) * 100)}% interference penalty; widening to 7 m+ reduces long-term heat build-up.`}</span></div>
          <div class="ins-box"><b>✦ Geologic Sync</b><span>Depth finalized at ${U.len(d.depth)} for ${esc(r.g.layer)} (k = ${U.cond(r.g.k)}) as set on the Site page.</span></div>
          <div class="ins-box"><b>✦ ROI Maximization</b><span>${d.n} boreholes (${U.len(L)} loop, ${U.loopRatio(r)}) provide the ideal balance between CAPEX and long-term COP efficiency.</span></div></div></div>`;
      U.$('#do-auto', el).onclick = () => { if (!GX.guard()) return; S.setDrill({ auto: !st.auto, n: d.n, depth: d.depth }); this.paint(el); U.animateNumbers(el, {}); };
      U.$('#do-recalc', el).onclick = () => {
        const n = Math.max(1, Math.round(+U.$('#do-n', el).value || d.n)), dep = U.clamp(Math.round(U.lenIn(+U.$('#do-d', el).value || U.lenV(d.depth)) / 10) * 10, 30, c.project.depthLimit);
        const before = {}; U.$$('[data-key]', el).forEach(x => before[x.dataset.key] = parseFloat(x.dataset.count));
        if (!st.auto) S.setDrill({ n, depth: dep });
        const btn = U.$('#do-recalc', el); btn.innerHTML = '<span class="spin"></span>';
        setTimeout(() => { this.paint(el); U.animateNumbers(el, before); U.toast(st.auto ? 'Optimizer re-ran across 400+ depth/spacing combinations' : `Recalculated for ${n} × ${U.len(dep)}`); }, 450);
      };
      const cm = GX.complianceHtml(false);
      U.$('#cmp-card', el).innerHTML = `<div class="between"><h3 class="card-title">Safety, Permits &amp; Compliance</h3><span class="row" style="gap:8px"><span class="pill green" style="text-transform:none">${cm.counts.pass} passed</span>${cm.counts.issues ? `<span class="pill red" style="text-transform:none">${cm.counts.issues} issue(s)</span>` : ''}<span class="pill gray" style="text-transform:none">${cm.counts.actions} open actions</span></span></div><p class="muted" style="font-size:12.5px;margin:8px 0 4px">Preliminary checklist based on common U.S. practice. Click ○ to mark an action complete. Always confirm state and local requirements.</p>${cm.html}`;
      this.drawSoil(el);
    },
    drawSoil(el) {
      const k = this._k; if (!k) return;
      const wrap = U.$('#soil-wrap', el), cv = U.$('#soil-cv', el); if (!wrap) return;
      const W = wrap.clientWidth, H = wrap.clientHeight; cv.width = W; cv.height = H;
      const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, W, H);
      const r = k.r, d = k.d;
      const load = U.clamp(r.utilization, 0.5, 1.4);
      const g = ctx.createRadialGradient(W * 0.48, H * 0.52, 10, W * 0.48, H * 0.52, W * 0.45 * (0.7 + 0.3 * load));
      g.addColorStop(0, `rgba(239,68,68,${0.25 * load})`); g.addColorStop(0.6, `rgba(245,158,11,${0.12 * load})`); g.addColorStop(1, 'rgba(20,184,166,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const ty = 0.1 * H + Math.min(1, d.depth / Math.max(200, S.cur().project.depthLimit)) * 0.82 * H;
      ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, ty); ctx.lineTo(W, ty); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = '600 12px Inter, system-ui, sans-serif'; ctx.fillStyle = '#0f172a'; const label = `Target depth ${U.len(d.depth)}`; const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillRect(W - tw - 30, ty - 24, tw + 16, 20); ctx.fillStyle = '#0f172a'; ctx.fillText(label, W - tw - 22, ty - 10);
      const shown = Math.min(d.n, 24); const cols = shown > 12 ? 4 : shown > 6 ? 3 : 2; const rows = Math.ceil(shown / cols);
      const dots = []; for (let i = 0; i < shown; i++) { const cc = i % cols, rr = Math.floor(i / cols); const x = 12 + (cc + 0.5) * (76 / cols) + (rr % 2 ? 4 : 0); const y = 14 + (rr + 0.5) * (Math.max(30, (ty / H * 100) - 14) / rows); dots.push(`<i style="left:${x}%;top:${y}%;animation-delay:${i * 30}ms" data-tip="Borehole ${String(i + 1).padStart(2, '0')} · ${U.len(d.depth)} · ${(cc > 0 && cc < cols - 1 && rr > 0 && rr < rows - 1) ? 'interior' : 'perimeter'} · ~${(r.qh * d.depth / 1000 * ((cc > 0 && cc < cols - 1 && rr > 0 && rr < rows - 1) ? 0.93 : 1.04) * (U.imp() ? 3.412 : 1)).toFixed(1)} ${U.imp() ? 'kBtu/h' : 'kW'} extraction (model)"></i>`); }
      U.$('#soil-dots', el).innerHTML = dots.join('') + (d.n > shown ? `<span class="more">+${d.n - shown} more</span>` : '');
      U.bindTips(U.$('#soil-dots', el));
    },
    foot: () => `<span class="spacer"></span><button class="btn btn-ghost" data-go="system-design">Back</button><button class="btn btn-ghost" id="do-apply" data-edit>Apply to design</button><button class="btn btn-accent" data-go="simulation-lab">Long-term simulation →</button>`
  };
  document.addEventListener('click', e => {
    if (!e.target.closest('#do-apply')) return;
    if (!GX.guard()) return; const v = GX.views['drilling-optimization']; const k = v._k; if (!k) return;
    if (S.cur().locked) { U.toast('Ground loop design is locked. Unlock it to apply a new configuration.', 'warn'); return; }
    S.setDesign({ n: k.d.n, depth: k.d.depth, spacing: k.d.spacing, flow: k.d.flow }); S.log(`Applied drilling plan ${k.d.n} × ${U.len(k.d.depth)} @ ${U.len(k.d.spacing, 1)}`, 'Config', 'Success');
    U.toast(`Applied <b>${k.d.n} × ${U.len(k.d.depth)}</b> at ${U.len(k.d.spacing, 1)} spacing to the ground loop design`);
  });
})();
