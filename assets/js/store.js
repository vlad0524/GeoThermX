/* GeoThermX state store: projects, design, settings, alerts, reports, audit log. Persists to localStorage when available. */
(function () {
  'use strict';
  const E = window.GXEngine;
  const KEY = 'gx-state-v5';

  function defaultProject(id, over) {
    const base = {
      id, name: 'New Geothermal Project', ref: 'GT-0000', locationId: 'st-WA', city: '', zone: '4C', ground: 'Silty Sand / Gravel',
      fidelity: 'Measured on site (TRT / drill log)', buildingType: 'Commercial Office (Class A)', floorArea: 12500, floors: 12,
      heatDemand: 850000, coolDemand: 1120000, peakLoad: 450, depthLimit: 350, analyzedAt: '2026-10-14T09:12:00',
      stage: 'assessment', loadMode: 'known', vintage: '2005–2015 (modern code)', hours: 'Extended (14 h × 6 d)', glazing: 'Medium (25–40%)', siteArea: 9000,
      client: '', updatedAt: '',
      sector: 'commercial', baseline: 'gas-ac', projectType: 'replace', econ: {}
    };
    const p = Object.assign(base, over || {});
    if (!over || !over.sector) p.sector = E.sectorOf(Object.assign({}, p, { sector: null }));
    if (p.loadMode === 'calculated') { const l = E.loadCalc(p); p.heatDemand = l.heat; p.coolDemand = l.cool; p.peakLoad = l.peak; }
    const rec = E.recommend(p, {});
    return {
      project: p,
      design: rec.design,
      locked: false,
      designTouched: false,
      prevEff: null,
      mitigation: { rebalance: false, returnTemp: 0, flowOpt: false },
      drill: { auto: true, n: 16, depth: 180 },
      sim: { scenario: 'winter', ambient: -12, loadVar: 25, demand: +((p.heatDemand + p.coolDemand) / 1e6).toFixed(4), years: 5 },
      alerts: null,
      reports: [],
      chat: [],
      history: [],
      progress: {},
      ops: { rows: [] }
    };
  }

  /* ---------- Sample projects (fictional buildings, real model; each shows a different situation) ---------- */
  const SAMPLES = {
    sample: { name: 'Riverside Office Building', ref: 'GT-2041', client: 'Sample client', locationId: 'st-MA', city: 'Worcester, MA', buildingType: 'Commercial Office (Class A)', floorArea: 12500, floors: 8,
      vintage: '2005–2015 (modern code)', hours: 'Extended (14 h × 6 d)', glazing: 'Medium (25–40%)', siteArea: 9000, depthLimit: 300, baseline: 'oil-ac', projectType: 'replace', stage: 'deployed',
      fidelity: 'Local records (well logs, geo maps)', analyzedAt: '2025-06-10T10:00:00', loadMode: 'calculated', blurb: 'Office replacing an oil boiler · system operating, 12 months of data' },
    'sample-home': { name: 'Lakeview Residence', ref: 'GT-1187', client: 'Sample homeowner', locationId: 'st-MN', city: 'Brainerd, MN', buildingType: 'Single-Family Residential', floorArea: 230, floors: 2,
      vintage: '2005–2015 (modern code)', hours: 'Continuous (24/7)', glazing: 'Medium (25–40%)', siteArea: 1500, depthLimit: 180, baseline: 'propane-ac', projectType: 'replace', stage: 'design',
      fidelity: 'Regional estimate', analyzedAt: '2026-10-02T10:00:00', loadMode: 'calculated', blurb: 'Home on propane, furnace at end of life' },
    'sample-school': { name: 'Cedar Valley Elementary School', ref: 'GT-3305', client: 'Sample school district', locationId: 'st-PA', city: 'Lancaster, PA', buildingType: 'Education / Campus', floorArea: 6500, floors: 2,
      vintage: '2016+ (high performance)', hours: 'Standard (10 h × 5 d)', glazing: 'Medium (25–40%)', siteArea: 12000, depthLimit: 200, baseline: 'gas-ac', projectType: 'new', stage: 'assessment',
      fidelity: 'Regional estimate', analyzedAt: '2026-10-20T10:00:00', loadMode: 'calculated', blurb: 'New school vs. natural gas — a marginal case' }
  };
  /* 12 months of example meter data for the operating sample: model expectation ± realistic scatter, one weak month to show alerts */
  function sampleOps(a) {
    const sim = E.simulate(a.project, a.design, {}, a.mitigation, { years: 1 }), r = E.compute(a.project, a.design, {}, a.mitigation);
    const now = new Date(); const rows = [];
    for (let k = 12; k >= 1; k--) {
      const d = new Date(now.getFullYear(), now.getMonth() - k, 15), i = d.getMonth();
      const thermal = (a.project.heatDemand * E.HEAT_W[i] + a.project.coolDemand * E.COOL_W[i]) * r.coverage;
      const wob = Math.sin(k * 2.3) * 0.04, weak = k === 2 ? -0.14 : 0;
      const t = Math.round(thermal * (1 + Math.sin(k * 1.7) * 0.06));
      rows.push({ month: d.getFullYear() + '-' + String(i + 1).padStart(2, '0'), thermal: t, elec: Math.round(t / (sim.cop[i] * (1 + wob + weak))), loop: +(i >= 5 && i <= 8 ? r.EWTc - 1 + Math.sin(k) : r.EWTh + 1 + Math.sin(k)).toFixed(1) });
    }
    return rows;
  }
  function sampleProject(id) {
    id = SAMPLES[id] ? id : 'sample';
    const cfg = Object.assign({}, SAMPLES[id]); delete cfg.blurb;
    const a = defaultProject(id, Object.assign(cfg, { sample: true, econ: {}, updatedAt: cfg.analyzedAt }));
    const st = a.project.stage;
    a.progress = st === 'deployed' ? { site: true, building: true, design: true, costs: true, finance: true } : st === 'design' ? { site: true, building: true, design: true } : { site: true, building: true };
    const mk = (label, t, over) => { const d = Object.assign({}, a.design, over); const r = E.compute(a.project, d, {}, a.mitigation); return { t, label, design: d, scop: r.SCOP, capex: r.capex, payback: r.paybackYears, n: d.n, depth: d.depth }; };
    a.history = [mk('Recommended design', a.project.analyzedAt, {})];
    if (st === 'deployed') {
      a.history.unshift(mk('Commissioned design', '2025-09-30T16:20:00', {}));
      a.reports = [{ id: 'r0', title: 'Feasibility & Engineering Analysis', date: '2025-07-01', type: 'ENGINEERING' }];
      a.ops = { rows: sampleOps(a), updatedAt: new Date().toISOString() };
      a.log = [{ t: '2025-09-30T16:20:00', msg: 'System commissioned — operation tracking started', cat: 'System', status: 'Success' }, { t: '2025-07-01T09:00:00', msg: 'Feasibility report generated', cat: 'Config', status: 'Success' }];
    }
    return a;
  }

  /* Economic inputs live on each project (p.econ, defaults from state + sector); global settings keep only financial assumptions & preferences. */
  const ECON_KEYS = ['elec', 'gas', 'propane', 'oil', 'itc', 'equipRate', 'maintPerKw', 'avoidedPerKw', 'drillMult', 'grant', 'utilityRebate', 'maintSave', 'baselineBoilerEff', 'baselineChillerCop', 'equipMult', 'drillAdj'];
  function globalSettings(st) { ECON_KEYS.forEach(k => delete st[k]); return st; }

  function freshState() {
    return {
      v: 5, current: null,
      projects: {}, order: [],
      settings: globalSettings(Object.assign({}, E.DEFAULT_SETTINGS, { units: 'imperial', unitsSet: true, tips: true, hiddenTips: {} })),
      user: { access: 'admin' },
      log: []
    };
  }

  let state;
  try { const raw = localStorage.getItem(KEY); state = raw ? JSON.parse(raw) : null; } catch (e) { state = null; }
  /* migrate: drop chats seeded with old mock wording */
  if (state && state.settings) globalSettings(state.settings);
  if (state && state.projects && state.projects.sample && /^Aurora/.test(state.projects.sample.project.name)) state.projects.sample = sampleProject('sample');   // old demo → new honest sample
  if (state && state.settings && !state.settings.unitsSet) { state.settings.units = 'imperial'; state.settings.unitsSet = true; }   // US market: imperial by default
  if (state && state.projects) Object.values(state.projects).forEach(p => {
    const pr = p.project; if (pr) { if (!pr.sector) pr.sector = E.sectorOf(pr); if (!pr.baseline) pr.baseline = 'gas-ac'; if (!pr.projectType) pr.projectType = 'replace'; if (!pr.econ) pr.econ = {}; if (E.FIDELITY_OLD[pr.fidelity]) pr.fidelity = E.FIDELITY_OLD[pr.fidelity]; } if (p.chat && JSON.stringify(p.chat).includes('Southern Cluster')) p.chat = []; if (p.reports) p.reports.forEach(r => { if (r.title === 'Borehole Zone 4 Risk Assessment') r.title = 'Borefield Thermal Risk Assessment'; }); });
  if (!state || state.v !== 5) state = freshState();

  const subs = new Set();
  let saveTimer = null;
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ } }, 250);
  }

  let cache = null;
  function cur() { return state.current ? state.projects[state.current] || null : null; }
  function result() {
    if (!cache) { const c = cur(); if (!c) return null; cache = E.compute(c.project, c.design, state.settings, c.mitigation); }
    return cache;
  }
  let scCache = null;
  function scen() { if (!scCache) { const c = cur(); scCache = E.scenarios(c.project, c.design, state.settings, c.mitigation); } return scCache; }

  function emit(reason) { cache = null; scCache = null; persist(); subs.forEach(f => { try { f(reason); } catch (e) { console.error(e); } }); }

  function now() { return new Date().toISOString().slice(0, 19); }

  const Store = {
    get state() { return state; },
    cur, result, scenarios: scen,
    subscribe(f) { subs.add(f); return () => subs.delete(f); },
    canEdit() { return true; },
    log(msg, cat, status) {
      const c = cur(); const target = c ? (c.log = c.log || []) : state.log;
      target.unshift({ t: now(), msg, cat: cat || 'Config', status: status || 'Modified' });
      target.splice(200);
      persist();
    },
    logs() { const c = cur(); return c ? (c.log || []) : state.log; },
    mark(step) { const c = cur(); if (!c) return; c.progress = c.progress || {}; if (!c.progress[step]) { c.progress[step] = true; persist(); } },
    SAMPLES,
    samplePreview(id) { try { const a = sampleProject(id || 'sample'); return E.compute(a.project, a.design, state.settings, a.mitigation); } catch (e) { return null; } },
    loadSample(id) { const ids = id ? [id] : Object.keys(SAMPLES); ids.forEach(k => { if (!state.projects[k]) { state.projects[k] = sampleProject(k); state.order.push(k); } }); state.current = id || 'sample'; emit('switch'); },
    setOps(rows) { const c = cur(); c.ops = { rows, updatedAt: now() }; emit('ops'); },
    setEcon(patch) { const c = cur(); c.project.econ = Object.assign({}, c.project.econ || {}, patch); c.project.updatedAt = now(); emit('project'); },
    setProject(patch, silent) {
      const c = cur();
      Object.assign(c.project, patch);
      c.project.updatedAt = now();
      if (c.project.loadMode === 'calculated' && !('heatDemand' in patch) && !('coolDemand' in patch) && !('peakLoad' in patch)) {
        const l = E.loadCalc(c.project); c.project.heatDemand = l.heat; c.project.coolDemand = l.cool; c.project.peakLoad = l.peak;
      }
      if (c.sim) c.sim.demand = +((c.project.heatDemand + c.project.coolDemand) / 1e6).toFixed(4);   // keep simulation demand in step with building loads
      if (patch.locationId && !('zone' in patch)) {
        const L = E.location(patch.locationId);
        c.project.zone = L.zone; if (!('ground' in patch)) c.project.ground = L.ground;
      }
      if (!c.locked && !c.designTouched) {
        const rec = E.recommend(c.project, state.settings, c.design);
        Object.assign(c.design, rec.design);
      }
      if (!silent) emit('project');
    },
    setDesign(patch, reason) {
      const c = cur();
      const before = result().effScore;
      c.prevEff = before;
      Object.assign(c.design, patch);
      c.designTouched = true;
      c.progress = c.progress || {}; c.progress.design = true;
      emit(reason || 'design');
    },
    applyRecommended() {
      const c = cur();
      const rec = E.recommend(c.project, state.settings, c.design);
      c.prevEff = result().effScore;
      Object.assign(c.design, rec.design); c.designTouched = false;
      emit('design');
    },
    setLocked(v) { cur().locked = v; if (v) { Store.snapshot('Configuration locked'); Store.mark('design'); } emit('lock'); },
    snapshot(label) {
      const c = cur(), r = result();
      c.history = c.history || [];
      c.history.unshift({ t: now(), label, design: Object.assign({}, c.design), scop: r.SCOP, capex: r.capex, payback: r.paybackYears, n: c.design.n, depth: c.design.depth });
      c.history = c.history.slice(0, 30); persist();
    },
    restore(i) { const c = cur(), h = c.history[i]; if (!h) return; Object.assign(c.design, h.design); c.designTouched = true; emit('design'); },
    setStage(stage) { cur().project.stage = stage; emit('stage'); },
    deleteProject(id) { delete state.projects[id]; state.order = state.order.filter(x => x !== id); if (state.current === id) state.current = state.order[0] || null; emit('switch'); return true; },
    duplicateProject(id) { const src = state.projects[id]; const nid = 'p' + Date.now().toString(36); const copy = JSON.parse(JSON.stringify(src)); copy.project.id = nid; copy.project.name += ' (copy)'; copy.project.stage = 'design'; copy.project.sample = false; copy.alerts = null; copy.ops = { rows: [] }; copy.log = []; state.projects[nid] = copy; state.order.unshift(nid); emit('projects'); return nid; },
    setMitigation(patch) { Object.assign(cur().mitigation, patch); emit('mitigation'); },
    setSim(patch) { Object.assign(cur().sim, patch); persist(); },
    setDrill(patch) { Object.assign(cur().drill, patch); persist(); },
    setSettings(patch) { Object.assign(state.settings, patch); emit('settings'); },
    setUser(patch) { Object.assign(state.user, patch); emit('user'); },
    switchProject(id) { if (state.projects[id]) { state.current = id; emit('switch'); } },
    createProject(over) {
      const id = 'p' + Date.now().toString(36);
      const L = E.location(over.locationId || 'st-WA');
      state.projects[id] = defaultProject(id, Object.assign({ zone: L.zone, ground: L.ground, city: '', ref: 'GT-' + (1000 + Math.floor(Math.random() * 8999)), stage: 'assessment', fidelity: 'Regional estimate', loadMode: 'calculated', client: '', siteArea: 0, analyzedAt: '', updatedAt: now() }, over));
      state.projects[id].progress = { building: true };
      state.order.unshift(id); state.current = id;
      emit('switch');
      return id;
    },
    addReport(rep) { cur().reports.unshift(rep); Store.mark('report'); persist(); },
    reset() { try { localStorage.removeItem(KEY); } catch (e) { } state = freshState(); emit('reset'); },
    touch(reason) { emit(reason || 'touch'); },
    persist
  };

  window.GXStore = Store;
})();
