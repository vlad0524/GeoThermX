/* GeoThermX app shell: router, public/app layouts, sidebar, top bar, gating, store wiring. */
(function () {
  'use strict';
  const U = window.GXUI, S = window.GXStore, E = window.GXEngine;
  const GX = window.GX = window.GX || {};
  GX.views = GX.views || {};

  const NAV = [
    ['Project', [['projects', 'Projects'], ['dashboard', 'Overview']]],
    ['Feasibility study', [['site-intelligence', 'Site', 1], ['project-setup', 'Building & Loads', 2], ['system-design', 'Ground Loop', 3], ['costs', 'Costs & Incentives', 4], ['financial-analysis', 'Payback', 5], ['reports', 'Report', 6]]],
    ['After installation', [['monitoring', 'Operation']]],
    ['Resources', [['us-map', 'US Payback Map'], ['methodology', 'Methodology & Data'], ['feedback', 'Feedback & Pilot']]],
    ['', [['preferences', 'Settings']]]
  ];
  /* Pages grouped under one sidebar item, shown as tabs at the top of the page */
  const GROUPS = {
    'system-design': [['system-design', 'Design'], ['drilling-optimization', 'Borefield & drilling'], ['simulation-lab', 'Long-term simulation'], ['risk-engine', 'Risks']],
    'financial-analysis': [['financial-analysis', 'Cash flow & payback'], ['scenario-comparison', 'Compare options']],
    monitoring: [['monitoring', 'Measured data'], ['alerts', 'Alerts']]
  };
  const PARENT = {}; Object.entries(GROUPS).forEach(([p, tabs]) => tabs.forEach(t => { PARENT[t[0]] = p; }));
  const STEP_OF = { 'site-intelligence': [1, 'Site'], 'project-setup': [2, 'Building & Loads'], 'system-design': [3, 'Ground Loop'], costs: [4, 'Costs & Incentives'], 'financial-analysis': [5, 'Payback'], reports: [6, 'Report'] };
  const stepHeader = id => { const s = STEP_OF[PARENT[id] || id]; return s ? { mode: 'step', step: s[0], label: s[1] } : null; };
  const REDIRECT = { benchmarking: 'dashboard', 'ai-assistant': 'dashboard' };
  GX.parentOf = id => PARENT[id] || id;
  const NOPROJ = ['us-map', 'methodology', 'feedback'];   // work without a project (public layout)
  const pubBar = id => `<div class="pub-bar"><a class="brand" href="#">GeoThermX</a><nav>${[['us-map', 'US Payback Map'], ['methodology', 'Methodology'], ['feedback', 'Feedback & Pilot']].map(([k, l]) => `<a href="#${k}" class="${k === id ? 'on' : ''}">${l}</a>`).join('')}</nav><button class="btn btn-primary btn-sm" data-new-project="1">Start a project</button></div>`;
  function subtabs(id) {
    const g = GROUPS[PARENT[id]]; if (!g) return '';
    return `<div class="subtabs" role="tablist">${g.map(([t, l]) => `<a href="#${t}" role="tab" aria-selected="${t === id}" class="${t === id ? 'on' : ''}">${l}</a>`).join('')}</div>`;
  }
  const PUBLIC = [];
  const OPS = ['monitoring', 'alerts'];
  let currentId = null, currentView = null, gateKey = '';

  GX.go = id => { if (location.hash.slice(1) === id) route(); else location.hash = id; };
  GX.shortName = () => { const n = S.cur().project.name; return n.replace(/ Phase /, ' Ph. '); };
  GX.avatar = () => '<i class="acct-ic" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg></i>';
  GX.userBlock = () => `<button class="user" data-go="preferences" title="Settings" aria-label="Settings">${GX.avatar()}</button>`;
  GX.guard = () => true;

  function sidebar() {
    const open = (window.GXAlerts && GX.deployed() ? window.GXAlerts.openCritical() : 0);
    const c = S.cur().project; const pg = GX.progress();
    return `<a class="brand" href="#dashboard">GeoThermX</a>
      <button class="side-proj" data-go="projects" title="All projects"><span class="sp-n">${U.esc(c.name)}</span><span class="sp-s">${c.sample ? '<b class="sample-tag">Sample</b> · ' : ''}${GX.STAGES[c.stage || 'design'][0]} · ${pg.done}/${pg.total} steps</span><span class="sp-bar"><i style="width:${pg.done / pg.total * 100}%"></i></span></button>
      <nav class="nav" aria-label="Modules">` + NAV.map(([sec, items]) =>
      `<div class="nav-sec">${sec ? `<div class="nav-label">${sec}</div>` : ''}` + items.map(([id, label]) => {
        const stepKey = { 'site-intelligence': 'site', 'project-setup': 'building', 'system-design': 'design', costs: 'costs', 'financial-analysis': 'finance', reports: 'report' }[id];
        const tag = id === 'monitoring' && open ? `<span class="badge">${open}</span>` : stepKey && GX.stepDone(stepKey) ? '<span class="nav-ok" title="Done">✓</span>' : '';
        const num = items.find(x => x[0] === id)[2];
        return `<a href="#${id}" data-id="${id}" class="${id === currentId || PARENT[currentId] === id ? 'active' : ''}">${num ? `<span class="nav-n">${num}</span>` : ''}${label}${tag}</a>`;
      }).join('') + '</div>').join('') +
      `</nav><div class="side-foot">
        <div class="units-sw" role="group" aria-label="Units"><button data-units="imperial" class="${U.imp() ? 'on' : ''}">US units</button><button data-units="metric" class="${!U.imp() ? 'on' : ''}">Metric</button></div>
        <div style="margin-top:12px">GeoThermX v2.2 · Preliminary engineering estimates</div></div>`;
  }

  function topbar(view) {
    const h = (view.header && view.header.mode === 'dashboard') ? view.header : stepHeader(currentId) || view.header || { mode: 'title' };
    const c = S.cur();
    let left = '', center = '', right = GX.userBlock();
    const demo = h.demo && (h.demo === 'always' || GX.deployed()) ? GX.demoTag(h.demoText) : '';
    if (h.mode === 'dashboard') {
      left = `<div style="position:relative"><button class="proj-btn" id="proj-btn" aria-expanded="false" aria-haspopup="true"><span class="tb-title" style="font-size:17px">${U.esc(c.project.name)}</span><span class="caret"></span></button></div>${GX.stagePill()}`;
      right = `<button class="btn btn-chip" data-go="reports">View Report</button><button class="btn btn-chip" data-go="financial-analysis">Payback</button><button class="btn btn-primary" id="start-project" data-edit>New Project</button><span class="tb-sep hide-sm"></span><button class="user" data-go="preferences" title="Settings" aria-label="Settings">${GX.avatar()}</button>`;
    } else if (h.mode === 'site') {
      left = `<span class="tb-title">${U.esc(c.project.name)}</span><span class="tb-ref">Internal Ref: ${U.esc(c.project.ref)}</span>`;
    } else if (h.mode === 'step') {
      left = `<span class="tb-title">${U.esc(c.project.name)}</span>`;
      center = `<span class="step-pill ${h.dark ? 'dark' : ''}">Step ${h.step} of 6: ${h.label}</span>`;
    } else {
      left = `<span class="tb-title">${U.esc(typeof h.title === 'function' ? h.title() : h.title)}</span>${demo}`;
    }
    return `<div class="tb-left"><button class="menu-btn" id="menu-btn" aria-label="Open menu">${U.icon.menu}</button>${left}</div><div class="tb-center">${center}</div><div class="tb-right">${right}</div>`;
  }

  function projectMenu(btn) {
    const old = U.$('.dropdown'); if (old) { old.remove(); btn.setAttribute('aria-expanded', 'false'); return; }
    const dd = document.createElement('div'); dd.className = 'dropdown';
    dd.innerHTML = S.state.order.map(id => { const p = S.state.projects[id].project; const L = E.location(p.locationId);
      return `<button data-pid="${id}" class="${id === S.state.current ? 'on' : ''}"><span>${U.esc(p.name)}<br><span class="dd-sub">${U.esc(L.city)} · ${U.esc(p.ref)} · ${GX.STAGES[p.stage || 'design'][0]}</span></span>${id === S.state.current ? U.icon.check : ''}</button>`; }).join('') +
      `<hr><button data-all="1"><span>All projects…</span></button><button data-new="1"><span>+ New project</span></button>`;
    btn.parentElement.appendChild(dd); btn.setAttribute('aria-expanded', 'true');
    dd.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.pid) { S.switchProject(b.dataset.pid); U.toast('Switched to ' + U.esc(S.cur().project.name)); S.log('Switched project to ' + S.cur().project.name, 'Config', 'Success'); }
      if (b.dataset.new) GX.newProject();
      if (b.dataset.all) GX.go('projects');
      dd.remove();
    });
    setTimeout(() => document.addEventListener('mousedown', function off(ev) { if (!dd.contains(ev.target) && ev.target !== btn) { dd.remove(); btn.setAttribute('aria-expanded', 'false'); } document.removeEventListener('mousedown', off); }), 0);
  }

  function foot(view) {
    const f = U.$('#footbar');
    if (view.foot) { f.hidden = false; f.innerHTML = view.foot(); } else { f.hidden = true; f.innerHTML = ''; }
  }

  function collectNums(root) { const m = {}; U.$$('[data-key]', root).forEach(el => { m[el.dataset.key] = parseFloat(el.dataset.count); }); return m; }

  function effective(id) {
    const v = GX.views[id];
    if (PUBLIC.includes(id)) return v;
    if (OPS.includes(id) && !GX.deployed()) return { name: v.name, header: v.header, render: el => { el.innerHTML = GX.notDeployed(id === 'monitoring' ? 'Monitoring starts after installation' : 'No operational alerts yet', `${U.esc(S.cur().project.name)} is in the <b>${GX.STAGES[GX.stage()][0]}</b> stage. ${id === 'monitoring' ? 'Live temperature, load and COP tracking' : 'Incident detection and root-cause analysis'} begin once the system is installed and sensors or the BMS are connected. Design-stage issues are listed in the Safety &amp; Compliance checklist (Drilling Optimization) and the Risk Engine.`); } };
    return v;
  }
  const gateOf = id => [id, OPS.includes(id) && !GX.deployed(), S.state.settings.units, S.state.settings.plan].join('|');

  function route() {
    if (U.tip) U.tip(null);   // never leave a tooltip from the previous page on screen
    let id = location.hash.slice(1);
    if (REDIRECT[id]) id = REDIRECT[id];
    if (!GX.views[id]) id = 'dashboard';
    if (!S.cur() && NOPROJ.includes(id)) {
      if (currentView && currentView.unmount) currentView.unmount();
      currentId = id; currentView = GX.views[id]; gateKey = 'pub|' + id + '|' + S.state.settings.units;
      document.body.classList.add('public'); U.$('#sidebar').innerHTML = ''; U.$('#topbar').innerHTML = ''; U.$('#introbar').innerHTML = ''; U.$('#footbar').hidden = true;
      document.title = currentView.name + ' · GeoThermX'; const host = U.$('#view'); host.scrollTop = 0;
      host.innerHTML = `<div class="view-inner pub-inner">${pubBar(id)}<div id="vroot"></div></div>`; currentView.render(U.$('#vroot')); U.animateNumbers(host, {}); U.bindTips(host);
      if (GX.trackPage) GX.trackPage(id, currentView.name); return;
    }
    if (!S.cur()) {
      if (currentView && currentView.unmount) currentView.unmount();
      currentId = 'welcome'; currentView = { name: 'Welcome', render(el) { el.innerHTML = GX.welcomeHtml(); this._off = GX.welcomeMount(el); }, unmount() { if (this._off) this._off(); } }; gateKey = 'welcome';
      document.body.classList.add('public'); U.$('#sidebar').innerHTML = ''; U.$('#topbar').innerHTML = ''; U.$('#introbar').innerHTML = ''; U.$('#footbar').hidden = true;
      document.title = 'GeoThermX'; const host = U.$('#view'); host.innerHTML = `<div class="view-inner"><div id="vroot"></div></div>`; currentView.render(U.$('#vroot')); if (GX.trackPage) GX.trackPage('welcome', 'Welcome'); return;
    }
    if (id === 'financial-analysis') S.mark('finance');
    const view = effective(id);
    if (currentView && currentView.unmount) currentView.unmount();
    currentId = id; currentView = view; gateKey = gateOf(id);
    const pub = PUBLIC.includes(id);
    document.body.classList.toggle('public', pub);
    document.body.classList.remove('nav-open');
    U.$('#sidebar').innerHTML = pub ? '' : sidebar();
    U.$('#topbar').innerHTML = pub ? '' : topbar(view);
    U.$('#introbar').innerHTML = pub ? '' : GX.introHtml(id);
    document.title = (view.name || 'Platform') + ' · GeoThermX';
    const host = U.$('#view');
    host.scrollTop = 0;
    host.classList.toggle('has-foot', !!view.foot);
    host.innerHTML = `<div class="view-inner">${subtabs(id)}<div id="vroot"></div></div>`;
    const vr = U.$('#vroot');
    view.render(vr);
    foot(view);
    U.animateNumbers(host, {});
    U.bindTips(host);
    if (view.mount) view.mount(vr);
    if (GX.trackPage) GX.trackPage(id, view.name);
  }

  function repaint(reason) {
    document.body.classList.toggle('readonly', !S.canEdit());
    if (!currentView) return;
    if (PUBLIC.includes(currentId)) return;
    if (!S.cur() || currentId === 'welcome') { route(); return; }
    if (U.$('.pub-inner')) { route(); return; }
    if (reason === 'switch' || reason === 'reset' || reason === 'user' || reason === 'stage' || reason === 'projects' || gateOf(currentId) !== gateKey) { const keep = U.$('#view').scrollTop; route(); U.$('#view').scrollTop = keep; return; }
    U.$('#sidebar').innerHTML = sidebar();
    U.$('#topbar').innerHTML = topbar(currentView);
    const host = U.$('#view');
    const before = collectNums(document);
    const vr = U.$('#vroot');
    if (currentView.paint) currentView.paint(vr, reason); else currentView.render(vr);
    foot(currentView);
    U.animateNumbers(document, before);
    U.bindTips(host);
  }
  GX.repaint = repaint;

  document.addEventListener('click', e => {
    const g = e.target.closest('[data-go]');
    if (g) { e.preventDefault(); GX.go(g.dataset.go); return; }
    const un = e.target.closest('[data-units]'); if (un) { S.setSettings({ units: un.dataset.units }); if (GX.track) GX.track('units-' + un.dataset.units); U.toast(un.dataset.units === 'imperial' ? 'US units: ft, ft², tons, °F, gpm' : 'Metric units: m, m², kW, °C, L/s'); return; }
    if (e.target.closest('#menu-btn')) { document.body.classList.toggle('nav-open'); return; }
    if (e.target.closest('#proj-btn')) { projectMenu(e.target.closest('#proj-btn')); return; }
    if (e.target.closest('#start-project')) { GX.newProject(); return; }
    if (document.body.classList.contains('nav-open') && !e.target.closest('#sidebar')) document.body.classList.remove('nav-open');
  });

  window.addEventListener('hashchange', route);
  S.subscribe(repaint);
  document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.toggle('readonly', !S.canEdit());
    if (window.GXAlerts) window.GXAlerts.sync();
    route();
  });
})();
