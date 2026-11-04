/* GeoThermX Projects workspace and new-project wizard */
(function () {
  'use strict';
  const U = window.GXUI, S = window.GXStore, E = window.GXEngine;
  const GX = window.GX; const esc = U.esc;

  /* ================= PROJECTS ================= */
  GX.views.projects = {
    name: 'Projects', header: { mode: 'title', title: 'Projects' }, state: { filter: 'all' },
    render(el) { el.innerHTML = '<div id="pj"></div>'; this.paint(el); },
    paint(el) {
      const f = this.state.filter, P = GX.plan();
      const ids = S.state.order.filter(id => f === 'all' || S.state.projects[id].project.stage === f);
      const c = S.cur();
      const row = id => { const st = S.state.projects[id], p = st.project; const r = E.compute(p, st.design, S.state.settings, st.mitigation); const L = E.location(p.locationId, p);
        return `<div class="pj-row ${id === S.state.current ? 'cur' : ''}"><div><b>${esc(p.name)}</b>${p.sample ? ' <b class="sample-tag">Sample</b>' : ''}<span>${esc(p.client || '—')} · ${esc(p.ref)}</span></div><div>${esc(L.city)}<span>${esc(p.buildingType)}</span></div>
          <div>${GX.stagePill(p.stage)}</div><div class="num">${r.SCOP.toFixed(2)}<span>SCOP</span></div><div class="num">${U.moneyK(r.capex)}<span>CAPEX</span></div><div class="num">${GX.pb(r.paybackYears)} yrs<span>payback</span></div>
          <div class="num muted" style="font-size:12px">${U.date((p.updatedAt || p.analyzedAt || '').slice(0, 10) || U.today())}</div>
          <div class="pj-act"><button class="btn btn-sm ${id === S.state.current ? 'btn-ghost' : 'btn-primary'}" data-open="${id}">${id === S.state.current ? 'Open' : 'Open'}</button><button class="btn btn-sm btn-ghost" data-dup="${id}" data-edit title="Duplicate">⧉</button><button class="btn btn-sm btn-ghost" data-del="${id}" data-edit title="Delete">🗑</button></div></div>`; };
      const hist = c.history || [];
      U.$('#pj', el).innerHTML = `
        <div class="between" style="margin-bottom:18px;flex-wrap:wrap;gap:12px"><div class="tabs">${[['all', 'All'], ['assessment', 'Assessment'], ['design', 'Design'], ['deployed', 'Operational']].map(([k, l]) => `<button data-f="${k}" class="${f === k ? 'on' : ''}">${l}</button>`).join('')}</div>
          <div class="row" style="gap:14px"><span class="muted" style="font-size:13px">${S.state.order.length} project${S.state.order.length === 1 ? '' : 's'}</span><button class="btn btn-primary" id="pj-new" data-edit>+ New project</button></div></div>
        <div class="card pj-table"><div class="pj-row pj-h"><div>Project</div><div>Location</div><div>Stage</div><div>Efficiency</div><div>Investment</div><div>Payback</div><div>Updated</div><div></div></div>${ids.map(row).join('') || '<div class="empty-ok" style="margin:16px">No projects in this stage.</div>'}</div>
        <div class="grid pj-cards" style="gap:22px;margin-top:22px">
          <div class="card pad"><div class="between"><h3 class="card-title">Progress: ${esc(c.project.name)}</h3><span class="muted" style="font-size:12.5px">${GX.progress().done} of ${GX.progress().total}</span></div>${GX.progressHtml()}</div>
          <div class="card pad"><div class="between"><h3 class="card-title">Lifecycle</h3>${GX.stagePill()}</div>
            <div class="life">${['assessment', 'design', 'deployed'].map((k, i) => `<button class="life-s ${c.project.stage === k ? 'on' : ''} ${['assessment', 'design', 'deployed'].indexOf(c.project.stage) > i ? 'done' : ''}" data-stage="${k}" data-edit><span>${i + 1}</span><b>${GX.STAGES[k][0]}</b><em>${k === 'assessment' ? 'Site & feasibility' : k === 'design' ? 'Design, optimize, report' : 'Installed, monitored'}</em></button>`).join('')}</div>
            <p class="muted" style="font-size:12.5px;margin:12px 0 0">Monitoring and Alerts become available in the Operational stage.</p></div>
          <div class="card pad"><div class="between"><h3 class="card-title">Calculation history</h3><button class="btn btn-sm btn-ghost" id="pj-snap" data-edit>Save snapshot</button></div>
            <div class="hist">${hist.length ? hist.slice(0, 8).map((h, i) => `<div class="hist-r"><div><b>${esc(h.label)}</b><span>${U.stamp(h.t)}</span></div><span class="num">${h.n} × ${U.len(h.depth)} · SCOP ${h.scop.toFixed(2)} · ${U.moneyK(h.capex)} · ${h.payback.toFixed(1)} yrs</span><button class="link-btn" data-restore="${i}" data-edit>Restore</button></div>`).join('') : '<div class="empty-ok">No saved versions yet. Snapshots are created when you lock a configuration, commission a system or click “Save snapshot”.</div>'}</div></div></div>`;
      el.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { this.state.filter = b.dataset.f; this.paint(el); });
      el.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { S.switchProject(b.dataset.open); GX.go('dashboard'); });
      el.querySelectorAll('[data-dup]').forEach(b => b.onclick = () => { if (!GX.guard()) return; if (!canCreate()) return; S.duplicateProject(b.dataset.dup); U.toast('Project duplicated'); });
      el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { if (!GX.guard()) return; const p = S.state.projects[b.dataset.del].project; U.modal({ title: 'Delete project?', body: `<p style="margin:0">Delete <b>${esc(p.name)}</b> with its reports and history? This cannot be undone.</p>`, actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Delete', kind: 'dark', onClick: () => { if (S.deleteProject(b.dataset.del)) { S.log('Deleted project ' + p.name, 'Config', 'Modified'); U.toast('Project deleted'); } else U.toast('Keep at least one project', 'warn'); } }] }); });
      el.querySelectorAll('[data-stage]').forEach(b => b.onclick = () => { if (!GX.guard()) return; const k = b.dataset.stage; if (k === 'deployed' && c.project.stage !== 'deployed') { GX.deploy(); return; } S.setStage(k); S.log('Stage set to ' + GX.STAGES[k][0], 'Config', 'Modified'); U.toast('Stage: <b>' + GX.STAGES[k][0] + '</b>'); });
      el.querySelectorAll('[data-restore]').forEach(b => b.onclick = () => { if (!GX.guard()) return; if (S.cur().locked) { U.toast('Unlock the configuration first', 'warn'); return; } S.restore(+b.dataset.restore); S.log('Restored design version', 'Config', 'Modified'); U.toast('Design version restored'); });
      U.$('#pj-snap', el).onclick = () => { if (!GX.guard()) return; S.snapshot('Manual snapshot'); this.paint(el); U.toast('Snapshot saved'); };
      U.$('#pj-new', el).onclick = () => GX.newProject();
    }
  };
  function canCreate() { const P = GX.plan(); if (S.state.order.length >= P.projects) { U.modal({ title: 'Project limit reached', body: `<p style="margin:0">The ${P.name} plan includes up to ${P.projects} active projects. Archive a project or upgrade your plan.</p>`, actions: [{ label: 'Close', kind: 'ghost' }, { label: 'Compare plans', kind: 'primary', onClick: () => GX.go('preferences') }] }); return false; } return true; }

  /* ---- New project wizard ---- */
  GX.newProject = () => {
    if (!GX.guard() || !canCreate()) return;
    const st = { step: 0, d: { name: 'New Geothermal Project', client: '', baseline: 'gas-ac', projectType: 'replace', locationId: 'st-TX', city: '', buildingType: 'Commercial Office (Class A)', floorArea: 8000, floors: 5, vintage: '2005–2015 (modern code)', hours: 'Standard (10 h × 5 d)', glazing: 'Medium (25–40%)', siteArea: 6000, depthLimit: 300, loadMode: 'calculated', heatDemand: 0, coolDemand: 0, peakLoad: 0 } };
    const opt = (o, v) => Object.keys(o).map(k => `<option ${k === v ? 'selected' : ''}>${k}</option>`).join('');
    const body = () => { const d = st.d; const L = E.location(d.locationId); const calc = E.loadCalc(Object.assign({}, d, { zone: L.zone }));
      return `<div class="wiz-steps">${['Basics', 'Building & site', 'Thermal loads'].map((t, i) => `<span class="${i === st.step ? 'on' : i < st.step ? 'done' : ''}">${i + 1}. ${t}</span>`).join('')}</div>` + [
      `<div class="field"><label for="wz-name">Project name</label><input class="input" id="wz-name" value="${esc(d.name)}"></div><div class="field"><label for="wz-client">Client</label><input class="input" id="wz-client" value="${esc(d.client)}" placeholder="Optional"></div>
       <div class="pair"><div class="field"><label for="wz-loc">State</label><select class="select" id="wz-loc">${E.LOCATIONS.slice().sort((a, b) => a.state.localeCompare(b.state)).map(l => `<option value="${l.id}" ${l.id === d.locationId ? 'selected' : ''}>${l.state}</option>`).join('')}</select></div><div class="field"><label for="wz-city">City / address</label><input class="input" id="wz-city" value="${esc(d.city)}" placeholder="e.g. ${esc(L.city)}"></div></div>
       <div class="field"><label for="wz-type">Building type</label><select class="select" id="wz-type">${opt(E.BUILDINGS, d.buildingType)}</select></div>
       <div class="pair"><div class="field"><label for="wz-base">Current heating &amp; cooling</label><select class="select" id="wz-base">${Object.entries(E.BASELINES).map(([k, b]) => `<option value="${k}" ${k === d.baseline ? 'selected' : ''}>${b.label}</option>`).join('')}</select></div>
         <div class="field"><label for="wz-ptype">Project type</label><select class="select" id="wz-ptype">${Object.entries(E.PROJECT_TYPES).map(([k, x]) => `<option value="${k}" ${k === d.projectType ? 'selected' : ''}>${x.short}</option>`).join('')}</select></div></div>
       <div class="muted" style="font-size:12px">Payback is calculated against the current system. You can change this later on the Building &amp; Loads page.</div>`,
      `<div class="pair"><div class="field"><label for="wz-area">Total floor area (${U.areaU()})</label><input class="input" id="wz-area" type="number" value="${Math.round(U.areaV(d.floorArea))}"></div><div class="field"><label for="wz-floors">Floors</label><input class="input" id="wz-floors" type="number" value="${d.floors}"></div></div>
       <div class="pair"><div class="field"><label for="wz-vint">Construction / envelope</label><select class="select" id="wz-vint">${opt(E.VINTAGE, d.vintage)}</select></div><div class="field"><label for="wz-hours">Operating schedule</label><select class="select" id="wz-hours">${opt(E.HOURS, d.hours)}</select></div></div>
       <div class="pair"><div class="field"><label for="wz-site">Available land for borefield (${U.areaU()})</label><input class="input" id="wz-site" type="number" value="${Math.round(U.areaV(d.siteArea))}"></div><div class="field"><label for="wz-depth">Drilling depth limit (${U.lenU()})</label><input class="input" id="wz-depth" type="number" value="${Math.round(U.lenV(d.depthLimit))}"></div></div>`,
      `<div class="seg" style="margin-bottom:4px"><button type="button" data-lm="calculated" class="${d.loadMode === 'calculated' ? 'on' : ''}">Calculate from building data</button><button type="button" data-lm="known" class="${d.loadMode === 'known' ? 'on' : ''}">I know the annual demand</button></div>
       ${d.loadMode === 'calculated' ? `<div class="insight">Calculated for ${esc(L.city)} (${E.CLIMATE[L.zone].label}): heating <b>${U.n(calc.heat / 1000)} MWh/yr</b>, cooling <b>${U.n(calc.cool / 1000)} MWh/yr</b>, peak load <b>${U.pow(calc.peak)}</b>.</div>` :
        `<div class="pair"><div class="field"><label for="wz-heat">Heating demand (kWh/yr)</label><input class="input" id="wz-heat" type="number" value="${d.heatDemand || calc.heat}"></div><div class="field"><label for="wz-cool">Cooling demand (kWh/yr)</label><input class="input" id="wz-cool" type="number" value="${d.coolDemand || calc.cool}"></div></div><div class="field"><label for="wz-peak">Peak thermal load (${U.powU()})</label><input class="input" id="wz-peak" type="number" value="${Math.round(U.powV(d.peakLoad || calc.peak))}"></div><div class="muted" style="font-size:12.5px">Tip: you can import 12 months of utility data later in Project Setup.</div>`}`][st.step]; };
    const read = m => { const d = st.d, v = id => { const x = U.$('#' + id, m); return x ? x.value : null; };
      if (st.step === 0) { d.name = v('wz-name').trim() || 'Untitled Project'; d.client = v('wz-client').trim(); d.locationId = v('wz-loc'); d.city = v('wz-city').trim(); d.buildingType = v('wz-type'); d.baseline = v('wz-base') || 'gas-ac'; d.projectType = v('wz-ptype') || 'replace'; d.sector = E.sectorOf({ buildingType: d.buildingType }); if (d.sector === 'residential' && d.hours === 'Standard (10 h × 5 d)') d.hours = 'Continuous (24/7)'; }
      if (st.step === 1) { d.floorArea = Math.max(50, U.areaIn(+v('wz-area') || 0)); d.floors = Math.max(1, +v('wz-floors') || 1); d.vintage = v('wz-vint'); d.hours = v('wz-hours'); d.siteArea = Math.max(0, U.areaIn(+v('wz-site') || 0)); d.depthLimit = U.clamp(U.lenIn(+v('wz-depth') || 300), 30, 600); }
      if (st.step === 2 && d.loadMode === 'known') { d.heatDemand = Math.max(0, +v('wz-heat') || 0); d.coolDemand = Math.max(0, +v('wz-cool') || 0); d.peakLoad = Math.max(5, U.powIn(+v('wz-peak') || 0)); } };
    const md = U.modal({ title: 'New project', wide: true, body: '<div id="wz"></div>', actions: [] });
    const m = md.el, f = U.$('.modal-f', m);
    const draw = () => { U.$('#wz', m).innerHTML = body(); f.innerHTML = `${st.step ? '<button class="btn btn-ghost" id="wz-back">Back</button>' : '<button class="btn btn-ghost" id="wz-cancel">Cancel</button>'}<button class="btn btn-primary" id="wz-next">${st.step < 2 ? 'Next' : 'Create project'}</button>`;
      m.querySelectorAll('[data-lm]').forEach(b => b.onclick = () => { st.d.loadMode = b.dataset.lm; draw(); });
      const bk = U.$('#wz-back', m); if (bk) bk.onclick = () => { read(m); st.step--; draw(); };
      const cn = U.$('#wz-cancel', m); if (cn) cn.onclick = md.close;
      U.$('#wz-next', m).onclick = () => { read(m); if (st.step < 2) { st.step++; draw(); return; }
        const d = st.d; const over = Object.assign({}, d, { analyzedAt: '' }); if (d.loadMode === 'calculated') { delete over.heatDemand; delete over.coolDemand; delete over.peakLoad; }
        S.createProject(over); S.log('Created project ' + d.name, 'Config', 'Success'); md.close(); U.toast('Project <b>' + esc(d.name) + '</b> created'); GX.go('site-intelligence'); }; };
    draw();
  };
})();
