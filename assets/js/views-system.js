/* GeoThermX views: Report, Settings */
(function () {
  'use strict';
  const U = window.GXUI, S = window.GXStore, E = window.GXEngine, A = window.GXAlerts;
  const GX = window.GX; const esc = U.esc;

  /* ================= REPORTS ================= */
  GX.views.reports = {
    name: 'Report', header: { mode: 'title', title: () => GX.shortName() + ' — Documentation Hub' },
    state: { sel: null, opts: { fin: true, risk: true, charts: true } },
    create(title, type) {
      if (GX.track) GX.track('report-generated', type || 'report');
      const rep = { id: 'r' + Date.now(), title, date: U.today(), type };
      S.addReport(rep); this.state.sel = rep.id; S.log('Report generated: ' + title, 'Intelligence', 'Completed'); U.toast(`Report <b>${esc(title)}</b> generated`);
      return rep;
    },
    render(el) {
      el.innerHTML = `<div class="rep-wrap"><div class="rep-list"><h3 class="card-title">Recent Reports</h3><div id="rep-items"></div></div><div class="rep-doc"><div class="pages" id="paper"></div></div><div class="rep-side" id="rep-side"></div></div>`;
      this.paint(el);
    },
    paint(el) {
      const c = S.cur(), reps = c.reports;
      if (!reps.length) { U.$('#rep-items', el).innerHTML = '<div class="empty-ok">No reports yet.</div>'; U.$('#paper', el).innerHTML = `<div class="paper rep-empty"><div class="es-ico">▤</div><h2>Create your first report</h2><p class="muted">The Engineering Analysis Report summarises site, loads, borefield design, costs, payback, risks and the safety checklist for <b>${esc(c.project.name)}</b>. It always uses the latest project data.</p><button class="btn btn-accent btn-lg" id="rep-first" data-edit>Generate Engineering Analysis Report</button></div>`; U.$('#rep-side', el).innerHTML = ''; U.$('#rep-first', el).onclick = () => { this.create('Engineering Analysis Report', 'ENGINEERING'); this.paint(el); }; return; }
      if (!this.state.sel || !reps.find(x => x.id === this.state.sel)) this.state.sel = reps[0].id;
      const sel = reps.find(x => x.id === this.state.sel); const o = this.state.opts; const r = S.result();
      U.$('#rep-items', el).innerHTML = reps.map((x, i) => `<button class="rep-i ${x.id === sel.id ? 'on' : ''}" data-r="${x.id}" style="animation-delay:${i * 30}ms"><b>${esc(x.title)}</b><div class="between"><span class="muted">${U.date(x.date)}</span><span class="rt">${x.type}</span></div></button>`).join('');
      U.$('#paper', el).innerHTML = this.doc(sel, r, o);
      const k = GX.views['risk-engine'].model();
      U.$('#rep-side', el).innerHTML = `
        <div class="card pad"><h3 class="card-title">Report Summary</h3><ul class="rs-list"><li>System COP stable at ${r.SCOP.toFixed(2)}</li><li>ROI trajectory at ${r.roi10.toFixed(0)}%</li><li>Risk score: ${r.risk.score} (${r.risk.label.replace(' Risk', '')})</li><li>${A.counts().critical ? A.counts().critical + ' critical alert(s) open' : 'No critical failures detected'}</li></ul></div>
        <div class="card pad"><h3 class="card-title">Export Options</h3><div class="eo"><button class="btn btn-dark btn-block" id="rep-pdf">Download as PDF</button><button class="btn btn-ghost btn-block" id="rep-xls">Export Excel Data</button><button class="btn btn-ghost btn-block" id="rep-share">Get Secure Share Link</button></div></div>
        <div class="card pad"><h3 class="card-title">Report Settings</h3><div class="rset">${[['fin', 'Financial Data'], ['risk', 'Risk Analysis'], ['charts', 'High-Res Charts']].map(([kk, l]) => `<div class="between"><span>${l}</span><button class="toggle ${o[kk] ? 'on' : ''}" data-opt="${kk}" aria-pressed="${o[kk]}" aria-label="${l}"></button></div>`).join('')}</div></div>
        <div class="rep-bottom"><button class="btn btn-ghost btn-block" id="rep-tpl">Customize Report Template</button><button class="btn btn-accent btn-block" id="rep-new" data-edit>Generate New Report</button></div>`;
      el.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { this.state.sel = b.dataset.r; this.paint(el); U.$('#paper', el).classList.remove('flip'); void el.offsetWidth; U.$('#paper', el).classList.add('flip'); });
      el.querySelectorAll('[data-opt]').forEach(b => b.onclick = () => { o[b.dataset.opt] = !o[b.dataset.opt]; this.paint(el); });
      U.$('#rep-pdf', el).onclick = () => this.pdf(el, sel);
      U.$('#rep-xls', el).onclick = () => this.excel(sel);
      U.$('#rep-share', el).onclick = () => { const link = location.href.split('#')[0] + '#reports'; U.copy(link); U.toast('Share link copied. Recipients need access to this workspace.'); S.log('Share link created for ' + sel.title, 'Config', 'Success'); };
      U.$('#rep-tpl', el).onclick = () => this.template();
      U.$('#rep-new', el).onclick = () => {
        if (!GX.guard()) return;
        U.modal({ title: 'Generate new report', body: `<div class="field"><label for="nr-type">Report type</label><select class="select" id="nr-type"><option value="ENGINEERING">Engineering Analysis Report</option><option value="SIMULATION">Comprehensive System Analysis</option><option value="FINANCIAL">Financial Investment Report</option><option value="RISK">Risk Assessment</option><option value="COMPLIANCE">Environmental Impact Audit</option><option value="MONITORING">Operational Performance Report</option></select></div><div class="field"><label for="nr-title">Title</label><input class="input" id="nr-title" value="Engineering Analysis Report"></div>`,
          onMount: m => { U.$('#nr-type', m).onchange = e => { U.$('#nr-title', m).value = e.target.selectedOptions[0].textContent; }; },
          actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Generate', kind: 'accent', onClick: m => { this.create(U.$('#nr-title', m).value || 'Report', U.$('#nr-type', m).value); this.paint(el); } }] });
      };
    },
    doc(rep, r, o) {
      const c = S.cur(), p = c.project, d = c.design, st = S.state.settings, tpl = st.tpl || {};
      const k = GX.views['risk-engine'].model(), sc = S.scenarios(), L = E.loadCalc(p);
      const cmp = E.compliance(r, p, d, U);
      const verdict = r.suit >= 75 && r.paybackYears < 12 ? ['Recommended', 'Geothermal is technically suitable and financially viable for this property.', 'green'] : r.suit >= 60 ? ['Conditionally recommended', 'Suitable subject to a thermal response test and confirmation of drilling conditions.', 'amber'] : ['Not recommended at this stage', 'Site or economic conditions do not support a geothermal system without changes.', 'red'];
      const T = rows => `<table class="rt">${rows.map(r2 => r2.length === 1 ? `<tr class="rt-h"><td colspan="2">${r2[0]}</td></tr>` : `<tr><td>${r2[0]}</td><td>${r2[1]}</td></tr>`).join('')}</table>`;
      const date = new Date(rep.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const rid = `${p.ref}-${rep.type.slice(0, 3)}-${rep.date.replace(/-/g, '')}`;
      const monthly = E.MONTHS.map((m, i) => [m, p.heatDemand * E.HEAT_W[i] / 1000, p.coolDemand * E.COOL_W[i] / 1000]);
      const mmax = Math.max(...monthly.map(x => Math.max(x[1], x[2])));
      const chartLoads = o.charts ? `<div class="rc-chart">${monthly.map(x => `<div class="rc-m"><div class="rc-bars"><i style="height:${x[1] / mmax * 100}%;background:#f59e0b"></i><i style="height:${x[2] / mmax * 100}%;background:#14b8a6"></i></div><span>${x[0][0]}</span></div>`).join('')}</div><div class="rc-leg"><span><i style="background:#f59e0b"></i>Heating MWh</span><span><i style="background:#14b8a6"></i>Cooling MWh</span></div>` : '';
      const cumMax = Math.max(r.netCapex, Math.abs(r.cum[15]));
      const chartCash = o.charts ? `<div class="rc-chart cash">${[...Array(16).keys()].map(y => { const v = r.cum[y]; return `<div class="rc-m"><div class="rc-bars c2"><i style="height:${Math.abs(v) / cumMax * 50}%;${v < 0 ? 'top:50%;background:#fca5a5' : 'bottom:50%;background:#14b8a6'}"></i></div><span>${y}</span></div>`; }).join('')}</div><div class="rc-leg"><span><i style="background:#fca5a5"></i>Net position below break-even</span><span><i style="background:#14b8a6"></i>Cumulative net gain (years 0–15)</span></div>` : '';
      const S_ = {
        exec: [3, `<h4>Executive Summary</h4><div class="verdict-box ${verdict[2]}"><b>${verdict[0]}</b><span>${verdict[1]}</span></div>
          <p>${esc(p.name)} is a ${U.area(p.floorArea)}, ${p.floors}-storey ${esc(p.buildingType.toLowerCase())} in ${esc(r.loc.city)} (${r.c.label}). The recommended ${d.orient} ${d.loop}-loop ground-source heat pump system uses <b>${d.n} boreholes at ${U.len(d.depth)}</b> (${U.len(r.L)} total loop) with ${U.pow(Math.max(d.heatPeak, d.coolPeak))} of heat pump capacity. It achieves a seasonal COP of <b>${r.SCOP.toFixed(2)}</b>, reduces HVAC energy cost by ${((1 - r.gshpCost / r.baselineCost) * 100).toFixed(0)}% and avoids ${U.n(r.co2Saved, 0)} t CO₂ per year.</p>
          ${o.fin ? `<p>Estimated investment is <b>${U.moneyK(r.capexLow)}–${U.moneyK(r.capexHigh)}</b> before incentives (${U.money(r.netCapex)} net). Expected annual savings of ${U.money(r.annualSavings)} give a payback of <b>${r.paybackLow.toFixed(1)}–${r.paybackHigh.toFixed(1)} years</b> (base case ${GX.pb(r.paybackYears)}).</p>` : ''}`],
        source: [3, `<h4>Source Data</h4>` + T([['Building / property'], ['Building type', esc(p.buildingType)], ['Total floor area', U.area(p.floorArea)], ['Floors', p.floors], ['Construction / envelope', esc(p.vintage || '—')], ['Operating schedule', esc(p.hours || '—')], ['Glazing ratio', esc(p.glazing || '—')], ['Site'], ['Location', `${esc(r.loc.label)} (${r.loc.lat.toFixed(4)}° N, ${Math.abs(r.loc.lon).toFixed(4)}° W)`], ['Climate zone', r.c.label], ['Ground type', esc(p.ground)], ['Drilling depth limit', U.len(p.depthLimit)], ['Available land', p.siteArea ? U.area(p.siteArea) : 'not specified'], ['Data fidelity', esc(p.fidelity)], ['Energy & cost assumptions'], ['Load basis', p.loadMode === 'calculated' ? 'Calculated (degree-day method)' : 'Known demand (utility / metered data)'], ['Electricity / natural gas', `$${st.elec}/kWh · $${st.gas}/kWh`], ['Escalation / discount rate', `${(st.escalation * 100).toFixed(1)}% · ${(st.discount * 100).toFixed(1)}%`]])],
        site: [2, `<h4>Property &amp; Site Description</h4><p>The site lies in ${r.c.label} with an undisturbed ground temperature of about ${U.temp(r.c.tg)}, ${U.dd(r.c.hdd)} heating and ${U.dd(r.c.cdd)} cooling degree-days (${U.ddBase()}). Subsurface conditions are characterised as ${esc(p.ground.toLowerCase())} with an effective thermal conductivity of ${U.cond(r.g.k)}, drillability index ${(r.g.drillability * 100).toFixed(0)}% and geological stability ${(r.g.stability * 100).toFixed(0)}%.</p><p>The borefield requires about ${U.area(r.footprint * 1.15)} including setbacks${p.siteArea ? ` against ${U.area(p.siteArea)} of available land (${(r.footprint * 1.15 / p.siteArea * 100).toFixed(0)}% utilisation)` : ''}.</p>`],
        loads: [3, `<h4>Building Thermal Loads</h4>` + T([['Annual heating demand', `${U.n(p.heatDemand / 1000)} MWh`], ['Annual cooling demand', `${U.n(p.coolDemand / 1000)} MWh`], ['Design peak heating / cooling', `${U.pow(d.heatPeak)} / ${U.pow(d.coolPeak)}`], ['Block peak thermal load', U.pow(p.peakLoad)], ['Calculated estimate (for comparison)', `${U.n(L.heat / 1000)} / ${U.n(L.cool / 1000)} MWh · UA ${U.ua(L.UA)}`], ['Load balance', `${p.coolDemand > p.heatDemand ? 'Cooling' : 'Heating'}-dominated, imbalance ${(r.imbalance * 100).toFixed(0)}%`]]) + chartLoads],
        appl: [2, `<h4>Geothermal Applicability Assessment</h4>` + T([['Thermal conductivity (30%)', (r.kScore * 100).toFixed(0) + ' / 100'], ['Drillability (20%)', (r.g.drillability * 100).toFixed(0) + ' / 100'], ['Geological stability (15%)', (r.g.stability * 100).toFixed(0) + ' / 100'], ['Climate fit (15%)', (r.c.fit * 100).toFixed(0) + ' / 100'], ['Depth allowance (10%)', (Math.min(1, p.depthLimit / 300) * 100).toFixed(0) + ' / 100'], ['Data fidelity (10%)', ((E.FIDELITY[p.fidelity] || 1) * 100).toFixed(0) + ' / 100'], ['Suitability score', `<b>${r.suit} / 100</b> · ${r.suit >= 85 ? 'Excellent' : r.suit >= 70 ? 'Good' : r.suit >= 55 ? 'Fair' : 'Poor'}`]])],
        loop: [3, `<h4>Ground Loop &amp; Drilling Parameters</h4>` + T([['System type', `${d.orient === 'vertical' ? 'Vertical' : 'Horizontal'} ${d.loop}-loop`], ['Boreholes × depth', `${d.n} × ${U.len(d.depth)}`], ['Borehole spacing', U.len(d.spacing, 1)], ['Installed / required loop length', `${U.len(r.L)} / ${U.len(r.Lreq)} (${(r.ratio * 100).toFixed(0)}%)`], ['Loop ratio (reference check)', `${U.loopRatio(r)} · typical ${U.loopRange()}`], ['Heat transfer fluid · flow', `${esc(d.fluid)} · ${U.flow(d.flow)} per loop`], ['Entering water temp. heating / cooling', `${U.temp(r.EWTh)} / ${U.temp(r.EWTc)}`], ['COP heating / cooling / seasonal', `${r.COPh.toFixed(2)} / ${r.COPc.toFixed(2)} / <b>${r.SCOP.toFixed(2)}</b>`], ['Ground temperature drift', `${U.dT(r.drift, 2)} per year`], ['Drilling rate (estimate)', `$${r.drillPerM.toFixed(2)}/m`]])],
        fin: [4, `<h4>Financial Indicators</h4>` + T([['Drilling & ground loop', U.money(r.drilling)], ['Heat pump equipment', U.money(r.equipment)], ['Integration & field preparation', U.money(r.integration)], ['Total CAPEX (range)', `<b>${U.money(r.capex)}</b> (${U.moneyK(r.capexLow)}–${U.moneyK(r.capexHigh)})`], ['Incentives (tax credit, grants, rebates)', '−' + U.money(r.incentives)], ['Avoided baseline equipment (' + esc(E.PROJECT_TYPES[r.projectType].short.toLowerCase()) + ')', r.avoided > 0 ? '−' + U.money(r.avoided) : 'not credited'], ['Net investment', U.money(r.netCapex)], ['Baseline system', esc(r.baseline.label)], ['Energy prices used', `electricity $${r.inputs.s.elec.toFixed(3)}/kWh${r.baseline.fuel !== 'elec' ? ` · ${r.baseline.fuel} $${r.baseline.price.toFixed(3)}/kWh` : ''} (${esc(r.loc.state)}, ${r.sector})`], ['Annual energy cost: current system / geothermal', `${U.money(r.baselineCost)} / ${U.money(r.gshpCost)}`], ['Annual savings incl. maintenance', U.money(r.annualSavings)], ['Payback (range)', `<b>${GX.pb(r.paybackYears)} yrs</b> (${r.paybackLow.toFixed(1)}–${Math.min(25, r.paybackHigh).toFixed(1)})`], ['10-yr ROI · 20-yr NPV · IRR', `${r.roi10.toFixed(0)}% · ${U.money(r.npv20)} · ${r.irr != null ? (r.irr * 100).toFixed(1) + '%' : 'n/a'}`]]) + chartCash],
        scen: [2, `<h4>Scenario Comparison</h4><table class="rt sc3"><tr class="rt-h"><td></td>${sc.list.map(x => `<td>${x.name}${x.best ? ' ★' : ''}</td>`).join('')}</tr>${[['Configuration', x => `${x.design.n} × ${U.len(x.design.depth)}`], ['Seasonal COP', x => x.r.SCOP.toFixed(2)], ['CAPEX', x => U.moneyK(x.r.capex)], ['Annual savings', x => U.moneyK(x.r.annualSavings)], ['Payback', x => GX.pb(x.r.paybackYears) + ' yrs'], ['Risk', x => x.riskLabel]].filter(rw => o.fin || !/CAPEX|savings|Payback/.test(rw[0])).map(([l, f]) => `<tr><td>${l}</td>${sc.list.map(x => `<td>${f(x)}</td>`).join('')}</tr>`).join('')}</table><p>★ Recommended: <b>${sc.best.name}</b>, the best balance of efficiency, payback and risk.</p>`],
        risk: [2, `<h4>Risk Assessment</h4><p>Aggregate risk score <b>${r.risk.score}/100 (${r.risk.label})</b>. Without mitigation, seasonal COP may fall from ${r.SCOP.toFixed(2)} to ${k.cop12.toFixed(2)} within 12 months of operation.</p>` + T(k.risks.map(x => [x.name, `${x.prob.toFixed(0)}% probability · horizon ${x.hz}`]).concat([['Mitigation (rebalancing, +' + U.dT(2, 0) + ' return, pump trim)', `risk score → ${k.mitigated.risk.score}`]]))],
        safety: [3, `<h4>Safety, Permits &amp; Compliance</h4><table class="rt cmp-t">${cmp.map(i => { const done = i.status === 'action' && (c.checks || {})[i.title]; const lab = done ? 'Done' : { pass: 'Pass', warn: 'Review', fail: 'Fail', action: 'Action' }[i.status]; return `<tr><td><span class="st st-${done ? 'pass' : i.status}">${lab}</span></td><td><b>${esc(i.title)}</b><br><span>${esc(i.note)} (${esc(i.ref)})</span></td></tr>`; }).join('')}</table>`],
        co2: [1, `<h4>Environmental Impact</h4><p>Avoided emissions: <b>${U.n(r.co2Saved, 0)} t CO₂ per year</b> (${r.co2Pct.toFixed(0)}% of whole-building emissions), about ${U.n(r.co2Saved * 20, 0)} t over 20 years, using a grid factor of ${r.loc.grid} kg CO₂/kWh.</p>`],
        ops: [2, `<h4>Operational Summary</h4><p>${GX.deployed() ? `The system is operational. Live seasonal COP tracks around ${r.SCOP.toFixed(2)} with ${A.counts().active} open issue(s).` : 'The system is not yet installed; operational data will be added after commissioning.'}</p>`],
        snap: [1, rep.snap ? `<h4>Simulation Snapshot</h4><p>Saved run: average COP ${rep.snap.avgCop.toFixed(2)}, minimum ${rep.snap.minCop.toFixed(2)}, degradation ${rep.snap.deg.toFixed(1)}%/yr, overload probability ${rep.snap.overload.toFixed(0)}%.</p>` : ''],
        next: [3, `<h4>Recommendations &amp; Next Steps</h4><ol class="rl">
          ${r.suit < 85 || p.fidelity !== 'Measured on site (TRT / drill log)' ? '<li>Commission a thermal response test (TRT) on a test borehole to confirm ground conductivity before final sizing.</li>' : '<li>Confirm ground conductivity with a thermal response test during the first drilling mobilization.</li>'}
          ${sc.best.design.n !== d.n || sc.best.design.depth !== d.depth ? `<li>Evaluate the ${sc.best.name.toLowerCase()} (${sc.best.design.n} × ${U.len(sc.best.design.depth)}), which improves payback to ${GX.pb(sc.best.r.paybackYears)} years.</li>` : '<li>Proceed with the current layout as the basis of design.</li>'}
          ${r.imbalance > 0.2 ? '<li>Address the seasonal load imbalance through load rebalancing, supplemental heat rejection or wider spacing in later phases.</li>' : ''}
          ${d.flow > 1.0 ? '<li>Reduce design circulation flow to about ${U.flow(0.95)} per loop with variable-speed pumping to cut pump energy.</li>' : ''}
          <li>Engage a licensed engineer to prepare construction documents and obtain state drilling and local building permits.</li>
          <li>Request drilling bids with the parameters in Section ${''}“Ground Loop &amp; Drilling Parameters”, including grouting and pressure-test requirements.</li>
          <li>Confirm eligibility and current rates for federal tax credits, utility rebates and grants.</li></ol>`],
        method: [2, `<h4>Methodology &amp; Assumptions</h4><ul class="rl"><li>Economics: savings vs. the current system (<b>${esc(r.baseline.label)}</b>), using ${p.econ && Object.keys(p.econ).length ? "project-specific prices and incentives" : "average " + r.sector + " energy prices for " + esc(r.loc.state) + " (EIA, approx. 2024)"}; ${r.avoided > 0 ? "cost of the conventional equipment no longer needed is credited (" + esc(E.PROJECT_TYPES[r.projectType].short.toLowerCase()) + ")" : "no credit for avoided equipment (early retrofit)"}; federal credit ${Math.round(r.inputs.s.itc * 100)}%.</li><li>Loads: degree-day method for annual energy and design-day conditions for peaks${p.loadMode === 'known' ? '; annual demand taken from user-supplied utility data' : ''}.</li><li>Loop sizing: required length from peak heating and cooling with a specific heat-exchange rate of 20 × k W/m (≈ ${U.wpm(r.qh)} here) adjusted for borehole spacing interference.</li><li>Efficiency: heat pump COP from entering water temperature; seasonal COP weighted by heating and cooling energy; ground drift from annual heat imbalance.</li><li>Costs: regional drilling rate by ground type with a depth premium; ${U.perPow(r.inputs.s.equipRate)} heat pumps; integration and field preparation.</li><li>Finance: ${(st.escalation * 100).toFixed(1)}% energy escalation, ${(st.discount * 100).toFixed(1)}% discount rate, ${(st.itc * 100).toFixed(0)}% federal tax credit${st.includeItc ? '' : ' (excluded)'}; system degradation ${r.degr.toFixed(2)}%/yr.</li></ul>`],
        limits: [2, `<h4>Limitations &amp; Disclaimer</h4><p>This report is a preliminary engineering assessment generated by the GeoThermX platform from the data listed in Source Data and the platform's calculation logic. It is intended for early-stage decision-making and does not replace licensed engineering design, a thermal response test, geotechnical investigation, or required state and local permitting. Costs and incentives are estimates and should be confirmed with contractor bids and current program rules.</p>
          <div class="sign"><div><span>Prepared by</span><b>${esc(tpl.author || '&nbsp;')}</b><em>${esc(tpl.company || 'GeoThermX platform')}</em></div><div><span>Reviewed by</span><b>&nbsp;</b><em>Licensed professional engineer</em></div></div>`]
      };
      const SETS = {
        ENGINEERING: ['exec', 'source', 'site', 'loads', 'appl', 'loop', 'fin', 'scen', 'risk', 'safety', 'co2', 'next', 'method', 'limits'],
        SIMULATION: ['exec', 'loads', 'loop', 'snap', 'scen', 'risk', 'next', 'method', 'limits'],
        FINANCIAL: ['exec', 'source', 'fin', 'scen', 'next', 'method', 'limits'],
        RISK: ['exec', 'loop', 'risk', 'safety', 'next', 'limits'],
        COMPLIANCE: ['exec', 'site', 'safety', 'co2', 'limits'],
        MONITORING: ['exec', 'ops', 'loop', 'risk', 'limits']
      };
      let keys = (SETS[rep.type] || SETS.ENGINEERING).filter(x => (o.fin || x !== 'fin') && (o.risk || (x !== 'risk' && x !== 'safety')) && S_[x][1]);
      const pages = []; let cur = [], w = 0;
      keys.forEach((key, idx) => { const sec = S_[key]; if (w + sec[0] > 6 && cur.length) { pages.push(cur); cur = []; w = 0; } cur.push(`<section><div class="sn">${idx + 1}</div>${sec[1]}</section>`); w += sec[0]; });
      if (cur.length) pages.push(cur);
      const total = pages.length + 1;
      const head = n => `<div class="pg-h"><span>GeoThermX · ${esc(rep.title)}</span><span>${esc(p.name)} · ${rid}</span></div>`;
      const foot = n => `<div class="pg-f"><span>Preliminary engineering estimate · ${date}</span><span>Page ${n} of ${total}</span></div>`;
      const cover = `<div class="paper cover"><div class="cv-brand">GeoThermX</div><div class="eyebrow">${esc(rep.type === 'ENGINEERING' ? 'Engineering Analysis Report' : rep.type.charAt(0) + rep.type.slice(1).toLowerCase() + ' Report')}</div>
        <h2>${esc(rep.title)}</h2><div class="cv-proj">${esc(p.name)}</div><div class="rule"></div>
        <table class="rt cv-t"><tr><td>Client</td><td>${esc(tpl.company || p.client || '—')}</td></tr><tr><td>Site</td><td>${esc(r.loc.city)} · ${r.c.label}</td></tr><tr><td>Project reference</td><td>${esc(p.ref)}</td></tr><tr><td>Report ID</td><td>${rid}</td></tr><tr><td>Date</td><td>${date}</td></tr><tr><td>Prepared by</td><td>${esc([tpl.author, tpl.company].filter(Boolean).join(', ') || 'GeoThermX platform')}</td></tr></table>
        <div class="verdict-box ${verdict[2]}" style="margin-top:22px"><b>${verdict[0]}</b><span>${verdict[1]}</span></div>
        <div class="kf">${[['Suitability', r.suit + '/100'], ['Seasonal COP', r.SCOP.toFixed(2)], ['Boreholes', `${d.n} × ${U.len(d.depth)}`], o.fin ? ['CAPEX range', `${U.moneyK(r.capexLow)}–${U.moneyK(r.capexHigh)}`] : ['Loop length', U.len(r.L)], o.fin ? ['Payback', `${r.paybackLow.toFixed(1)}–${r.paybackHigh.toFixed(1)} yrs`] : ['Risk', r.risk.score + '/100'], ['CO₂ avoided', U.n(r.co2Saved, 0) + ' t/yr']].map(([a, b2]) => `<div><span>${a}</span><b>${b2}</b></div>`).join('')}</div>
        ${foot(1)}</div>`;
      return cover + pages.map((pg, i) => `<div class="paper">${head(i + 2)}${pg.join('')}${foot(i + 2)}</div>`).join('');
    },
    excel(rep) {
      const r = S.result(), c = S.cur();
      const rows = [['GeoThermX report data', rep.title], ['Project', c.project.name], ['Generated', new Date().toISOString()], [], ['Section', 'Metric', 'Value', 'Unit'],
        ['Design', 'Boreholes', c.design.n, ''], ['Design', 'Depth', Math.round(U.lenV(c.design.depth)), U.lenU()], ['Design', 'Spacing', +U.lenV(c.design.spacing).toFixed(1), U.lenU()], ['Design', 'Loop length', Math.round(U.lenV(r.L)), U.lenU()],
        ['Performance', 'Seasonal COP', r.SCOP.toFixed(2), ''], ['Performance', 'Efficiency score', r.effScore.toFixed(1), '%'], ['Performance', 'Annual output', r.annualOutput.toFixed(0), 'MWh'],
        ['Financial', 'CAPEX', Math.round(r.capex), 'USD'], ['Financial', 'Incentives', Math.round(r.incentives), 'USD'], ['Financial', 'Annual savings', Math.round(r.annualSavings), 'USD'], ['Financial', 'Payback', r.paybackYears.toFixed(2), 'years'], ['Financial', 'ROI 10y', r.roi10.toFixed(1), '%'], ['Financial', 'IRR 20y', r.irr != null ? (r.irr * 100).toFixed(2) : '', '%'],
        ['Risk', 'Aggregate score', r.risk.score, '/100'], ['Carbon', 'CO2 avoided', r.co2Saved.toFixed(1), 't/yr'], [], ['Year', 'Savings (USD)', 'Cumulative net (USD)']].concat(r.flows.slice(0, 20).map((f, i) => [i + 1, Math.round(f), Math.round(r.cum[i + 1])]));
      U.exportData('Excel data', `${c.project.ref}-${rep.type.toLowerCase()}.csv`, U.csv(rows), 'text/csv'); S.log('Excel data exported: ' + rep.title, 'Config', 'Success');
    },
    pdf(el, rep) {
      S.log('PDF export: ' + rep.title, 'Config', 'Success');
      let framed = false; try { framed = window.self !== window.top; } catch (e) { framed = true; }
      if (!framed) { document.body.classList.add('print-doc'); setTimeout(() => { window.print(); document.body.classList.remove('print-doc'); }, 50); return; }
      const text = U.$('#paper', el).innerText;
      U.modal({ title: 'Export report', wide: true, body: `<div class="muted" style="font-size:13px">This preview window blocks printing. Open the downloaded GeoThermX project in a browser to save the report as a PDF, or copy the report text below.</div><div class="code-box" style="white-space:pre-wrap">${esc(text)}</div>`, actions: [{ label: 'Copy text', kind: 'primary', onClick: () => { U.copy(text); return false; } }, { label: 'Close', kind: 'ghost' }] });
    },
    template() {
      const t = S.state.settings.tpl || {};
      U.modal({ title: 'Customize report template', body: `<div class="field"><label for="tp-co">Client / company name</label><input class="input" id="tp-co" value="${esc(t.company || '')}" placeholder="e.g. Aurora Development LLC"></div><div class="field"><label for="tp-au">Prepared by</label><input class="input" id="tp-au" value="${esc(t.author || 'AI Assistant')}"></div>`,
        actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Save template', kind: 'primary', onClick: m => { S.setSettings({ tpl: { company: U.$('#tp-co', m).value.trim(), author: U.$('#tp-au', m).value.trim() || 'AI Assistant' } }); U.toast('Report template saved'); } }] });
    }
  };

  /* ================= SETTINGS ================= */
  GX.views.preferences = {
    name: 'Settings', header: { mode: 'title', title: 'Settings' },
    render(el) { el.innerHTML = '<div id="pref"></div>'; this.paint(el); },
    paint(el) {
      const s = S.state.settings;
      const f = (id, l, v, step, suf) => `<div class="field"><label for="${id}">${l} <span class="muted" style="font-weight:400">${suf}</span></label><input class="input num pf" id="${id}" type="number" step="${step}" value="${v}" data-edit></div>`;
      U.$('#pref', el).innerHTML = `<div class="pref-grid">
        <div class="card pad"><h3 class="card-title">Report Details</h3><div class="pf-b">
          <p class="muted" style="font-size:13px;margin:0">Optional. Shown on the cover and signature block of your engineering reports.</p>
          <div class="field"><label for="pf-co">Company / organization</label><input class="input" id="pf-co" value="${esc((s.tpl || {}).company || '')}" placeholder="Your company name"></div>
          <div class="field"><label for="pf-au">Prepared by</label><input class="input" id="pf-au" value="${esc((s.tpl || {}).author || '')}" placeholder="Name of the person preparing reports"></div>
          <button class="btn btn-primary" id="pf-save" style="align-self:flex-start">Save</button></div></div>
        <div class="card pad"><h3 class="card-title">Prices &amp; Incentives</h3><div class="pf-b">
          <p class="muted" style="font-size:13px;margin:0">Energy prices, installed costs and incentives are set per project, starting from state averages and the project sector, on the <b>Costs &amp; Incentives</b> page.</p>
          <button class="btn btn-ghost" data-go="costs" style="align-self:flex-start">Open Costs &amp; Incentives →</button></div></div>
        <div class="card pad"><h3 class="card-title">Preferences</h3><div class="pf-b">
          <div class="field"><label>Units</label><div class="seg"><button data-units="imperial" class="${s.units === 'imperial' ? 'on' : ''}">US (ft, ft², tons, °F, gpm)</button><button data-units="metric" class="${s.units !== 'imperial' ? 'on' : ''}">Metric (m, m², kW, °C, L/s)</button></div><div class="fhint">Changes every page, chart, report and export at once. Data is stored once, so switching never changes results.</div></div>
          <div class="between"><div><b style="font-size:13.5px">Show page tips</b><div class="muted" style="font-size:12.5px">One-line explanation and “Next step” button at the top of each page.</div></div><button class="toggle ${s.tips !== false ? 'on' : ''}" id="pf-tips" aria-label="Show page tips"></button></div></div></div>
        <div class="card pad"><div class="between"><h3 class="card-title">Audit Log</h3><button class="link-btn" id="pf-log-exp">Export CSV</button></div><div class="log-table audit">${S.logs().slice(0, 40).map(x => `<div class="lt-r"><span class="num">${U.stamp(x.t)}</span><span>${esc(x.msg)}</span><span>${esc(x.cat)}</span><span>${esc(x.status)}</span></div>`).join('')}</div></div>
        <div class="card pad danger"><h3 class="card-title">Data</h3><p class="muted" style="font-size:13px;margin:10px 0 14px">Projects are saved in this browser. ${S.state.projects.sample ? 'The sample project is loaded.' : 'You can load a sample project to explore all features.'}</p><div class="row" style="gap:10px;flex-wrap:wrap">${S.state.projects.sample ? '' : '<button class="btn btn-ghost" data-load-sample="1">Load sample project</button>'}<button class="btn btn-ghost" id="pf-reset" style="color:var(--red);border-color:#fecaca">Delete all data</button></div></div>
      </div>`;
      U.$('#pf-tips', el).onclick = () => { const on = S.state.settings.tips === false; S.setSettings({ tips: on, hiddenTips: {} }); U.toast(on ? 'Page tips shown' : 'Page tips hidden'); };
      U.$('#pf-save', el).onclick = () => { S.setSettings({ tpl: { company: U.$('#pf-co', el).value.trim(), author: U.$('#pf-au', el).value.trim() } }); U.toast('Report details saved'); };
      U.$('#pf-log-exp', el).onclick = () => U.exportData('Audit log', 'geothermx-audit-log.csv', U.csv([['timestamp', 'event', 'category', 'status']].concat(S.logs().map(x => [x.t, x.msg, x.cat, x.status]))), 'text/csv');
      U.$('#pf-reset', el).onclick = () => U.modal({ title: 'Delete all data?', body: '<p style="margin:0">This permanently deletes all projects, reports and settings stored in this browser.</p>', actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Delete everything', kind: 'dark', onClick: () => { S.reset(); U.toast('All data deleted'); } }] });
    }
  };
})();
