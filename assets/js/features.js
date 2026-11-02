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
  U.loopRange = () => imp() ? '130–250 ft/ton' : '11–22 m/kW';
  U.loopOk = r => r.ftPerTon >= 130 && r.ftPerTon <= 250;

  /* ---------- Plans & limits (from the platform description) ---------- */
  GX.PLANS = {
    basic: { name: 'Basic', price: 'Starter', projects: 3, ai: 100, users: 1, locked: ['drilling-optimization', 'simulation-lab', 'scenario-comparison', 'monitoring', 'alerts', 'risk-engine', 'benchmarking'], liveMonitoring: false,
      features: ['Basic Site Intelligence & suitability score', 'Simplified system design', 'Preliminary financial analysis', 'AI Assistant (100 requests / month)', 'Basic reports'], limits: ['Up to 3 active projects', 'Single user'] },
    professional: { name: 'Professional', price: 'Most popular', projects: 15, ai: 500, users: 5, locked: ['alerts', 'risk-engine'], liveMonitoring: false,
      features: ['Everything in Basic', 'Drilling Optimization Engine', 'Simulation Lab & Scenario Comparison', 'Advanced financial analytics', 'Benchmarking', 'Enhanced AI Assistant (500 / month)', 'Advanced reports'], limits: ['Up to 15 active projects', 'Up to 5 users', 'Monitoring without live analysis'] },
    enterprise: { name: 'Enterprise', price: 'Custom', projects: Infinity, ai: Infinity, users: Infinity, locked: [], liveMonitoring: true,
      features: ['Everything in Professional', 'Full Risk Engine & predictive analytics', 'Real-time monitoring with sensor integration', 'Alerts & incident management', 'Engineering Copilot (unlimited)', 'API & integrations'], limits: ['Unlimited projects and users'] }
  };
  GX.plan = () => GX.PLANS.enterprise;
  GX.isLocked = () => false;
  GX.minPlanFor = id => ['basic', 'professional', 'enterprise'].find(k => !GX.PLANS[k].locked.includes(id));

  /* ---------- Roadmap phases (business plan 3.3–3.5, 7.3) ---------- */
  GX.PHASE = {
    dashboard: 'MVP', 'site-intelligence': 'MVP', 'project-setup': 'MVP', 'system-design': 'MVP', 'financial-analysis': 'MVP', reports: 'MVP', projects: 'MVP', preferences: 'MVP',
    'scenario-comparison': 'P2', 'ai-assistant': 'P2', benchmarking: 'P2',
    'drilling-optimization': 'P3', 'simulation-lab': 'P3', monitoring: 'P3', alerts: 'P3', 'risk-engine': 'P3'
  };
  GX.PHASE_LABEL = { MVP: 'MVP · Year 1', P2: 'Release 2 · Year 2', P3: 'Release 3 · Years 3–5' };

  /* ---------- Lifecycle ---------- */
  GX.STAGES = { assessment: ['Assessment', 'amber'], design: ['Design', 'blue'], deployed: ['Operational', 'green'] };
  GX.stage = () => S.cur().project.stage || 'design';
  GX.deployed = () => GX.stage() === 'deployed';
  GX.isSample = () => !!(S.cur() && S.cur().project.sample);
  GX.stagePill = st => { const s = GX.STAGES[st || GX.stage()]; return `<span class="pill ${s[1]}" style="text-transform:none">${s[0]}</span>`; };
  GX.demoTag = (txt) => !GX.isSample() ? '' : `<span class="demo-tag" title="Simulated data for demonstration. Connect sensors/BMS for live values.">${txt || 'Demo data'}</span>`;

  GX.notDeployed = (title, text) => `<div class="card empty-state">
      <div class="es-ico">⏻</div><h2>${title}</h2><p class="muted">${text}</p>
      <div class="row" style="gap:12px;justify-content:center;flex-wrap:wrap;margin-top:8px">
        <button class="btn btn-ghost" data-go="financial-analysis">Review financials</button>
        <button class="btn btn-accent" id="es-deploy" data-edit>Mark system as installed</button>
        ${S.state.projects.sample ? '' : '<button class="btn btn-ghost" data-load-sample="1">Explore the sample project</button>'}</div>
      <div class="muted" style="font-size:12px;margin-top:16px">Current stage: ${GX.stagePill()}</div></div>`;
  GX.deploy = () => {
    if (!GX.guard()) return;
    U.modal({ title: 'Mark system as installed & commissioned', body: `<p style="margin:0;line-height:1.55">This moves <b>${U.esc(S.cur().project.name)}</b> to the <b>Operational</b> stage and turns on Monitoring, Alerts and operational risk tracking. The current design is saved to the calculation history.</p><div class="insight">Live values come from sensors / BMS once integrated. Until then the platform shows a simulated feed labelled “Demo data”.</div>`,
      actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Confirm installation', kind: 'accent', onClick: () => { S.snapshot('Commissioned design'); S.setStage('deployed'); S.log('Project moved to Operational stage', 'System', 'Success'); U.toast('Project is now <b>Operational</b>. Monitoring enabled.'); GX.go('monitoring'); } }] });
  };
  document.addEventListener('click', e => {
    if (e.target.closest('#es-deploy')) GX.deploy();
    const d = e.target.closest('[data-load-sample]'); if (d) { S.loadSample(); U.toast('Sample project opened. Your own projects are unchanged.'); GX.go('dashboard'); }
    const i = e.target.closest('[data-explain]'); if (i) { e.preventDefault(); e.stopPropagation(); GX.explain(i.dataset.explain); }
    const up = e.target.closest('[data-upgrade]'); if (up) GX.go('preferences');
  });

  GX.lockedView = id => {
    const need = GX.PLANS[GX.minPlanFor(id)];
    return `<div class="card empty-state"><div class="es-ico">🔒</div><h2>${(GX.views[id] && GX.views[id].name) || 'Module'} is available on ${need.name}</h2>
      <p class="muted">Your workspace is on the <b>${GX.plan().name}</b> plan. Upgrade to unlock this module for all projects.</p>
      <div class="row" style="gap:12px;justify-content:center"><button class="btn btn-accent" data-go="preferences">Change plan in Settings</button></div></div>`;
  };

  /* ---------- Methodology: "How is this calculated?" ---------- */
  GX.info = key => `<button class="info-btn" data-explain="${key}" aria-label="How is this calculated?" title="How is this calculated?">i</button>`;
  GX.explain = key => {
    const r = S.result(), c = S.cur(), p = c.project, d = c.design, s = S.state.settings;
    const L = E.loadCalc(p);
    const rows = (arr) => `<table class="ex-t">${arr.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table>`;
    const lib = {
      loop: ['Ground loop sizing', `<p>Required loop length is the larger of the heating and cooling requirement, using a specific heat-exchange rate that depends on ground conductivity and borehole spacing.</p>
        <div class="formula">L<sub>cool</sub> = Q<sub>cool</sub> × (1 + 1/COP<sub>c</sub>) ÷ q′<sub>c</sub> &nbsp;·&nbsp; L<sub>heat</sub> = Q<sub>heat</sub> × (1 − 1/COP<sub>h</sub>) ÷ q′<sub>h</sub><br>q′<sub>h</sub> = 20 × k × f<sub>spacing</sub> (W/m), q′<sub>c</sub> = 1.15 × q′<sub>h</sub>, f<sub>spacing</sub> = 1 − 0.35·e<sup>−(s−3)/2.5</sup></div>` +
        rows([['Ground conductivity k', U.cond(r.g.k)], ['Spacing factor', r.fsp.toFixed(3)], ['q′ heating / cooling', `${r.qh.toFixed(1)} / ${r.qc.toFixed(1)} W/m`], ['Peak heating / cooling', `${U.pow(d.heatPeak)} / ${U.pow(d.coolPeak)}`], ['Required length', U.len(r.Lreq)], ['Installed length', `${U.len(r.L)} (${(r.ratio * 100).toFixed(0)}%)`], ['Loop ratio', `${U.loopRatio(r)} · typical ${U.loopRange()} ${U.loopOk(r) ? '✓' : '⚠'}`]])],
      cop: ['Heat pump efficiency (COP)', `<p>COP is driven by the entering water temperature (EWT) from the ground loop. Smaller loops push EWT further from ground temperature; long-term heat accumulation (drift) shifts it over the system life.</p>
        <div class="formula">EWT<sub>h</sub> = T<sub>g</sub> − 7 ÷ r<sub>h</sub><sup>0.8</sup> + drift · EWT<sub>c</sub> = T<sub>g</sub> + 9 ÷ r<sub>c</sub><sup>0.8</sup> + drift<br>COP<sub>h</sub> = (2.0 + 0.1·(EWT<sub>h</sub>+10)) × fluid factor · COP<sub>c</sub> = 9.2 − 0.17·EWT<sub>c</sub><br>SCOP = (H + C) ÷ (H/COP<sub>h</sub> + C/COP<sub>c</sub>)</div>` +
        rows([['Undisturbed ground T<sub>g</sub>', U.temp(r.c.tg)], ['EWT heating / cooling', `${U.temp(r.EWTh)} / ${U.temp(r.EWTc)}`], ['Ground drift', `${U.dT(r.drift, 2)} per year`], ['COP heating / cooling', `${r.COPh.toFixed(2)} / ${r.COPc.toFixed(2)}`], ['Seasonal COP (SCOP)', `<b>${r.SCOP.toFixed(2)}</b>`]])],
      capex: ['Capital cost (CAPEX)', `<p>Drilling is priced per meter by ground type with a depth premium above 150 m; heat pumps per kW of peak capacity; integration covers headers, controls and field preparation.</p>` +
        rows([['Drilling rate', `$${r.drillPerM.toFixed(2)}/m × ${U.len(r.L)} + $380 per borehole`], ['Drilling & loop', U.money(r.drilling)], ['Heat pumps', `$${s.equipRate}/kW × ${d.coolPeak > d.heatPeak ? d.coolPeak : d.heatPeak} kW = ${U.money(r.equipment)}`], ['Integration & field prep', U.money(r.integration)], ['Total CAPEX', `<b>${U.money(r.capex)}</b> (range ${U.moneyK(r.capexLow)}–${U.moneyK(r.capexHigh)})`]])],
      savings: ['Annual savings vs. conventional HVAC', `<p>Baseline: gas boiler (efficiency ${s.baselineBoilerEff}) for heating and electric chiller (COP ${s.baselineChillerCop}) for cooling. Geothermal: heat pump electricity, circulation pumps and any backup.</p>` +
        rows([['Electricity / gas price', `$${s.elec}/kWh · $${s.gas}/kWh`], ['Baseline energy cost', U.money(r.baselineCost)], ['Geothermal energy cost', `${U.money(r.gshpCost)} (${U.n(r.gshpElec, 0)} kWh)`], ['Circulation pumps', `${r.pumpKw.toFixed(1)} kW`], ['Maintenance savings', U.money(s.maintSave)], ['Annual savings', `<b>${U.money(r.annualSavings)}</b>`]])],
      payback: ['Payback, ROI, NPV, IRR', `<p>Net investment = CAPEX − incentives. Savings escalate with energy prices (${(s.escalation * 100).toFixed(1)}%/yr) and decline with system degradation (${r.degr.toFixed(2)}%/yr). The range reflects −7/+8% CAPEX and +10/−12% savings.</p>` +
        rows([['Net investment', U.money(r.netCapex)], ['Payback', `<b>${r.paybackYears.toFixed(1)} yrs</b> (range ${r.paybackLow.toFixed(1)}–${r.paybackHigh.toFixed(1)})`], ['10-year ROI', r.roi10.toFixed(0) + '%'], ['20-year NPV @ ' + (s.discount * 100).toFixed(0) + '%', U.money(r.npv20)], ['20-year IRR', r.irr != null ? (r.irr * 100).toFixed(1) + '%' : 'n/a']])],
      co2: ['CO₂ reduction', `<p>Avoided emissions = baseline (gas 0.181 kg/kWh fuel + chiller electricity) − geothermal electricity, using the regional grid factor. Percentage is relative to whole-building emissions.</p>` +
        rows([['Grid factor', `${r.loc.grid} kg CO₂/kWh (${U.esc(r.loc.city)})`], ['Baseline HVAC', `${U.n(r.baseCo2, 0)} t/yr`], ['Avoided', `<b>${U.n(r.co2Saved, 0)} t/yr</b> (${r.co2Pct.toFixed(0)}% of building)`]])],
      suit: ['Site suitability score', `<p>Weighted score of ground and site factors.</p>` +
        rows([['Thermal conductivity (30%)', (r.kScore * 100).toFixed(0)], ['Drillability (20%)', (r.g.drillability * 100).toFixed(0)], ['Geological stability (15%)', (r.g.stability * 100).toFixed(0)], ['Climate fit (15%)', (r.c.fit * 100).toFixed(0)], ['Depth allowance (10%)', (Math.min(1, p.depthLimit / 300) * 100).toFixed(0)], ['Data fidelity (10%)', ((E.FIDELITY[p.fidelity] || 1) * 100).toFixed(0)], ['Score', `<b>${r.suit} / 100</b>`]])],
      loads: ['Building thermal loads', `<p>${p.loadMode === 'calculated' ? 'Calculated with the degree-day method for annual energy and design-day conditions for peaks.' : 'Using known (metered / utility) demand entered by the user. The calculated estimate is shown for comparison.'}</p>
        <div class="formula">UA = U<sub>vintage</sub> × ventilation factor × floor area · Q<sub>heat,peak</sub> = UA × (20°C − T<sub>design,heat</sub>) × 0.9<br>Q<sub>cool,peak</sub> = A × (0.9·gains + U·(T<sub>design,cool</sub> − 24) + 0.5·solar)<br>E<sub>heat</sub> = UA × HDD × 24 × occupancy − 0.1 × internal gains · E<sub>cool</sub> = 0.75 × gains + UA × CDD × 24 × 0.6 + solar</div>` +
        rows([['Climate', `${r.c.label} · HDD ${r.c.hdd} · CDD ${r.c.cdd} · design ${U.temp(r.c.tdh, 0)} / ${U.temp(r.c.tdc, 0)}`], ['UA (envelope + ventilation)', `${L.UA.toFixed(1)} kW/K`], ['Internal gains', `${L.gainsKw.toFixed(0)} kW · ${U.n(L.hours)} h/yr`], ['Calculated heating / cooling', `${U.n(L.heat / 1000)} / ${U.n(L.cool / 1000)} MWh/yr`], ['Calculated peaks', `${U.pow(L.heatPeak)} heating / ${U.pow(L.coolPeak)} cooling`], ['Used in model', `${U.n(p.heatDemand / 1000)} / ${U.n(p.coolDemand / 1000)} MWh/yr (${p.loadMode === 'calculated' ? 'calculated' : 'known'})`]])],
      risk: ['Aggregate risk score', `<p>Weighted combination of model-derived risk factors (0–1 each), scaled to 0–100.</p>` +
        rows(Object.entries(r.risk.parts).map(([k, v]) => [k.replace(/([A-Z])/g, ' $1').replace(/^\w/, m => m.toUpperCase()), (v * 100).toFixed(0) + '%']).concat([['Score', `<b>${r.risk.score} (${r.risk.label})</b>`]]))]
    };
    const it = lib[key] || lib.loop;
    U.modal({ title: it[0], wide: true, body: it[1] + `<div class="muted" style="font-size:12px">Preliminary engineering estimate. Not a substitute for a licensed design or a thermal response test.</div>` });
  };

  /* ---------- Compliance card ---------- */
  GX.complianceHtml = (compact) => {
    const r = S.result(), c = S.cur();
    const items = E.compliance(r, c.project, c.design);
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
    ['site', 'Site analysed', 'site-intelligence'], ['building', 'Building data entered', 'project-setup'], ['design', 'System designed', 'system-design'],
    ['finance', 'Financials reviewed', 'financial-analysis'], ['report', 'Report generated', 'reports'], ['install', 'System installed', 'projects']
  ];
  GX.stepDone = k => { const c = S.cur(); if (!c) return false; if (k === 'install') return c.project.stage === 'deployed'; if (k === 'report') return (c.reports || []).length > 0; return !!(c.progress || {})[k]; };
  GX.progress = () => { const done = GX.STEPS.filter(s => GX.stepDone(s[0])).length; const next = GX.STEPS.find(s => !GX.stepDone(s[0])); return { done, total: GX.STEPS.length, next }; };
  GX.progressHtml = () => { const p = GX.progress(); return `<div class="prog-list">${GX.STEPS.map((s, i) => `<button class="prog-i ${GX.stepDone(s[0]) ? 'done' : p.next && p.next[0] === s[0] ? 'next' : ''}" data-go="${s[2]}"><span>${GX.stepDone(s[0]) ? '✓' : i + 1}</span>${s[1]}${p.next && p.next[0] === s[0] ? '<em>Next</em>' : ''}</button>`).join('')}</div>`; };

  GX.INTRO = {
    projects: ['All your projects. Create a new project or open an existing one.', 'dashboard', 'Dashboard'],
    dashboard: ['Project overview. All figures update automatically when you change inputs on the other pages.', null, null],
    'site-intelligence': ['Step 1 of 6 · Choose the state, city and ground conditions, then click “Run Site Analysis”.', 'project-setup', 'Building data'],
    'project-setup': ['Step 2 of 6 · Describe the building. Heating and cooling loads are calculated automatically, or enter known utility data.', 'system-design', 'System design'],
    'system-design': ['Step 3 of 6 · Review the recommended borefield and adjust boreholes, depth, spacing, fluid and loads.', 'drilling-optimization', 'Drilling plan'],
    'drilling-optimization': ['Step 4 of 6 · Find the drilling plan with the lowest lifecycle cost and review the safety & permit checklist.', 'simulation-lab', 'Simulation'],
    'simulation-lab': ['Step 5 of 6 · Test the design under extreme weather and load growth over 1, 5 or 10 years.', 'scenario-comparison', 'Compare options'],
    'scenario-comparison': ['Step 6 of 6 · Compare standard, optimized and low-cost options and apply the best one.', 'financial-analysis', 'Financials'],
    'financial-analysis': ['Results · Investment, savings, incentives, payback and ROI of the current design.', 'reports', 'Create report'],
    reports: ['Results · Generate a client-ready engineering analysis report and save it as PDF.', 'dashboard', 'Dashboard'],
    monitoring: ['Operations · After installation, upload monthly operating data to compare measured and expected performance.', 'alerts', 'Alerts'],
    alerts: ['Operations · Deviations found in your operating data, with likely causes and recommended actions.', 'risk-engine', 'Risk forecast'],
    'risk-engine': ['Forecast of long-term risks (ground heat build-up, overload, pump wear) with a mitigation plan.', 'dashboard', 'Dashboard'],
    'ai-assistant': ['Ask about efficiency, cost, risks or what-if changes, for example “What if depth is 220?”.', null, null],
    preferences: ['Units, cost and energy price assumptions, and details printed on your reports.', null, null]
  };
  GX.introHtml = id => {
    const it = GX.INTRO[id]; const st = S.state.settings;
    if (!it || st.tips === false || (st.hiddenTips || {})[id] || !S.cur()) return '';
    let next = it[1], label = it[2];
    if (id === 'dashboard') { const p = GX.progress(); if (p.next) { next = p.next[2]; label = p.next[1].replace(/ (analysed|entered|designed|reviewed|generated|installed)$/, '') ; label = { site: 'Analyse site', building: 'Enter building data', design: 'Design system', finance: 'Review financials', report: 'Create report', install: 'Mark as installed' }[p.next[0]]; } }
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
    const chips = r ? chip('c1', 'Seasonal COP', r.SCOP.toFixed(2)) + chip('c2', 'Payback', r.paybackYears.toFixed(1) + ' yrs') + chip('c3', 'CO₂ avoided', U.n(r.co2Saved, 0) + ' t/yr') : '';
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
    const steps = [['Site & building', 'Location, ground, loads'], ['Design', 'Boreholes, depth, simulation'], ['Results', 'Costs, payback, report'], ['Operation', 'Measured vs. expected']];
    return `<div class="welcome wl-dark">
      <canvas class="wl-bg" id="wl-bg" aria-hidden="true"></canvas>
      <div class="wl-wrap">
        <div class="wl-left">
          <div class="wl-brand"><span class="wl-logo"></span>GeoThermX</div>
          <div class="wl-kicker">Geothermal engineering platform</div>
          <h1>Design a ground-source heat pump system <em>from site to payback</em></h1>
          <p>Enter a site and a building. GeoThermX calculates heating and cooling loads, sizes the borefield, simulates long-term ground temperature, and works out cost, savings, payback, CO₂ and permit checks — then writes the engineering report.</p>
          <div class="wl-cta"><button class="btn btn-accent btn-lg" data-new-project="1">Create your first project →</button><button class="btn btn-lg wl-ghost" data-load-sample="1">Explore a sample project</button></div>
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
