/* GeoThermX shared features: units, plans & gating, roadmap phases, lifecycle, methodology, compliance */
(function () {
  'use strict';
  const U = window.GXUI, S = window.GXStore, E = window.GXEngine;
  const GX = window.GX = window.GX || {}; GX.views = GX.views || {};

  /* ---------- Units (data stored metric; display converts) ---------- */
  const imp = () => S.state.settings.units === 'imperial';
  const fx = (v, d) => Number(v).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
  U.imp = imp;
  U.len = (m, d) => imp() ? fx(m * 3.28084, d || 0) + ' ft' : fx(m, d || 0) + ' m';
  U.lenV = m => imp() ? m * 3.28084 : m;
  U.lenIn = v => imp() ? v / 3.28084 : v;
  U.lenU = () => imp() ? 'ft' : 'm';
  U.area = (m2, d) => imp() ? fx(m2 * 10.7639, d || 0) + ' ft²' : fx(m2, d || 0) + ' m²';
  U.areaV = m2 => imp() ? m2 * 10.7639 : m2;
  U.areaIn = v => imp() ? v / 10.7639 : v;
  U.areaU = () => imp() ? 'ft²' : 'm²';
  U.temp = (c, d) => imp() ? fx(c * 9 / 5 + 32, d == null ? 1 : d) + '°F' : fx(c, d == null ? 1 : d) + '°C';
  U.dT = (c, d) => imp() ? fx(c * 9 / 5, d == null ? 1 : d) + '°F' : fx(c, d == null ? 1 : d) + '°C';
  U.pow = (kw, d) => imp() ? fx(kw / 3.517, d == null ? 0 : d) + ' tons' : fx(kw, d == null ? 0 : d) + ' kW';
  U.powV = kw => imp() ? kw / 3.517 : kw;
  U.powIn = v => imp() ? v * 3.517 : v;
  U.powU = () => imp() ? 'tons' : 'kW';
  U.cond = k => imp() ? fx(k * 0.5779, 2) + ' Btu/h·ft·°F' : fx(k, 1) + ' W/m·K';
  U.loopRatio = r => imp() ? `${fx(r.ftPerTon, 0)} ft/ton` : `${fx(r.mPerKw, 1)} m/kW`;
  U.flow = (ls, d) => imp() ? fx(ls * 15.850, d == null ? 1 : d) + ' gpm' : fx(ls, d == null ? 2 : d) + ' L/s';
  U.flowV = ls => imp() ? ls * 15.850 : ls;
  U.flowIn = v => imp() ? v / 15.850 : v;
  U.flowU = () => imp() ? 'gpm' : 'L/s';
  U.pres = (bar, d) => imp() ? fx(bar * 14.504, d == null ? 1 : d) + ' psi' : fx(bar, d == null ? 2 : d) + ' bar';
  U.condV = k => imp() ? k * 0.5779 : k;
  U.condIn = v => imp() ? v / 0.5779 : v;
  U.condU = () => imp() ? 'Btu/h·ft·°F' : 'W/m·K';
  U.perLen = (usdPerM, d) => imp() ? '$' + fx(usdPerM / 3.28084, d == null ? 0 : d) + '/ft' : '$' + fx(usdPerM, d == null ? 0 : d) + '/m';
  U.perPow = (usdPerKw, d) => imp() ? '$' + fx(usdPerKw * 3.517, d == null ? 0 : d) + '/ton' : '$' + fx(usdPerKw, d == null ? 0 : d) + '/kW';
  U.perPowV = v => imp() ? v * 3.517 : v;
  U.perPowIn = v => imp() ? v / 3.517 : v;
  U.perPowU = () => imp() ? '$/ton' : '$/kW';
  U.wpm = (w, d) => imp() ? fx(w * 1.0400, d == null ? 1 : d) + ' Btu/h·ft' : fx(w, d == null ? 1 : d) + ' W/m';
  U.ua = kwk => imp() ? fx(kwk * 1895.6, 0) + ' Btu/h·°F' : fx(kwk, 1) + ' kW/K';
  U.dTyr = (c, d) => U.dT(c, d) + '/yr';
  U.tempU = () => imp() ? '°F' : '°C';
  U.tempV = c => imp() ? c * 9 / 5 + 32 : c;
  U.tempIn = v => imp() ? (v - 32) * 5 / 9 : v;
  U.dd = v => imp() ? U.n(Math.round(v * 1.8)) : U.n(v);   // degree-days: °F-days (base 65°F) or °C-days (base 18°C)
  U.ddBase = () => imp() ? 'base 65°F' : 'base 18°C';
  U.loopRange = () => imp() ? '130–250 ft/ton' : '11–22 m/kW';
  U.loopOk = r => r.ftPerTon >= 130 && r.ftPerTon <= 250;

  /* ---------- Workspace (no plan gating) ---------- */
  GX.plan = () => ({ name: 'Workspace', projects: Infinity, liveMonitoring: true });
  GX.isLocked = () => false;

  /* ---------- Lifecycle ---------- */
  GX.STAGES = { assessment: ['Assessment', 'amber'], design: ['Design', 'blue'], deployed: ['Operational', 'green'] };
  GX.stage = () => S.cur().project.stage || 'design';
  GX.deployed = () => GX.stage() === 'deployed';
  GX.isSample = () => !!(S.cur() && S.cur().project.sample);
  GX.stagePill = st => { const s = GX.STAGES[st || GX.stage()]; return `<span class="pill ${s[1]}" style="text-transform:none">${s[0]}</span>`; };
  GX.demoTag = (txt) => !GX.isSample() ? '' : `<span class="demo-tag" title="Sample project with example operating data.">${txt || 'Sample data'}</span>`;

  GX.notDeployed = (title, text) => `<div class="card empty-state">
      <div class="es-ico">⏻</div><h2>${title}</h2><p class="muted">${text}</p>
      <div class="row" style="gap:12px;justify-content:center;flex-wrap:wrap;margin-top:8px">
        <button class="btn btn-ghost" data-go="financial-analysis">Review financials</button>
        <button class="btn btn-accent" id="es-deploy" data-edit>Mark system as installed</button>
        ${S.state.projects.sample ? '' : '<button class="btn btn-ghost" data-load-sample="1">Load sample projects</button>'}</div>
      <div class="muted" style="font-size:12px;margin-top:16px">Current stage: ${GX.stagePill()}</div></div>`;
  GX.deploy = () => {
    if (!GX.guard()) return;
    U.modal({ title: 'Mark system as installed & commissioned', body: `<p style="margin:0;line-height:1.55">This moves <b>${U.esc(S.cur().project.name)}</b> to the <b>Operational</b> stage and turns on Monitoring, Alerts and operational risk tracking. The current design is saved to the calculation history.</p><div class="insight">Live values come from sensors / BMS once integrated. Until then the platform shows a simulated feed labelled “Demo data”.</div>`,
      actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Confirm installation', kind: 'accent', onClick: () => { S.snapshot('Commissioned design'); S.setStage('deployed'); S.log('Project moved to Operational stage', 'System', 'Success'); U.toast('Project is now <b>Operational</b>. Monitoring enabled.'); GX.go('monitoring'); } }] });
  };
  document.addEventListener('click', e => {
    if (e.target.closest('#es-deploy')) GX.deploy();
    const d = e.target.closest('[data-load-sample]'); if (d) { S.loadSample(); if (GX.track) GX.track('samples-loaded'); U.toast('3 sample projects added: office, home and school. Your own projects are unchanged.'); GX.go('dashboard'); }
    const i = e.target.closest('[data-explain]'); if (i) { e.preventDefault(); e.stopPropagation(); GX.explain(i.dataset.explain); }
    const up = e.target.closest('[data-upgrade]'); if (up) GX.go('preferences');
  });



  /* ---------- Methodology: "How is this calculated?" ---------- */
  GX.pb = y => (!isFinite(y) || y >= 25) ? 'over 25' : (+y).toFixed(1);
  GX.info = key => `<button class="info-btn" data-explain="${key}" aria-label="How is this calculated?" title="How is this calculated?">i</button>`;
  GX.explain = key => {
    const r = S.result(), c = S.cur(), p = c.project, d = c.design, s = Object.assign({}, S.state.settings, r.inputs.s);
    const L = E.loadCalc(p);
    const rows = (arr) => `<table class="ex-t">${arr.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table>`;
    const lib = {
      loop: ['Ground loop sizing', `<p>Required loop length is the larger of the heating and cooling requirement, using a specific heat-exchange rate that depends on ground conductivity and borehole spacing.</p>
        <div class="formula">L<sub>cool</sub> = Q<sub>cool</sub> × (1 + 1/COP<sub>c</sub>) ÷ q′<sub>c</sub> &nbsp;·&nbsp; L<sub>heat</sub> = Q<sub>heat</sub> × (1 − 1/COP<sub>h</sub>) ÷ q′<sub>h</sub><br>q′<sub>h</sub> = 20 × k × f<sub>spacing</sub> (W/m), q′<sub>c</sub> = 1.15 × q′<sub>h</sub>, f<sub>spacing</sub> = 1 − 0.35·e<sup>−(s−3)/2.5</sup></div>` +
        rows([['Ground conductivity k', U.cond(r.g.k)], ['Spacing factor', r.fsp.toFixed(3)], ['q′ heating / cooling', `${U.wpm(r.qh)} / ${U.wpm(r.qc)}`], ['Peak heating / cooling', `${U.pow(d.heatPeak)} / ${U.pow(d.coolPeak)}`], ['Required length', U.len(r.Lreq)], ['Installed length', `${U.len(r.L)} (${(r.ratio * 100).toFixed(0)}%)`], ['Loop ratio', `${U.loopRatio(r)} · typical ${U.loopRange()} ${U.loopOk(r) ? '✓' : '⚠'}`]])],
      cop: ['Heat pump efficiency (COP)', `<p>COP is driven by the entering water temperature (EWT) from the ground loop. Smaller loops push EWT further from ground temperature; long-term heat accumulation (drift) shifts it over the system life.</p>
        <div class="formula">EWT<sub>h</sub> = T<sub>g</sub> − 7 ÷ r<sub>h</sub><sup>0.8</sup> + drift · EWT<sub>c</sub> = T<sub>g</sub> + 9 ÷ r<sub>c</sub><sup>0.8</sup> + drift<br>COP<sub>h</sub> = (2.0 + 0.1·(EWT<sub>h</sub>+10)) × fluid factor · COP<sub>c</sub> = 9.2 − 0.17·EWT<sub>c</sub><br>SCOP = (H + C) ÷ (H/COP<sub>h</sub> + C/COP<sub>c</sub>)</div>` +
        rows([['Undisturbed ground T<sub>g</sub>', U.temp(r.c.tg)], ['EWT heating / cooling', `${U.temp(r.EWTh)} / ${U.temp(r.EWTc)}`], ['Ground drift', `${U.dT(r.drift, 2)} per year`], ['COP heating / cooling', `${r.COPh.toFixed(2)} / ${r.COPc.toFixed(2)}`], ['Seasonal COP (SCOP)', `<b>${r.SCOP.toFixed(2)}</b>`]])],
      capex: ['Capital cost (CAPEX)', `<p>Drilling is priced per meter by ground type with a depth premium above ${U.len(150)}; heat pumps per ${U.imp() ? 'ton' : 'kW'} of peak capacity; integration covers headers, controls and field preparation.</p>` +
        rows([['Drilling rate', `${U.perLen(r.drillPerM, 2)} × ${U.len(r.L)} + $380 per borehole`], ['Drilling & loop', U.money(r.drilling)], ['Heat pumps', `${U.perPow(s.equipRate)} × ${U.pow(Math.max(d.coolPeak, d.heatPeak), 1)} = ${U.money(r.equipment)}`], ['Integration & field prep', U.money(r.integration)], ['Total CAPEX', `<b>${U.money(r.capex)}</b> (range ${U.moneyK(r.capexLow)}–${U.moneyK(r.capexHigh)})`]])],
      savings: ['Annual savings vs. current system', `<p>Baseline: <b>${U.esc(r.baseline.label)}</b> — heating efficiency ${r.baseline.eff < 1.5 ? (r.baseline.eff * 100).toFixed(0) + '%' : 'COP ' + r.baseline.eff.toFixed(2)}, cooling COP ${r.baseline.coolCop}. Geothermal: heat pump electricity, circulation pumps and any backup. Maintenance difference ≈ ${U.perPow(s.maintPerKw)} of peak per year.</p>` +
        rows([['Electricity price', `$${s.elec.toFixed(3)}/kWh`], [r.baseline.fuel === 'elec' ? 'Heating energy' : 'Heating fuel price', r.baseline.fuel === 'elec' ? 'electricity' : `$${r.baseline.price.toFixed(3)}/kWh (${r.baseline.fuel})`], ['Baseline heating / cooling cost', `${U.money(r.baseline.heatCost)} / ${U.money(r.baseline.coolCost)}`], ['Baseline energy cost', U.money(r.baselineCost)], ['Geothermal energy cost', `${U.money(r.gshpCost)} (${U.n(r.gshpElec, 0)} kWh)`], ['Circulation pumps', `${r.pumpKw.toFixed(1)} kW`], ['Maintenance savings', U.money(r.maintSave)], ['Annual savings', `<b>${U.money(r.annualSavings)}</b>`]])],
      payback: ['Payback, ROI, NPV, IRR', `<p>Net investment = CAPEX − incentives${r.avoided > 0 ? ' − avoided cost of the baseline equipment that would have been bought anyway' : ''}. Savings escalate with energy prices (${(s.escalation * 100).toFixed(1)}%/yr) and decline with system degradation (${r.degr.toFixed(2)}%/yr). The range reflects −7/+8% CAPEX and +10/−12% savings.</p>` +
        rows([['CAPEX', U.money(r.capex)], ['Incentives', '−' + U.money(r.incentives)], ['Avoided baseline equipment', '−' + U.money(r.avoided)], ['Net investment', U.money(r.netCapex)], ['Payback', r.paybackYears >= 25 ? '<b>over 25 yrs</b>' : `<b>${r.paybackYears.toFixed(1)} yrs</b> (range ${r.paybackLow.toFixed(1)}–${Math.min(25, r.paybackHigh).toFixed(1)})`], ['10-year ROI', r.roi10.toFixed(0) + '%'], ['20-year NPV @ ' + (s.discount * 100).toFixed(0) + '%', U.money(r.npv20)], ['20-year IRR', r.irr != null ? (r.irr * 100).toFixed(1) + '%' : 'n/a']])],
      baseline: ['Current system (baseline)', `<p>Payback depends on what the geothermal system replaces. Choose the heating &amp; cooling system the building has today (or would get otherwise). <b>Sector</b> sets the electricity/gas price class and the federal credit. <b>Project type</b>: for new construction or an end-of-life replacement, the cost of the conventional equipment you no longer buy is credited; for an early retrofit it is not.</p>` +
        rows([['Baseline', U.esc(r.baseline.label)], ['Sector', r.sector], ['Project type', U.esc(E.PROJECT_TYPES[r.projectType].label)], ['Avoided equipment credit', U.money(r.avoided)], ['Current energy cost', U.money(r.baselineCost) + ' / yr']])],
      co2: ['CO₂ reduction', `<p>Avoided emissions = baseline (fuel emission factor: gas 0.181, propane 0.215, oil 0.267 kg/kWh, or grid electricity) − geothermal electricity, using the regional grid factor. Percentage is relative to whole-building emissions.</p>` +
        rows([['Grid factor', `${r.loc.grid} kg CO₂/kWh (${U.esc(r.loc.city)})`], ['Baseline HVAC', `${U.n(r.baseCo2, 0)} t/yr`], ['Avoided', `<b>${U.n(r.co2Saved, 0)} t/yr</b> (${r.co2Pct.toFixed(0)}% of building)`]])],
      suit: ['Site suitability score', `<p>Weighted score of ground and site factors.</p>` +
        rows([['Thermal conductivity (30%)', (r.kScore * 100).toFixed(0)], ['Drillability (20%)', (r.g.drillability * 100).toFixed(0)], ['Geological stability (15%)', (r.g.stability * 100).toFixed(0)], ['Climate fit (15%)', (r.c.fit * 100).toFixed(0)], ['Depth allowance (10%)', (Math.min(1, p.depthLimit / 300) * 100).toFixed(0)], ['Data fidelity (10%)', ((E.FIDELITY[p.fidelity] || 1) * 100).toFixed(0)], ['Score', `<b>${r.suit} / 100</b>`]])],
      loads: ['Building thermal loads', `<p>${p.loadMode === 'calculated' ? 'Calculated with the degree-day method for annual energy and design-day conditions for peaks.' : 'Using known (metered / utility) demand entered by the user. The calculated estimate is shown for comparison.'}</p>
        <div class="formula">UA = U<sub>vintage</sub> × ventilation factor × floor area · Q<sub>heat,peak</sub> = UA × (${U.temp(20, 0)} − T<sub>design,heat</sub>) × 0.9<br>Q<sub>cool,peak</sub> = A × (0.9·gains + U·(T<sub>design,cool</sub> − 24) + 0.5·solar)<br>E<sub>heat</sub> = UA × HDD × 24 × occupancy − 0.1 × internal gains · E<sub>cool</sub> = 0.75 × gains + UA × CDD × 24 × 0.6 + solar</div>` +
        rows([['Climate', `${r.c.label} · HDD ${U.dd(r.c.hdd)} · CDD ${U.dd(r.c.cdd)} (${U.ddBase()}) · design ${U.temp(r.c.tdh, 0)} / ${U.temp(r.c.tdc, 0)}`], ['UA (envelope + ventilation)', U.ua(L.UA)], ['Internal gains', `${U.pow(L.gainsKw, 1)} · ${U.n(L.hours)} h/yr`], ['Calculated heating / cooling', `${U.n(L.heat / 1000)} / ${U.n(L.cool / 1000)} MWh/yr`], ['Calculated peaks', `${U.pow(L.heatPeak)} heating / ${U.pow(L.coolPeak)} cooling`], ['Used in model', `${U.n(p.heatDemand / 1000)} / ${U.n(p.coolDemand / 1000)} MWh/yr (${p.loadMode === 'calculated' ? 'calculated' : 'known'})`]])],
      risk: ['Aggregate risk score', `<p>Weighted combination of model-derived risk factors (0–1 each), scaled to 0–100.</p>` +
        rows(Object.entries(r.risk.parts).map(([k, v]) => [k.replace(/([A-Z])/g, ' $1').replace(/^\w/, m => m.toUpperCase()), (v * 100).toFixed(0) + '%']).concat([['Score', `<b>${r.risk.score} (${r.risk.label})</b>`]]))]
    };
    const it = lib[key] || lib.loop;
    U.modal({ title: it[0], wide: true, body: it[1] + `<div class="muted" style="font-size:12px">Preliminary engineering estimate. Not a substitute for a licensed design or a thermal response test.</div>` });
  };

  /* ---------- Compliance card ---------- */
  GX.complianceHtml = (compact) => {
    const r = S.result(), c = S.cur();
    const items = E.compliance(r, c.project, c.design, U);
    const ic = { pass: ['✓', 'green'], warn: ['!', 'amber'], fail: ['×', 'red'], action: ['○', 'gray'] };
    const done = c.checks || {};
    const list = compact ? items.filter(i => i.status !== 'pass').slice(0, 5) : items;
    const counts = { pass: items.filter(i => i.status === 'pass').length, issues: items.filter(i => i.status === 'warn' || i.status === 'fail').length, actions: items.filter(i => i.status === 'action' && !done[i.title]).length };
    return { counts, items, html: `<div class="cmp-list">${list.map(i => { const isDone = i.status === 'action' && done[i.title]; const k = isDone ? ['✓', 'green'] : ic[i.status];
      return `<div class="cmp ${i.status} ${isDone ? 'done' : ''}"><button class="cmp-ic ${k[1]}" ${i.status === 'action' ? `data-check="${U.esc(i.title)}" title="Mark as done"` : 'tabindex="-1"'}>${k[0]}</button><div><b>${U.esc(i.title)}</b><span>${U.esc(i.note)}</span><em>${U.esc(i.cat)} · ${U.esc(i.ref)}</em></div></div>`; }).join('')}</div>` };
  };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-check]'); if (!b) return;
    if (!GX.guard()) return; const c = S.cur(); c.checks = c.checks || {}; const t = b.dataset.check; c.checks[t] = !c.checks[t];
    S.log(`Checklist: ${t} ${c.checks[t] ? 'completed' : 'reopened'}`, 'Config', c.checks[t] ? 'Success' : 'Modified'); S.touch('checks');
  });
})();

