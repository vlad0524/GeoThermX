/* GeoThermX state store: projects, design, settings, alerts, reports, audit log. Persists to localStorage when available. */
(function () {
  'use strict';
  const E = window.GXEngine;
  const KEY = 'gx-state-v5';

  function defaultProject(id, over) {
    const base = {
      id, name: 'Aurora District Phase 1', ref: 'GT-9920', locationId: 'st-WA', city: 'Seattle, WA', zone: '4C', ground: 'Silty Sand / Gravel',
      fidelity: 'High (Sensor + Satellite)', buildingType: 'Commercial Office (Class A)', floorArea: 12500, floors: 12,
      heatDemand: 850000, coolDemand: 1120000, peakLoad: 450, depthLimit: 350, analyzedAt: '2026-10-14T09:12:00',
      stage: 'deployed', loadMode: 'known', vintage: '2005–2015 (modern code)', hours: 'Extended (14 h × 6 d)', glazing: 'Medium (25–40%)', siteArea: 9000,
      client: 'Aurora Development LLC', updatedAt: '2026-10-14T09:12:00'
    };
    const p = Object.assign(base, over || {});
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
      sim: { scenario: 'winter', ambient: -12, loadVar: 25, demand: +((p.heatDemand + p.coolDemand) / 1e6).toFixed(2), years: 5 },
      alerts: null,
      reports: [],
      chat: [],
      history: [],
      progress: {},
      ops: { rows: [] }
    };
  }

  function seedReports() {
    return [
      { id: 'r0', title: 'Engineering Analysis Report', date: '2026-10-14', type: 'ENGINEERING' },
      { id: 'r1', title: 'Comprehensive System Analysis', date: '2026-10-14', type: 'SIMULATION' },
      { id: 'r2', title: 'Q4 Financial Yield Forecast', date: '2026-10-12', type: 'FINANCIAL' },
      { id: 'r3', title: 'Borefield Thermal Risk Assessment', date: '2026-10-08', type: 'RISK' },
      { id: 'r4', title: 'Environmental Impact Audit', date: '2026-09-29', type: 'COMPLIANCE' },
      { id: 'r5', title: 'Operational Efficiency Log', date: '2026-09-25', type: 'MONITORING' }
    ];
  }

  function sampleProject() {
    const a = defaultProject('sample', { name: 'Aurora District Phase 1', sample: true });
    a.reports = seedReports();
    a.progress = { site: true, building: true, design: true, finance: true };
    const mk = (label, t, over) => { const d = Object.assign({}, a.design, over); const r = E.compute(a.project, d, E.DEFAULT_SETTINGS, a.mitigation); return { t, label, design: d, scop: r.SCOP, capex: r.capex, payback: r.paybackYears, n: d.n, depth: d.depth }; };
    a.history = [mk('Commissioned design', '2026-09-30T16:20:00', {}), mk('Design review v2', '2026-08-12T11:05:00', { n: 44, depth: 270 }), mk('Initial feasibility', '2026-06-03T09:40:00', { n: 48, depth: 250, spacing: 6.0 })];
    a.log = [
      { t: '2026-04-14T15:40:12', msg: 'Compressor Cycle Restart', cat: 'System', status: 'Success' },
      { t: '2026-04-14T15:38:45', msg: 'Load threshold updated', cat: 'Config', status: 'Modified' },
      { t: '2026-04-14T15:32:01', msg: 'Thermal Plume Calibration', cat: 'Intelligence', status: 'Completed' },
      { t: '2026-04-14T15:15:30', msg: 'Loop balancing valve adjusted (+5%)', cat: 'Hardware', status: 'Active' }];
    return a;
  }

  function freshState() {
    return {
      v: 5, current: null,
      projects: {}, order: [],
      settings: Object.assign({}, E.DEFAULT_SETTINGS, { units: 'metric', tips: true, hiddenTips: {} }),
      user: { access: 'admin' },
      log: []
    };
  }

  let state;
  try { const raw = localStorage.getItem(KEY); state = raw ? JSON.parse(raw) : null; } catch (e) { state = null; }
  /* migrate: drop chats seeded with old mock wording */
  if (state && state.projects) Object.values(state.projects).forEach(p => { if (p.chat && JSON.stringify(p.chat).includes('Southern Cluster')) p.chat = []; if (p.reports) p.reports.forEach(r => { if (r.title === 'Borehole Zone 4 Risk Assessment') r.title = 'Borefield Thermal Risk Assessment'; }); });
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
    samplePreview() { try { const a = sampleProject(); return E.compute(a.project, a.design, state.settings, a.mitigation); } catch (e) { return null; } },
    loadSample() { const a = sampleProject(); if (state.projects.sample) { state.current = 'sample'; emit('switch'); return; } state.projects.sample = a; state.order.push('sample'); state.current = 'sample'; emit('switch'); },
    setOps(rows) { const c = cur(); c.ops = { rows, updatedAt: now() }; emit('ops'); },
    setProject(patch, silent) {
      const c = cur();
      Object.assign(c.project, patch);
      c.project.updatedAt = now();
      if (c.project.loadMode === 'calculated' && !('heatDemand' in patch) && !('coolDemand' in patch) && !('peakLoad' in patch)) {
        const l = E.loadCalc(c.project); c.project.heatDemand = l.heat; c.project.coolDemand = l.cool; c.project.peakLoad = l.peak;
      }
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
      state.projects[id] = defaultProject(id, Object.assign({ zone: L.zone, ground: L.ground, city: '', ref: 'GT-' + (1000 + Math.floor(Math.random() * 8999)), stage: 'assessment', loadMode: 'calculated', client: '', siteArea: 0, analyzedAt: '', updatedAt: now() }, over));
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
