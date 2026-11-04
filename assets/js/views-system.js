/* GeoThermX views: AI Assistant (Engineering Copilot), Reports (Documentation Hub), Settings */
(function () {
  'use strict';
  const U = window.GXUI, S = window.GXStore, E = window.GXEngine, A = window.GXAlerts;
  const GX = window.GX; const esc = U.esc;

  /* ================= AI ASSISTANT ================= */
  function optimizations() {
    const c = S.cur(), r = S.result(), d = c.design, out = [];
    const dd = Math.min(12, c.project.depthLimit - d.depth);
    if (dd >= 5) { const w = GX.whatIf({ depth: d.depth + dd }); out.push({ id: 'depth', label: 'Optimize Borehole Layout', text: `Increase borehole circulation depth by ${dd}m to add loop length in the ${r.g.layer} (k = ${r.g.k} W/m·K).`, gain: w.SCOP / r.SCOP - 1, patch: { depth: d.depth + dd } }); }
    else { const w = GX.whatIf({ spacing: d.spacing + 0.7 }); out.push({ id: 'spacing', label: 'Optimize Borehole Layout', text: `Widen borehole spacing to ${(d.spacing + 0.7).toFixed(1)}m to reduce thermal interference (depth is at the ${c.project.depthLimit} m limit).`, gain: w.SCOP / r.SCOP - 1, patch: { spacing: +(d.spacing + 0.7).toFixed(1) } }); }
    if (!c.mitigation.rebalance) { const w = GX.whatIf(null, { rebalance: true }); out.push({ id: 'rebalance', label: 'Rebalance Seasonal Load', text: 'Rebalance seasonal load (e.g. supplemental heat rejection or extraction) so annual ground heat flows even out.', gain: w.SCOP / r.SCOP - 1, mit: { rebalance: true } }); }
    if (d.flow > 1.0) { const w = GX.whatIf({ flow: 0.95 }); out.push({ id: 'flow', label: 'Reduce Pump Energy', text: `Trim circulation from ${d.flow.toFixed(2)} to 0.95 L/s per loop to cut pump power by ${((1 - w.pumpKw / r.pumpKw) * 100).toFixed(0)}%.`, gain: w.annualSavings / r.annualSavings - 1, patch: { flow: 0.95 } }); }
    if (!c.mitigation.returnTemp) { const w = GX.whatIf(null, { returnTemp: 2 }); out.push({ id: 'valve', label: 'Reduce Peak Load Asymmetry', text: 'Reduce peak usage imbalance by raising the loop return temperature setpoint by 2°C.', gain: w.SCOP / r.SCOP - 1, mit: { returnTemp: 2 } }); }
    return out.sort((a, b) => b.gain - a.gain).slice(0, 3);
  }
  function reply(q) {
    const t = q.toLowerCase(); const r = S.result(), c = S.cur(), d = c.design;
    const m = t.match(/(boreholes?|depth|spacing|flow|electricity|power price|gas)\D{0,12}?(\d+(?:\.\d+)?)/);
    if (m) {
      const v = parseFloat(m[2]); let dp = null, sp = null, label;
      if (m[1].startsWith('borehole')) { dp = { n: Math.round(v) }; label = `${Math.round(v)} boreholes`; }
      else if (m[1] === 'depth') { dp = { depth: Math.min(v, c.project.depthLimit) }; label = `${Math.min(v, c.project.depthLimit)} m depth`; }
      else if (m[1] === 'spacing') { dp = { spacing: v }; label = `${v} m spacing`; }
      else if (m[1] === 'flow') { dp = { flow: v }; label = `${v} L/s flow`; }
      else if (m[1] === 'gas') { sp = { gas: v > 1 ? v / 100 : v }; label = `gas at $${(sp.gas).toFixed(3)}/kWh`; }
      else { sp = { elec: v > 1 ? v / 100 : v }; label = `electricity at $${sp.elec.toFixed(3)}/kWh`; }
      const w = GX.whatIf(dp, null, sp);
      return { html: `With <b>${label}</b> the model projects:<ul><li>Seasonal COP <b>${w.SCOP.toFixed(2)}</b> (${U.signed((w.SCOP / r.SCOP - 1) * 100, 1, '%')})</li><li>CAPEX <b>${U.money(w.capex)}</b> (${U.signed((w.capex - r.capex) / 1000, 0, 'K')})</li><li>Annual savings <b>${U.money(w.annualSavings)}</b>, payback <b>${GX.pb(w.paybackYears)} yrs</b> (${U.signed((w.paybackYears - r.paybackYears) * 12, 0)} months)</li><li>Loop coverage <b>${(w.ratio * 100).toFixed(0)}%</b> of required length, risk score <b>${w.risk.score}</b></li></ul>`, apply: dp ? { patch: dp, label: 'Apply ' + label } : { settings: sp, label: 'Use ' + label } };
    }
    if (/(roi|payback|return|savings)/.test(t) && /(rebalanc|balanc)/.test(t)) {
      const w = GX.whatIf(null, { rebalance: true });
      return { html: `Applying the load rebalancing immediately will yield a <b>${((w.SCOP / r.SCOP - 1) * 100).toFixed(1)}% increase in COP</b>. This translates to an estimated <b>${U.money(w.annualSavings - r.annualSavings)} in annual energy savings</b>, reducing your total payback period by ${Math.max(0, Math.round((r.paybackYears - w.paybackYears) * 12))} months and lowering the aggregate risk score from ${r.risk.score} to ${w.risk.score}.`, apply: c.mitigation.rebalance ? null : { mit: { rebalance: true }, label: 'Apply load rebalancing' } };
    }
    if (/(improve|efficien|optimi[sz]|cop)/.test(t) && !/explain/.test(t)) {
      const o = optimizations(); GX.views['ai-assistant'].state.recs = o.map(x => x.id);
      return { html: `Based on the latest thermal simulation and real-time load data, I have identified ${o.length} key optimizations for this project:<ul class="arrows">${o.map(x => `<li><b>${esc(x.text)}</b> <span class="muted">(${U.signed(x.gain * 100, 1, '%')} ${x.id === 'flow' ? 'savings' : 'COP'})</span></li>`).join('')}</ul>Would you like me to run a simulation with these parameters?`, followSim: true };
    }
    if (/(risk|danger|fail|threat)/.test(t)) {
      const k = GX.views['risk-engine'].model();
      return { html: `Aggregate risk is <b>${r.risk.score}/100 (${r.risk.label})</b>. Top risks:<ul>${k.risks.map(x => `<li><b>${x.name}</b>: ${x.prob.toFixed(0)}% probability, horizon ${x.hz}</li>`).join('')}</ul>Without mitigation, seasonal COP is projected to fall from ${r.SCOP.toFixed(2)} to ${k.cop12.toFixed(2)} within 12 months. The mitigation plan (rebalancing, +2°C return temperature, pump trim) would cut the score to <b>${k.mitigated.risk.score}</b>.`, apply: k.applied ? null : { mit: { rebalance: true, returnTemp: 2, flowOpt: true }, label: 'Apply mitigation plan' } };
    }
    if (/(cost|capex|opex|cheaper|budget|reduce)/.test(t)) {
      const sc = S.scenarios(); const ce = sc.list[2], best = sc.best;
      return { html: `Current CAPEX is <b>${U.money(r.capex)}</b> (drilling ${U.money(r.drilling)}, heat pumps ${U.money(r.equipment)}, integration ${U.money(r.integration)}). Options to reduce it:<ul><li><b>${best.name}</b>: ${best.design.n} × ${best.design.depth} m at ${best.design.spacing} m spacing → CAPEX ${U.money(best.r.capex)}, payback ${GX.pb(best.r.paybackYears)} yrs.</li><li><b>${ce.name}</b>: CAPEX ${U.money(ce.r.capex)} but risk is ${ce.riskLabel.toLowerCase()} and COP drops to ${ce.r.SCOP.toFixed(2)}.</li><li>Pump trim to 0.95 L/s lowers annual OPEX by ${U.money(Math.max(0, GX.whatIf({ flow: 0.95 }).annualSavings - r.annualSavings))}.</li></ul>`, apply: { patch: { n: best.design.n, depth: best.design.depth, spacing: best.design.spacing, flow: best.design.flow }, label: 'Apply ' + best.name } };
    }
    if (/(co2|carbon|emission|climate)/.test(t)) return { html: `The system avoids <b>${U.n(r.co2Saved, 0)} t CO₂ per year</b>, a ${r.co2Pct.toFixed(0)}% cut in whole-building emissions, using a grid factor of ${r.loc.grid} kg/kWh for ${esc(r.loc.city)}. Over 20 years that is about ${U.n(r.co2Saved * 20, 0)} t.` };
    if (/(explain|why|performance|how)/.test(t)) return { html: `Performance is driven by entering water temperature (EWT). In heating the loop delivers <b>${r.EWTh.toFixed(1)}°C</b> (COP ${r.COPh.toFixed(2)}); in cooling it returns <b>${r.EWTc.toFixed(1)}°C</b> (COP ${r.COPc.toFixed(2)}). Weighted by your ${U.n(c.project.heatDemand / 1000)} MWh heating and ${U.n(c.project.coolDemand / 1000)} MWh cooling demand, the seasonal COP is <b>${r.SCOP.toFixed(2)}</b>. The installed ${U.n(r.L, 0)} m loop covers ${(r.ratio * 100).toFixed(0)}% of the ${U.n(r.Lreq, 0)} m required. Because annual heat rejection exceeds extraction, ground temperature drifts ${U.signed(r.drift, 2, '°C')}/yr.` };
    if (/(roi|payback|financ|money|profit|npv|irr)/.test(t)) return { html: `Net investment after incentives is <b>${U.money(r.netCapex)}</b>. Annual savings are <b>${U.money(r.annualSavings)}</b>, so payback is <b>${GX.pb(r.paybackYears)} years</b>. 10-year ROI is ${r.roi10.toFixed(0)}%, 20-year NPV ${U.money(r.npv20)} and IRR ${r.irr != null ? (r.irr * 100).toFixed(1) + '%' : 'n/a'}.` };
    if (/^(yes|yep|sure|ok|run|simulate|go)/.test(t)) {
      const sim = E.simulate(c.project, d, S.state.settings, Object.assign({}, c.mitigation, { rebalance: true, returnTemp: 2 }), Object.assign({}, c.sim));
      return { html: `Ran a ${sim.years}-year simulation with the recommended changes: average COP <b>${sim.avgCop.toFixed(2)}</b>, minimum ${sim.minCop.toFixed(2)} in month ${sim.worstMonth + 1}, overload probability ${sim.overloadProb.toFixed(0)}%, degradation ${sim.degPerYr.toFixed(1)}%/yr. Open Simulation Lab for the full timeline.`, link: 'simulation-lab' };
    }
    return { html: 'I can analyze this project with live model data. Try asking:<ul><li>"How can I improve efficiency?"</li><li>"What is the ROI if I apply load rebalancing?"</li><li>"What if depth is 220?" or "Set boreholes to 50"</li><li>"Analyze current risks" or "How do I reduce cost?"</li></ul>' };
  }

  GX.views['ai-assistant'] = {
    name: 'AI Assistant', header: { mode: 'title', title: () => GX.shortName() + ' — Engineering Copilot' },
    state: { recs: null, picked: [] },
    render(el) {
      const c = S.cur();
      if (!c.chat || !c.chat.length) {
        if (GX.isSample()) {
          c.chat = [{ who: 'u', text: 'How can I improve the overall system efficiency?' }];
          c.chat.push(Object.assign({ who: 'a' }, reply(c.chat[0].text)));
          c.chat.push({ who: 'u', text: 'What is the projected ROI if I apply the load rebalancing now?' });
          c.chat.push(Object.assign({ who: 'a' }, reply(c.chat[2].text)));
        } else {
          c.chat = [{ who: 'a', html: `Hi! I answer from the live model of <b>${esc(GX.shortName())}</b> — every number comes from your current design and assumptions.<br>Try: <i>"How can I improve efficiency?"</i>, <i>"What if depth is 180?"</i>, <i>"Analyze current risks"</i> or <i>"How do I reduce cost?"</i>` }];
        }
      }
      el.innerHTML = `<div class="ai-wrap">
        <div class="ai-chat">
          <div class="chips">${['Optimize system efficiency', 'Analyze current risks', 'Reduce operational cost', 'Explain performance'].map(x => `<button data-q="${x}">${x}</button>`).join('')}</div>
          <div class="msgs" id="msgs" aria-live="polite"></div>
          <div class="ai-meta"><span>Answers are computed from this project's engineering model. The assistant understands questions about efficiency, cost, payback, risk, CO₂ and what-if changes.</span></div><form class="ai-input" id="ai-form"><input class="input" id="ai-q" placeholder="Ask anything about your system parameters or risks..." autocomplete="off"><button class="btn btn-accent" type="submit">Send</button></form>
        </div>
        <div class="ai-side" id="ai-side"></div></div>`;
      this.paintMsgs(el, false); this.usage(el);
      el.querySelectorAll('[data-q]').forEach(b => b.onclick = () => this.ask(el, b.dataset.q));
      U.$('#ai-form', el).onsubmit = e => { e.preventDefault(); const q = U.$('#ai-q', el).value.trim(); if (q) { U.$('#ai-q', el).value = ''; this.ask(el, q); } };
      this.paint(el);
    },
    ask(el, q) {
      const lim = GX.plan().ai;
      if (S.state.aiUsage.count >= lim) { U.modal({ title: 'Monthly AI request limit reached', body: `<p style="margin:0">The ${GX.plan().name} plan includes ${lim} assistant requests per month. Upgrade for a higher limit.</p>`, actions: [{ label: 'Close', kind: 'ghost' }, { label: 'Compare plans', kind: 'primary', onClick: () => GX.go('preferences') }] }); return; }
      S.useAi(); this.usage(el);
      const c = S.cur(); c.chat.push({ who: 'u', text: q }); this.paintMsgs(el, false);
      const box = U.$('#msgs', el); const typing = document.createElement('div'); typing.className = 'msg a typing'; typing.innerHTML = '<span></span><span></span><span></span>'; box.appendChild(typing); box.scrollTop = box.scrollHeight;
      setTimeout(() => { typing.remove(); const a = Object.assign({ who: 'a' }, reply(q)); c.chat.push(a); c.chat = c.chat.slice(-40); S.persist(); this.paintMsgs(el, true); this.paint(el); }, 650 + Math.random() * 500);
    },
    usage(el) { const x = U.$('#ai-usage', el); if (!x) return; const lim = GX.plan().ai; x.textContent = `Requests this month: ${S.state.aiUsage.count}${lim === Infinity ? ' (unlimited)' : ' / ' + lim}`; },
    paintMsgs(el, animateLast) {
      const c = S.cur(), box = U.$('#msgs', el);
      box.innerHTML = c.chat.map((m, i) => m.who === 'u' ? `<div class="msg u">${esc(m.text)}</div>` : `<div class="msg a ${animateLast && i === c.chat.length - 1 ? 'reveal' : ''}">${m.html}${m.apply ? `<div class="msg-act"><button class="btn btn-sm btn-accent" data-apply="${i}" data-edit>${esc(m.apply.label)}</button></div>` : ''}${m.followSim ? `<div class="msg-act"><button class="btn btn-sm btn-ghost" data-yes="1">Yes, run simulation</button></div>` : ''}${m.link ? `<div class="msg-act"><button class="btn btn-sm btn-ghost" data-go="${m.link}">Open Simulation Lab →</button></div>` : ''}</div>`).join('');
      box.scrollTop = box.scrollHeight;
      box.querySelectorAll('[data-apply]').forEach(b => b.onclick = () => {
        if (!GX.guard()) return; const a = c.chat[+b.dataset.apply].apply;
        if (a.patch) { if (S.cur().locked) { U.toast('Ground loop design is locked.', 'warn'); return; } S.setDesign(a.patch, 'ai'); }
        if (a.mit) S.setMitigation(a.mit); if (a.settings) S.setSettings(a.settings);
        S.log('AI Assistant: ' + a.label, 'Intelligence', 'Completed'); U.toast(esc(a.label) + ' — model updated'); b.textContent = 'Applied ✓'; b.disabled = true;
      });
      box.querySelectorAll('[data-yes]').forEach(b => b.onclick = () => this.ask(el, 'Yes, run the simulation'));
    },
    paint(el) {
      const r = S.result(), c = S.cur();
      const recs = optimizations(); const picked = this.state.picked;
      const issues = A.list().filter(a => a.status !== 'resolved' && (a.sev === 'critical' || a.sev === 'warning')).slice(0, 3);
      U.$('#ai-side', el).innerHTML = `
        <div class="card pad"><h3 class="card-title">Current System Status</h3><div class="cs2">
          <div class="between"><span class="muted">Efficiency (COP)</span><b class="teal">${U.count(r.SCOP, 'n2', 'ai-cop')}</b></div>
          <div class="between"><span class="muted">Aggregate Risk</span><b style="color:${r.risk.score < 40 ? 'var(--green)' : r.risk.score < 72 ? 'var(--amber)' : 'var(--red)'}">${r.risk.label.replace(' Risk', '')} (${r.risk.score}%)</b></div>
          <div class="between"><span class="muted">Status</span><b>${r.stability > 0.65 ? 'Optimal Operations' : 'Attention Needed'}</b></div></div></div>
        <div class="card pad"><h3 class="card-title">Recommended Actions</h3><div class="ra">${recs.map(x => `<button class="ra-i ${picked.includes(x.id) ? 'on' : ''}" data-pick="${x.id}" data-tip="${esc(x.text)}<br>Impact: <b>${U.signed(x.gain * 100, 1, '%')}</b>"><span>${esc(x.label)}</span><span class="pl">${picked.includes(x.id) ? U.icon.check : U.icon.plus}</span></button>`).join('') || '<div class="empty-ok">All recommendations applied.</div>'}</div>
          <div class="grid" style="grid-template-columns:1fr 1fr;gap:12px;margin-top:14px"><button class="btn btn-dark" id="ai-apply" data-edit ${recs.length ? '' : 'disabled'}>${picked.length ? 'Apply (' + picked.length + ')' : 'Apply All'}</button><button class="btn btn-ghost" data-go="simulation-lab">Run Sim</button></div></div>
        <div class="card pad" style="flex:1"><h3 class="card-title">Active Context Data</h3>
          <div class="ctx">${[GX.shortName(), r.loc.city, r.g.layer.replace(/^\w/, x => x.toUpperCase()), `${c.design.orient === 'vertical' ? 'Vertical' : 'Horizontal'} ${c.design.loop === 'open' ? 'Open' : 'Closed'}-Loop`].map(x => `<span>${esc(x)}</span>`).join('')}</div>
          <h3 class="card-title" style="margin-top:22px">Active Issues</h3>
          <div class="iss">${issues.length ? issues.map(a => `<button data-alert="${a.id}"><span class="dot" style="background:${a.sev === 'critical' ? 'var(--red)' : 'var(--amber)'}"></span>${esc(a.title)}</button>`).join('') : '<div class="muted" style="font-size:13px">No active issues.</div>'}</div>
          <button class="btn btn-ghost btn-block" style="margin-top:18px" data-go="system-design">Adjust Configuration</button></div>`;
      el.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => { const id = b.dataset.pick; const i = picked.indexOf(id); if (i >= 0) picked.splice(i, 1); else picked.push(id); this.paint(el); U.bindTips(el); });
      el.querySelectorAll('#ai-side [data-alert]').forEach(b => b.onclick = () => { GX.views.alerts.state.sel = b.dataset.alert; GX.go('alerts'); });
      const ap = U.$('#ai-apply', el); if (ap) ap.onclick = () => {
        if (!GX.guard()) return; const sel = recs.filter(x => !picked.length || picked.includes(x.id)); const before = S.result();
        const patch = {}, mit = {}; sel.forEach(x => { Object.assign(patch, x.patch || {}); Object.assign(mit, x.mit || {}); });
        if (Object.keys(patch).length) { if (S.cur().locked) { U.toast('Ground loop design is locked.', 'warn'); return; } S.setDesign(patch, 'ai'); }
        if (Object.keys(mit).length) S.setMitigation(mit);
        this.state.picked = []; const after = S.result();
        S.log(`AI Assistant applied ${sel.length} recommendation(s)`, 'Intelligence', 'Completed');
        const msg = `Applied ${sel.length} recommendation${sel.length > 1 ? 's' : ''}: COP ${before.SCOP.toFixed(2)} → <b>${after.SCOP.toFixed(2)}</b>, payback ${GX.pb(before.paybackYears)} → <b>${GX.pb(after.paybackYears)} yrs</b>.`;
        c.chat.push({ who: 'a', html: msg }); S.persist(); this.paintMsgs(el, true); U.toast(msg);
      };
    }
  };

  /* ================= REPORTS ================= */
  GX.views.reports = {
    name: 'Report', header: { mode: 'title', title: () => GX.shortName() + ' — Documentation Hub' },
    state: { sel: null, opts: { fin: true, risk: true, charts: true } },
    create(title, type) {
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