/* ---------- Guidance: workflow steps, page tips, glossary, welcome ---------- */
(function () {
  'use strict';
  const U = window.GXUI, S = window.GXStore, GX = window.GX;
  GX.STEPS = [
    ['site', 'Site analysed', 'site-intelligence'], ['building', 'Building & current system entered', 'project-setup'], ['design', 'Ground loop designed', 'system-design'],
    ['costs', 'Costs & incentives checked', 'costs'], ['finance', 'Payback reviewed', 'financial-analysis'], ['report', 'Report generated', 'reports']
  ];
  GX.stepDone = k => { const c = S.cur(); if (!c) return false; if (k === 'install') return c.project.stage === 'deployed'; if (k === 'report') return (c.reports || []).length > 0; return !!(c.progress || {})[k]; };
  GX.progress = () => { const done = GX.STEPS.filter(s => GX.stepDone(s[0])).length; const next = GX.STEPS.find(s => !GX.stepDone(s[0])); return { done, total: GX.STEPS.length, next }; };
  GX.progressHtml = () => { const p = GX.progress(); return `<div class="prog-list">${GX.STEPS.map((s, i) => `<button class="prog-i ${GX.stepDone(s[0]) ? 'done' : p.next && p.next[0] === s[0] ? 'next' : ''}" data-go="${s[2]}"><span>${GX.stepDone(s[0]) ? '✓' : i + 1}</span>${s[1]}${p.next && p.next[0] === s[0] ? '<em>Next</em>' : ''}</button>`).join('')}</div>`; };

  GX.INTRO = {
    projects: ['All your projects. Create a new project or open an existing one.', 'dashboard', 'Overview'],
    dashboard: ['Project overview. All figures update automatically when you change inputs on the other pages.', null, null],
    'site-intelligence': ['Step 1 of 6 · Choose the state, city and ground conditions, then click “Run Site Analysis”. State energy prices are loaded automatically.', 'project-setup', 'Building & Loads'],
    'project-setup': ['Step 2 of 6 · Select the current heating & cooling system, then describe the building. Loads are calculated automatically or taken from utility data.', 'system-design', 'Ground Loop'],
    'system-design': ['Step 3 of 6 · Ground Loop — review the recommended borefield and adjust boreholes, depth, spacing and fluid.', 'drilling-optimization', 'Borefield & drilling'],
    'drilling-optimization': ['Step 3 of 6 · Ground Loop — find the drilling plan with the lowest lifecycle cost and review the safety & permit checklist.', 'simulation-lab', 'Long-term simulation'],
    'simulation-lab': ['Step 3 of 6 · Ground Loop — test the design under extreme weather and load growth over 1, 5 or 10 years.', 'risk-engine', 'Risks'],
    'risk-engine': ['Step 3 of 6 · Ground Loop — long-term performance risks (ground heat build-up, overload, freezing) and how to reduce them.', 'costs', 'Costs & Incentives'],
    'us-map': ['Payback for a typical home, office or school in every state, from the same engine. Click a state for details or start a project there.', null, null],
    methodology: ['How every number is calculated, where the data comes from, and what the tool is (and is not) for.', null, null],
    feedback: ['Join the pilot program or send feedback — it goes straight to the GeoThermX team.', null, null],
    costs: ['Step 4 of 6 · Check energy prices, installed cost and incentives. Defaults come from the state and sector; enter real tariffs if you have them.', 'financial-analysis', 'Payback'],
    'financial-analysis': ['Step 5 of 6 · Payback, savings, NPV and IRR against the current heating & cooling system.', 'scenario-comparison', 'Compare options'],
    'scenario-comparison': ['Step 5 of 6 · Compare standard, optimized and low-cost designs and apply the best one.', 'reports', 'Report'],
    reports: ['Step 6 of 6 · Generate a client-ready feasibility & engineering report and save it as PDF.', 'dashboard', 'Overview'],
    monitoring: ['After installation · Upload monthly operating data to compare measured and expected performance.', 'alerts', 'Alerts'],
    alerts: ['After installation · Deviations found in your operating data, with likely causes and recommended actions.', 'monitoring', 'Measured data'],
    preferences: ['Units, page tips and details printed on your reports.', null, null]
  };
  GX.introHtml = id => {
    const it = GX.INTRO[id]; const st = S.state.settings;
    if (!it || st.tips === false || (st.hiddenTips || {})[id] || !S.cur()) return '';
    let next = it[1], label = it[2];
    if (id === 'dashboard') { const p = GX.progress(); if (p.next) { next = p.next[2]; label = p.next[1].replace(/ (analysed|entered|designed|reviewed|generated|installed)$/, '') ; label = { site: 'Analyse site', building: 'Enter building data', design: 'Design ground loop', costs: 'Check costs', finance: 'Review payback', report: 'Create report', install: 'Mark as installed' }[p.next[0]]; } }
    return `<div class="introbar"><span class="ib-t">${it[0]}</span><span class="ib-a">${next ? `<button class="btn btn-sm btn-primary" data-go="${next}">Next: ${label} →</button>` : ''}<button class="link-btn" data-glossary="1">Glossary</button><button class="ib-x" data-hide-tip="${id}" aria-label="Hide tip" title="Hide this tip">×</button></span></div>`;
  };
  const GLOSS = [
    ['COP (Coefficient of Performance)', 'Units of heat delivered per unit of electricity used. A COP of 4.5 means 4.5 kWh of heat for 1 kWh of electricity.'],
    ['SCOP (Seasonal COP)', 'Average COP over a full year of heating and cooling, weighted by energy use.'],
    ['Borehole / borefield', 'Vertical holes drilled into the ground with plastic pipe loops; together they form the ground heat exchanger.'],
    ['Closed loop / open loop', 'Closed loop circulates fluid in sealed pipes. Open loop pumps groundwater from a well and needs water permits.'],
    ['EWT (Entering Water Temperature)', 'Temperature of the fluid returning from the ground to the heat pump. It drives efficiency.'],
    ['Loop ratio (ft/ton, m/kW)', 'Loop length per unit of peak load. Used as a quick check of the sizing.'],
    ['Thermal conductivity (k)', 'How easily heat moves through the ground. Higher k means shorter loops. Measured with a thermal response test (TRT).'],
    ['Ground temperature drift', 'Slow warming or cooling of the ground when heat put in and taken out over a year are not balanced.'],
    ['HDD / CDD', 'Heating and cooling degree-days: how cold or hot the climate is over a year.'],
    ['CAPEX / OPEX', 'Capital cost to build the system / yearly operating cost.'],
    ['Payback', 'Years until cumulative savings repay the net investment.'],
    ['NPV / IRR', 'Net present value of savings minus investment, and the effective annual return on the investment.']
  ];
  document.addEventListener('click', e => {
    const h = e.target.closest('[data-hide-tip]'); if (h) { const st = S.state.settings; st.hiddenTips = Object.assign({}, st.hiddenTips, { [h.dataset.hideTip]: true }); S.persist(); const bar = document.getElementById('introbar'); if (bar) bar.innerHTML = ''; return; }
    if (e.target.closest('[data-glossary]')) U.modal({ title: 'Glossary', wide: true, body: `<table class="ex-t gloss">${GLOSS.map(([a, b]) => `<tr><td><b>${a}</b></td><td>${b}</td></tr>`).join('')}</table>` });
    if (e.target.closest('[data-new-project]')) GX.newProject();
  });

  GX.welcomeHtml = () => {
    const r = S.samplePreview && S.samplePreview();
    const chip = (cls, l, v) => `<div class="wl-chip ${cls}"><span>${l}</span><b>${v}</b></div>`;
    const chips = r ? chip('c1', 'Seasonal COP', r.SCOP.toFixed(2)) + chip('c2', 'Payback', GX.pb(r.paybackYears) + ' yrs') + chip('c3', 'CO₂ avoided', U.n(r.co2Saved, 0) + ' t/yr') : '';
    const nb = 6, bx = i => 150 + i * 46;
    const bores = Array.from({ length: nb }, (_, i) => { const x = bx(i), dep = 340 + ((i * 7) % 3) * 14; return `<g class="wl-bore" style="--d:${i * 0.18}s">
        <rect x="${x - 7}" y="196" width="14" height="${dep - 196 + 10}" rx="7" fill="rgba(15,23,42,.35)"/>
        <path d="M${x - 3} 196 V${dep} a3 3 0 0 0 6 0 V196" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="2.6"/>
        <path class="wl-down" d="M${x - 3} 196 V${dep}" fill="none" stroke="url(#wlDown)" stroke-width="2.6" stroke-dasharray="7 9"/>
        <path class="wl-up" d="M${x + 3} ${dep} V196" fill="none" stroke="url(#wlUp)" stroke-width="2.6" stroke-dasharray="7 9"/></g>`; }).join('');
    const svg = `<svg class="wl-svg" viewBox="0 0 520 440" role="img" aria-label="Animated borefield cross-section">
      <defs>
        <linearGradient id="wlGround" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e293b"/><stop offset=".45" stop-color="#1f2a37"/><stop offset="1" stop-color="#3b1d14"/></linearGradient>
        <linearGradient id="wlDown" gradientUnits="userSpaceOnUse" x1="0" y1="196" x2="0" y2="320"><stop offset="0" stop-color="#5eead4"/><stop offset="1" stop-color="#fb923c"/></linearGradient>
        <linearGradient id="wlUp" gradientUnits="userSpaceOnUse" x1="0" y1="320" x2="0" y2="196"><stop offset="0" stop-color="#fb923c"/><stop offset="1" stop-color="#fbbf24"/></linearGradient>
        <radialGradient id="wlHeat" cx=".5" cy="1" r=".75"><stop offset="0" stop-color="#f97316" stop-opacity=".55"/><stop offset="1" stop-color="#f97316" stop-opacity="0"/></radialGradient>
        <clipPath id="wlClip"><rect x="20" y="40" width="480" height="380" rx="22"/></clipPath>
      </defs>
      <g clip-path="url(#wlClip)">
        <rect x="20" y="40" width="480" height="380" fill="url(#wlGround)"/>
        <rect x="20" y="40" width="480" height="150" fill="rgba(15,23,42,.55)"/>
        <ellipse class="wl-glow" cx="260" cy="440" rx="300" ry="190" fill="url(#wlHeat)"/>
        ${[226, 262, 300, 342, 382].map((y, i) => `<path class="wl-stratum" style="--d:${i * 1.3}s" d="M0 ${y} C 120 ${y - 10}, 220 ${y + 12}, 320 ${y} S 480 ${y - 8}, 540 ${y + 4}" fill="none" stroke="rgba(148,163,184,${0.16 - i * 0.015})" stroke-width="1.2"/>`).join('')}
        <line x1="20" y1="190" x2="500" y2="190" stroke="rgba(94,234,212,.55)" stroke-width="1.5"/>
        <g class="wl-building">
          <rect x="84" y="104" width="120" height="86" rx="4" fill="#0f172a" stroke="rgba(148,163,184,.35)"/>
          <polygon points="78,106 144,70 210,106" fill="#111c2e" stroke="rgba(148,163,184,.35)"/>
          ${[0, 1, 2].map(c => [0, 1].map(rw => `<rect class="wl-win" style="--d:${(c + rw * 3) * 0.4}s" x="${100 + c * 34}" y="${120 + rw * 30}" width="20" height="16" rx="2"/>`).join('')).join('')}
          <rect x="226" y="150" width="58" height="40" rx="5" fill="#0f172a" stroke="rgba(94,234,212,.5)"/>
          <text x="255" y="174" text-anchor="middle" class="wl-tag">GSHP</text>
          <path class="wl-pipe" d="M204 172 H226" stroke="#5eead4" stroke-width="2.4" stroke-dasharray="5 5" fill="none"/>
          <path d="M255 190 V196 H${bx(nb - 1) + 3}" stroke="rgba(94,234,212,.4)" stroke-width="2" fill="none"/>
          <path d="M${bx(0) - 3} 196 H255" stroke="rgba(94,234,212,.4)" stroke-width="2" fill="none"/>
        </g>
        ${bores}
        <text x="478" y="214" text-anchor="end" class="wl-axis">${r ? 'ground ' + U.temp(r.c.tg) : ''}</text>
        <text x="478" y="404" text-anchor="end" class="wl-axis">depth ↓</text>
      </g>
      <rect x="20" y="40" width="480" height="380" rx="22" fill="none" stroke="rgba(148,163,184,.22)"/>
    </svg>`;
    const steps = [['Site & building', 'State, ground, loads, current system'], ['Ground loop', 'Boreholes, depth, 25-yr simulation'], ['Costs & payback', 'State prices, incentives, ROI'], ['Report', 'Client-ready PDF']];
    return `<div class="welcome wl-dark">
      <canvas class="wl-bg" id="wl-bg" aria-hidden="true"></canvas>
      <div class="wl-wrap">
        <div class="wl-left">
          <div class="wl-brand"><span class="wl-logo"></span>GeoThermX</div>
          <div class="wl-kicker">Geothermal engineering platform</div>
          <h1>Design a ground-source heat pump system <em>from site to payback</em></h1>
          <p>Pick any US state, describe the building and its current heating &amp; cooling. GeoThermX calculates the loads, sizes the borefield, prices it with state energy rates and incentives, and shows when the system pays back — then writes the feasibility report.</p>
          <div class="wl-cta"><button class="btn btn-accent btn-lg" data-new-project="1">Create your first project →</button><button class="btn btn-lg wl-ghost" data-load-sample="1">Explore sample projects</button></div>
          <div class="wl-links"><a href="#us-map"><span class="wl-li">◎</span>US payback map — all 50 states</a><a href="#methodology"><span class="wl-li">∑</span>Methodology &amp; data</a><a href="#feedback"><span class="wl-li">✉</span>Join the pilot</a></div>
          <ol class="wl-steps">${steps.map((s, i) => `<li style="--i:${i}"><span>${i + 1}</span><div><b>${s[0]}</b><em>${s[1]}</em></div></li>`).join('')}</ol>
          <p class="wl-note">Preliminary engineering estimates. They do not replace licensed design or permitting.</p>
        </div>
        <div class="wl-right"><div class="wl-visual">${svg}${chips}<div class="wl-cap">Sample project · live engine output</div></div></div>
      </div></div>`;
  };

  /* Animated background: drifting strata lines and rising heat particles */
  GX.welcomeMount = root => {
    const cv = root && root.querySelector('#wl-bg'); if (!cv) return () => {};
    const ctx = cv.getContext('2d'); if (!ctx) return () => {};
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, dpr = 1, raf = 0, t0 = performance.now(), parts = [];
    const size = () => { dpr = Math.min(2, window.devicePixelRatio || 1); w = cv.clientWidth; h = cv.clientHeight; cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(70, w * h / 22000)); parts = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, r: 0.6 + Math.random() * 1.8, v: 0.15 + Math.random() * 0.45, a: Math.random() * 6.28 })); };
    const draw = now => {
      const t = (now - t0) / 1000; ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < 7; i++) {
        const base = h * (0.42 + i * 0.085), amp = 10 + i * 3, ph = t * (0.12 + i * 0.02) + i;
        ctx.beginPath();
        for (let x = 0; x <= w + 20; x += 20) { const y = base + Math.sin(x / (180 + i * 30) + ph) * amp + Math.sin(x / 70 + ph * 1.7) * 2; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.strokeStyle = `rgba(${i < 3 ? '94,234,212' : '251,146,60'},${0.05 + i * 0.012})`; ctx.lineWidth = 1; ctx.stroke();
      }
      parts.forEach(p => {
        if (!reduce) { p.y -= p.v; p.x += Math.sin(t + p.a) * 0.25; if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; } }
        const warm = p.y / h; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283);
        ctx.fillStyle = `rgba(${Math.round(94 + 157 * warm)},${Math.round(234 - 88 * warm)},${Math.round(212 - 152 * warm)},${0.18 + 0.35 * (1 - Math.abs(warm - 0.6))})`; ctx.fill();
      });
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    size(); draw(t0); window.addEventListener('resize', size);
    const onVis = () => { cancelAnimationFrame(raf); if (!document.hidden && !reduce) raf = requestAnimationFrame(draw); };
    document.addEventListener('visibilitychange', onVis);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', size); document.removeEventListener('visibilitychange', onVis); };
  };
})();
