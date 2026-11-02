/* GeoThermX views: Monitoring, Alerts & Issues, Risk Engine, Benchmarking */
(function () {
  'use strict';
  const U = window.GXUI, S = window.GXStore, E = window.GXEngine, A = window.GXAlerts;
  const GX = window.GX; const esc = U.esc;

  /* ================= MONITORING (live) ================= */
  const live = { buf: null, key: null, uptime: 99.98, tick: 0, prevCop: null };
  function seedLive(r) {
    const key = JSON.stringify([S.state.current, r.SCOP.toFixed(3), r.EWTc.toFixed(2), S.cur().design.coolPeak]);
    if (live.key === key && live.buf) return;
    live.key = key; live.buf = { t: [], out: [], load: [], cop: [] };
    for (let i = 0; i < 48; i++) pushLive(r, i);
  }
  function pushLive(r, i) {
    const b = live.buf; const k = (live.tick++);
    const base = S.cur().project.peakLoad * 0.88;
    const load = base * (0.86 + 0.08 * Math.sin(k / 5) + 0.05 * Math.sin(k / 1.7) + (Math.random() - 0.5) * 0.05);
    const cop = r.SCOP * (1.02 + 0.025 * Math.sin(k / 6 + 1) + (Math.random() - 0.5) * 0.012) * (1 - 0.04 * (load / base - 0.9));
    const out = r.EWTc + 12.6 + 0.9 * Math.sin(k / 4) + 0.7 * Math.sin(k / 2.3) + (Math.random() - 0.5) * 0.4;
    b.t.push(new Date(Date.now() - (47 - (i == null ? 47 : i)) * 1500)); b.load.push(load); b.cop.push(cop); b.out.push(out);
    if (b.t.length > 48) { b.t.shift(); b.load.shift(); b.cop.shift(); b.out.shift(); }
  }
  const EVENTS = [['Loop pressure normalized (2.1 bar)', 'Hardware', 'Success'], ['AI Routine: Load Forecast Refresh', 'Intelligence', 'Completed'], ['Heat pump HP-3 stage 2 engaged', 'System', 'Active'], ['Sensor node 412 heartbeat restored', 'Hardware', 'Success'], ['Flow balancing valve B-07 adjusted (-3%)', 'Hardware', 'Active'], ['BMS setpoint sync (22.5°C)', 'System', 'Success']];

  GX.views.monitoring = {
    name: 'Monitoring', header: { mode: 'title', title: () => GX.shortName() + (GX.isSample() ? ' — Live Operations' : ' — Operations'), online: true, demo: true },
    render(el) { el.innerHTML = '<div id="mon"></div>'; this.paint(el); },
    mount(el) {
      if (!GX.isSample()) return;
      this.timer = setInterval(() => { const r = S.result(); pushLive(r); this.paintLive(el, true); }, 1500);
      this.evTimer = setInterval(() => { const e = EVENTS[Math.floor(Math.random() * EVENTS.length)]; S.log(e[0], e[1], e[2]); this.paintLog(el); }, 9000);
    },
    unmount() { clearInterval(this.timer); clearInterval(this.evTimer); },
    paint(el) {
      if (!GX.isSample()) return GX.opsData.paint(el);
      const r = S.result(); seedLive(r);
      const alerts = A.list().filter(a => a.status !== 'resolved' && a.sev !== 'info').slice(0, 3);
      const flowOpt = GX.whatIf({ flow: Math.min(0.95, S.cur().design.flow) });
      U.$('#mon', el).innerHTML = `
        ${!GX.plan().liveMonitoring ? '<div class="plan-note">Live analysis is part of the Enterprise plan. Showing the last recorded snapshot. <button class="link-btn" data-go="preferences">Compare plans</button></div>' : ''}
        <div class="mon-kpis" id="mon-kpis"></div>
        <div class="mon-grid">
          <div class="mon-charts">
            <div class="card pad mchart"><div class="between"><span class="mc-t">Live Temperature Profile</span><span class="mc-r teal num" id="mc-temp"></span></div><div class="mc-plot" id="mc-p1"></div></div>
            <div class="card pad mchart"><div class="between"><span class="mc-t">Load Demand Tracking</span><span class="mc-r num" style="color:var(--ink-3)">Peak Load: ${U.n(S.cur().project.peakLoad)}kW</span></div><div class="mc-plot" id="mc-p2"></div></div>
            <div class="card pad mchart"><div class="between"><span class="mc-t">Real-Time COP Efficiency</span><span class="mc-r teal num">Target: ${(r.SCOP * 0.98).toFixed(2)}</span></div><div class="mc-plot" id="mc-p3"></div></div>
          </div>
          <div class="mon-side">
            <div class="card pad"><h3 class="card-title dark">Active Alerts</h3><div class="ma-list">${alerts.length ? alerts.map(a => `<button class="ma ${a.sev}" data-alert="${a.id}"><b>${esc(a.title)}</b><span>${a.time} — ${esc(a.area)}</span></button>`).join('') : '<div class="empty-ok">No active alerts.</div>'}
              ${alerts.length < 3 ? '<button class="ma ok" data-go="alerts"><b>Scheduled Maintenance Sync</b><span>12:00:00 — Core Pump 1</span></button>' : ''}</div></div>
            <div class="card pad"><h3 class="card-title teal">AI Insights</h3><div class="fi">
              <div class="insight">✦ ${r.imbalance > 0.2 ? 'Temperature spike detected in the borefield core. Adjusting flow rate to compensate thermal expansion.' : 'Zone temperatures are balanced across all clusters.'}</div>
              <div class="insight">✦ System is operating in the "${r.SCOP > 4.5 ? 'Ultra-High' : r.SCOP > 3.8 ? 'High' : 'Standard'} Efficiency" range. Estimated energy savings today: <span id="sav-today">${U.money(r.energySavings / 365)}</span>.${S.cur().design.flow > 1 ? ` Trimming flow to 0.95 L/s would add ${U.money((flowOpt.annualSavings - r.annualSavings) / 365)}/day.` : ''}</div></div></div>
          </div>
        </div>
        <div class="card pad mon-log"><h3 class="card-title dark">Activity Log</h3><div class="log-table" id="mon-log"></div></div>`;
      el.querySelectorAll('[data-alert]').forEach(b => b.onclick = () => { GX.views.alerts.state.sel = b.dataset.alert; GX.go('alerts'); });
      this.paintLive(el, false); this.paintLog(el);
    },
    paintLive(el, tick) {
      const r = S.result(), b = live.buf; if (!b || !U.$('#mon-kpis', el)) return;
      const n = b.cop.length, cop = b.cop[n - 1], load = b.load[n - 1];
      const chg = (cop / r.SCOP - 1) * 100;
      U.$('#mon-kpis', el).innerHTML = `
        <div class="card kpi-sm"><div class="lbl">System Status</div><div class="val" style="color:var(--green)">${r.stability > 0.65 ? 'Optimal' : 'Degraded'}</div></div>
        <div class="card kpi-sm"><div class="lbl">Efficiency (COP)</div><div class="val num">${cop.toFixed(2)} <small class="${chg >= 0 ? 'green' : 'red'}">${chg >= 0 ? '↑' : '↓'} ${Math.abs(chg).toFixed(1)}%</small></div></div>
        <div class="card kpi-sm"><div class="lbl">Active Load</div><div class="val num">${U.n(load, 0)} <small style="color:var(--muted)">kW</small></div></div>
        <div class="card kpi-sm"><div class="lbl">Ground Temp</div><div class="val num">${U.temp(r.c.tg + (live.tick % 40 === 0 ? 0.1 : 0))} <small style="color:var(--muted);font-size:11px">STABLE</small></div></div>
        <div class="card kpi-sm"><div class="lbl">Uptime</div><div class="val num">${live.uptime.toFixed(2)}%</div></div>`;
      U.$('#mc-temp', el).textContent = `${U.temp(b.out[n - 1])} Out / ${U.temp(r.c.tg)} In`;
      const draw = (id, arr, color, lo, hi, opts) => {
        const W = 1000, H = 120; const mn = Math.min(...arr), mx = Math.max(...arr); const pad = (mx - mn) * (opts.pad || 1.2) + 1e-6;
        const X = i => i / (arr.length - 1) * (W - 40), Y = U.scale(mn - pad, mx + pad, H - lo, hi);
        const pts = arr.map((v, i) => [X(i), Y(v)]);
        const d = opts.straight ? U.linePath(pts) : U.smooth(pts, 0.2);
        const last = pts[pts.length - 1];
        U.$(id, el).innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="chart" style="height:100%"><line x1="0" x2="${W}" y1="${H - 18}" y2="${H - 18}" stroke="#f1f5f9"/>${opts.target ? `<line x1="0" x2="${W}" y1="${Y(opts.target)}" y2="${Y(opts.target)}" stroke="#14b8a6" stroke-opacity=".25" stroke-dasharray="4 4"/>` : ''}<path d="${d}" fill="none" stroke="${color}" stroke-width="2.2" vector-effect="non-scaling-stroke"/><circle cx="${last[0]}" cy="${last[1]}" r="4" fill="${color}" class="live-dot"/></svg>`;
        const svg = U.$(id + ' svg', el);
        svg.addEventListener('mousemove', e => { const rc = svg.getBoundingClientRect(); const i = U.clamp(Math.round((e.clientX - rc.left) / rc.width * (W) / ((W - 40) / (arr.length - 1))), 0, arr.length - 1); U.tip(`${U.time(b.t[i])}<br><b>${opts.fmt(arr[i])}</b>`, e.clientX, e.clientY); });
        svg.addEventListener('mouseleave', () => U.tip(null));
      };
      draw('#mc-p1', b.out, '#ef4444', 30, 14, { fmt: v => U.temp(v) + ' supply' });
      draw('#mc-p2', b.load, '#0f172a', 30, 14, { straight: true, fmt: v => U.n(v, 0) + ' kW' });
      draw('#mc-p3', b.cop, '#14b8a6', 30, 14, { pad: 2, target: r.SCOP * 0.98, fmt: v => 'COP ' + v.toFixed(2) });
    },
    paintLog(el) {
      const L = S.logs().slice(0, 5); const box = U.$('#mon-log', el); if (!box) return;
      const col = s => s === 'Success' || s === 'Completed' ? 'var(--green)' : s === 'Failed' ? 'var(--red)' : 'var(--ink)';
      box.innerHTML = `<div class="lt-h"><span>Timestamp</span><span>Event Description</span><span>Category</span><span>Status</span></div>` + L.map((x, i) => `<div class="lt-r ${i === 0 ? 'new' : ''}"><span class="num">${U.stamp(x.t)}</span><span>${esc(x.msg)}</span><span>${esc(x.cat)}</span><span style="color:${col(x.status)}">${esc(x.status)}</span></div>`).join('');
    },
    foot: () => !GX.isSample() ? `<span class="spacer"></span><button class="btn btn-ghost" id="op-add" data-edit>Add month</button><button class="btn btn-ghost" id="op-up" data-edit>Upload CSV</button>${(S.cur().ops.rows || []).length ? '<button class="btn btn-ghost" id="op-exp">Export data</button><button class="btn btn-accent" id="mon-report">Generate Performance Report</button>' : '<button class="btn btn-ghost" id="op-tpl">CSV template</button>'}` : `<span class="spacer"></span><button class="btn btn-ghost" id="mon-adjust" data-edit>Adjust System Settings</button><button class="btn btn-ghost" id="mon-export">Export Real-Time Data</button><button class="btn btn-accent" id="mon-report">View Full Performance Report</button>`
  };
  document.addEventListener('click', e => {
    if (e.target.closest('#mon-export')) {
      const b = live.buf; if (!b) return;
      const rows = [['timestamp', 'supply_temp_c', 'load_kw', 'cop']].concat(b.t.map((t, i) => [t.toISOString(), b.out[i].toFixed(2), b.load[i].toFixed(1), b.cop[i].toFixed(3)]));
      U.exportData('Real-time data export', `${S.cur().project.ref}-live-${U.today()}.csv`, U.csv(rows), 'text/csv'); S.log('Exported real-time monitoring data', 'System', 'Success');
    }
    if (e.target.closest('#mon-report')) { GX.views.reports.create('Operational Performance Report', 'MONITORING'); GX.go('reports'); }
    if (e.target.closest('#mon-adjust')) {
      if (!GX.guard()) return;
      const c = S.cur(), m = c.mitigation;
      U.modal({ title: 'Adjust system settings', body: `
        <div class="field"><label for="ad-flow">Circulation flow per loop: <b id="ad-flow-v">${c.design.flow.toFixed(2)} L/s</b></label><input type="range" class="range" id="ad-flow" min="0.3" max="1.6" step="0.05" value="${c.design.flow}"></div>
        <div class="between"><div><b style="font-size:13.5px">Load rebalancing</b><div class="muted" style="font-size:12.5px">Shift demand from the South cluster to redundant loops.</div></div><button class="toggle ${m.rebalance ? 'on' : ''}" id="ad-reb" aria-label="Load rebalancing"></button></div>
        <div class="between"><div><b style="font-size:13.5px">Off-peak pump trim</b><div class="muted" style="font-size:12.5px">Cap flow at 0.95 L/s outside peak hours.</div></div><button class="toggle ${m.flowOpt ? 'on' : ''}" id="ad-trim" aria-label="Off-peak pump trim"></button></div>
        <div class="between"><div><b style="font-size:13.5px">Raise return flow temperature +2°C</b><div class="muted" style="font-size:12.5px">Reduces heat rejection stress in cooling season.</div></div><button class="toggle ${m.returnTemp ? 'on' : ''}" id="ad-ret" aria-label="Raise return temperature"></button></div>
        <div class="insight" id="ad-prev"></div>`,
        onMount: (s) => {
          const st = { flow: c.design.flow, reb: m.rebalance, trim: m.flowOpt, ret: !!m.returnTemp };
          const prev = () => { const w = GX.whatIf({ flow: st.flow }, { rebalance: st.reb, flowOpt: st.trim, returnTemp: st.ret ? 2 : 0 }); const r = S.result(); U.$('#ad-prev', s).innerHTML = `Preview: COP <b>${w.SCOP.toFixed(2)}</b> (${U.signed((w.SCOP / r.SCOP - 1) * 100, 1, '%')}) · savings <b>${U.money(w.annualSavings)}</b>/yr · risk <b>${w.risk.score}</b>`; };
          U.$('#ad-flow', s).oninput = e => { st.flow = +e.target.value; U.$('#ad-flow-v', s).textContent = st.flow.toFixed(2) + ' L/s'; prev(); };
          [['#ad-reb', 'reb'], ['#ad-trim', 'trim'], ['#ad-ret', 'ret']].forEach(([id, k]) => { U.$(id, s).onclick = ev => { st[k] = !st[k]; ev.currentTarget.classList.toggle('on', st[k]); prev(); }; });
          prev(); s._st = st;
        },
        actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Apply to system', kind: 'accent', onClick: s => { const st = s._st; S.setMitigation({ rebalance: st.reb, flowOpt: st.trim, returnTemp: st.ret ? 2 : 0 }); if (st.flow !== c.design.flow) S.setDesign({ flow: st.flow }, 'ops'); S.log(`Operator settings: flow ${st.flow.toFixed(2)} L/s, rebalance ${st.reb ? 'on' : 'off'}, trim ${st.trim ? 'on' : 'off'}`, 'Config', 'Modified'); U.toast('System settings applied'); } }]
      });
    }
  });

  /* ================= ALERTS & ISSUES ================= */
  GX.views.alerts = {
    name: 'Alerts & Issues', header: { mode: 'title', title: () => GX.shortName() + ' — Alerts Center', demo: true },
    state: { sel: null, filter: 'all' },
    render(el) { el.innerHTML = '<div id="al"></div>'; this.paint(el); },
    mount(el) { this.clk = setInterval(() => { const x = U.$('#scan-clock'); if (x) x.textContent = U.time(); }, 1000); },
    unmount() { clearInterval(this.clk); },
    paint(el) {
      const list = A.list(), cnt = A.counts(), f = this.state.filter;
      const shown = list.filter(a => f === 'all' ? true : f === 'critical' ? a.sev === 'critical' && a.status !== 'resolved' : f === 'warnings' ? a.sev === 'warning' && a.status !== 'resolved' : f === 'active' ? a.status !== 'resolved' && a.sev !== 'info' && a.sev !== 'scheduled' : a.status === 'resolved');
      if (!list.length) { U.$('#al', el).innerHTML = `<div class="card empty-state"><div class="es-ico">✓</div><h2>No open alerts</h2><p class="muted">${GX.isSample() ? '' : (S.cur().ops.rows || []).length ? 'Measured performance in the latest months is within 10% of the design model.' : 'Alerts are generated from your monthly operating data. Upload data in Monitoring to start tracking deviations.'}</p><div class="row" style="justify-content:center"><button class="btn btn-accent" data-go="monitoring">Open Monitoring</button></div></div>`; return; }
      if (!this.state.sel || !list.find(a => a.id === this.state.sel)) this.state.sel = (list.find(a => a.status !== 'resolved' && a.sev === 'critical') || list[0]).id;
      const sel = list.find(a => a.id === this.state.sel);
      const pill = a => { const m = { investigating: ['red', 'Investigating'], active: [a.sev === 'critical' ? 'red' : 'amber', 'Active'], resolved: ['green', 'Resolved'], info: ['gray', 'Info'], scheduled: ['gray', 'Scheduled'], assigned: ['blue', 'Assigned'] }[a.status] || ['gray', a.status]; return `<span class="pill ${m[0]}">${m[1]}</span>`; };
      const border = a => a.sev === 'critical' ? 'var(--red)' : a.sev === 'warning' ? 'var(--amber)' : 'var(--blue)';
      U.$('#al', el).innerHTML = `
        <div class="al-kpis">
          ${(GX.isSample() ? [['critical', 'Critical Alerts', cnt.critical, 'red', cnt.critical ? '+1 New' : 'Clear', 'red'], ['warnings', 'Warnings', cnt.warnings, 'amber', 'Stable', 'muted'], ['active', 'Active Issues', cnt.active, '', '↓ -2 Resolved', 'green'], ['resolved', 'Resolved Today', cnt.resolved, 'green', 'Avg. 14m', 'green']] : [['critical', 'Critical', cnt.critical, 'red', '', 'red'], ['warnings', 'Warnings', cnt.warnings, 'amber', '', 'muted'], ['active', 'Open', cnt.active, '', '', 'green'], ['resolved', 'Resolved', cnt.resolved, 'green', '', 'green']]).map(([k, l, v, c, sub, sc]) => `<button class="card kpi-sm al-k ${f === k ? 'on' : ''}" data-f="${k}"><div class="lbl">${l}</div><div class="val num"><span class="${c}" style="font-size:30px">${String(v).padStart(2, '0')}</span> <small class="${sc}" style="font-size:15px">${sub}</small></div></button>`).join('')}
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
              <h3 class="card-title" style="margin-top:26px">AI Root Cause Analysis</h3>
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
    foot: () => { const c = A.counts(); if (!GX.isSample()) return `<span class="row" style="gap:28px;font-size:14px;font-weight:500;color:var(--ink-3);flex-wrap:wrap"><span class="row" style="gap:8px"><span class="dot" style="background:var(--red)"></span>${c.critical} critical</span><span class="row" style="gap:8px"><span class="dot" style="background:var(--amber)"></span>${c.warnings} warnings</span></span><span class="spacer"></span><button class="btn btn-ghost" data-go="monitoring">Operating data</button>`; return `<span class="row" style="gap:28px;font-size:14px;font-weight:500;color:var(--ink-3);flex-wrap:wrap"><span class="row" style="gap:8px"><span class="dot" style="background:var(--red)"></span>${c.critical} Critical Active</span><span class="row" style="gap:8px"><span class="dot" style="background:var(--amber)"></span>${c.warnings} Warnings Pending</span><span class="row" style="gap:8px"><span class="dot" style="background:var(--green)"></span>${c.resolved} Resolved Today</span></span><span class="spacer"></span><span class="note">Last System Scan: <span id="scan-clock" class="num">${U.time()}</span> (Live)</span>`; }
  };

  /* ================= RISK ENGINE ================= */
  GX.views['risk-engine'] = {
    name: 'Risk Engine', header: { mode: 'title', title: () => GX.shortName() + ' — Predictive Risk Center' },
    render(el) { el.innerHTML = '<div id="rk"></div>'; this.paint(el); },
    model() {
      const r = S.result(), P = r.risk.parts, c = S.cur(), m = c.mitigation;
      const risks = [
        { name: 'Thermal Overload', prob: U.clamp(28 + P.overload * 45 + P.imbalance * 32, 3, 97), hz: P.overload > 0.5 ? '3-6m' : '9-12m' },
        { name: 'Subsurface Saturation', prob: U.clamp(10 + P.saturation * 64, 3, 95), hz: Math.max(6, Math.round(14 - P.saturation * 6)) + 'm' },
        { name: 'Pump Cavitation Trend', prob: U.clamp(P.cavitation * 62, 2, 95), hz: P.cavitation > 0.4 ? '8w' : '6m' },
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
      actions.push('Adjust return flow temp +2°C');
      if (k.P.cavitation > 0.3) actions.push('Trim pump flow to 0.95 L/s off-peak'); else actions.push('Verify loop flow balance across all boreholes');
      U.$('#rk', el).innerHTML = `
        <div class="card rk-agg">
          <div class="ring"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" fill="none" stroke="#f1f5f9" stroke-width="7"/><circle cx="40" cy="40" r="34" fill="none" stroke="${col}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - sc / 100)}" transform="rotate(-90 40 40)" class="ring-arc" style="--c:${circ}"/></svg><b>${U.count(sc, 'n0', 'rk-sc')}</b></div>
          <div><div class="row" style="gap:14px;flex-wrap:wrap"><h2>${GX.deployed() ? 'Aggregate System Risk' : 'Projected System Risk'} ${GX.info('risk')}</h2><span class="pill ${pillC}" style="text-transform:none;font-size:13px;height:26px;padding:0 12px">${r.risk.label}</span>${k.applied ? '<span class="pill teal" style="text-transform:none;font-size:12px">Mitigation active</span>' : ''}</div>
          <p class="muted">${k.P.imbalance > 0.3 ? `Current geothermal load analysis indicates a seasonal thermal imbalance in the borefield. Without load rebalancing, the system efficiency is projected to drop below the ${thr}% stability threshold by ${qtr}.` : `Thermal field is within tolerance. The main residual exposure is ${k.risks[0].name.toLowerCase()} (${k.risks[0].prob.toFixed(0)}% probability).`}</p></div>
        </div>
        <div class="rk-grid">
          <div><h3 class="card-title ink3 rk-h">Priority Risks (Top 3)</h3>
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
            <div class="insight" style="margin-top:20px"><b class="teal6">AI Insight:</b> Imbalance is driven by asymmetrical building demand (${cooling ? 'cooling' : 'heating'} ${Math.round(Math.abs(S.cur().project.coolDemand - S.cur().project.heatDemand) / Math.min(S.cur().project.coolDemand, S.cur().project.heatDemand) * 100)}% higher). Increasing borehole spacing in the next design revision will eliminate ${k.riskCut.toFixed(0)}% of current risk.</div>
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
      S.log(on ? 'AI risk mitigation plan applied' : 'AI risk mitigation reverted', 'Intelligence', on ? 'Completed' : 'Modified');
      U.toast(on ? `Mitigation applied. Risk ${before} → <b>${S.result().risk.score}</b>` : 'Mitigation reverted');
    }
    if (e.target.closest('#rk-export')) {
      const k = GX.views['risk-engine'].model(), r = k.r;
      const data = { project: S.cur().project.name, generated: new Date().toISOString(), aggregateRisk: r.risk.score, label: r.risk.label, components: Object.fromEntries(Object.entries(r.risk.parts).map(([a, b]) => [a, +b.toFixed(3)])), priorityRisks: k.risks.map(x => ({ name: x.name, probability: +x.prob.toFixed(1), horizon: x.hz })), cop: { now: +r.SCOP.toFixed(2), month12Unmitigated: +k.cop12.toFixed(2) }, mitigation: S.cur().mitigation };
      U.exportData('Decision data', `${S.cur().project.ref}-risk.json`, JSON.stringify(data, null, 2), 'application/json'); S.log('Exported risk decision data', 'Intelligence', 'Success');
    }
  });

  /* ================= BENCHMARKING ================= */
  GX.views.benchmarking = {
    name: 'Benchmarking', header: { mode: 'title', title: 'Industry Benchmarking — North America Region', demo: 'always', demoText: 'Sample dataset' },
    render(el) { el.innerHTML = '<div id="bm"></div>'; this.paint(el); },
    paint(el) {
      const r = S.result(), p = S.cur().project, b = E.benchmark(r, p), B = b.B;
      const bar = (label, v, max, color, txt, i) => `<div class="bm-row"><span>${label}</span><div class="bm-track"><i style="width:${U.clamp(v / max * 100, 2, 100)}%;background:${color};animation-delay:${i * 80}ms" class="bm-fill"></i></div><b class="num">${txt}</b></div>`;
      const costMax = Math.max(b.costSqft, B.avgCost, B.topCost) * 1.25, copMax = 5.2, outMax = Math.max(r.annualOutput, B.topOut) * 1.1;
      const prevScore = this._prev != null ? this._prev : b.score - 8.4 * b.score / 100;
      this._prev = b.score;
      U.$('#bm', el).innerHTML = `
        <div class="al-kpis">
          <div class="card kpi-sm"><div class="lbl">Your Project Score</div><div class="val">${U.count(b.score, 'n1', 'bm-s')} <small class="green">↑ ${(Math.abs(b.score - prevScore) / prevScore * 100 || 8.4).toFixed(1)}%</small></div></div>
          <div class="card kpi-sm"><div class="lbl">Industry Average</div><div class="val">${B.avgScore.toFixed(1)} <small class="muted">Baseline</small></div></div>
          <div class="card kpi-sm"><div class="lbl">Top Performer Score</div><div class="val">${B.topScore.toFixed(1)} <small class="gold">Gold Tier</small></div></div>
          <div class="card kpi-sm"><div class="lbl">Efficiency Rank</div><div class="val">#${U.count(b.rank, 'n0', 'bm-r')} <small class="muted">of ${B.peers} projects</small></div></div>
        </div>
        <div class="bm-grid">
          <div class="bm-l">
            <div class="card pad bm-card"><div class="between"><span class="bm-t">Efficiency (COP) Comparison</span><span class="teal b" style="font-size:13px">Target: 5.0</span></div>
              ${bar('Your Project', r.SCOP, copMax, 'var(--teal-500)', r.SCOP.toFixed(2), 0)}${bar('Industry Avg.', B.avgCop, copMax, '#cbd5e1', B.avgCop.toFixed(2), 1)}${bar('Top Tier', B.topCop, copMax, 'var(--gold)', B.topCop.toFixed(2), 2)}</div>
            <div class="card pad bm-card"><div class="between"><span class="bm-t">Installation Cost ($/sq.ft)</span><span class="b" style="font-size:13px;color:${b.costSqft > B.avgCost ? 'var(--ink-3)' : 'var(--green)'}">${b.costSqft > B.avgCost ? 'Above Average' : 'Below Average'}</span></div>
              ${bar('Your Project', b.costSqft, costMax, 'var(--teal-500)', '$' + b.costSqft.toFixed(2), 0)}${bar('Industry Avg.', B.avgCost, costMax, '#cbd5e1', '$' + B.avgCost.toFixed(2), 1)}${bar('Top Tier', B.topCost, costMax, 'var(--gold)', '$' + B.topCost.toFixed(2), 2)}</div>
            <div class="card pad bm-card"><div class="between"><span class="bm-t">Annual Energy Output (MWh)</span><span class="b" style="font-size:13px;color:${r.annualOutput >= B.avgOut ? 'var(--green)' : 'var(--amber)'}">${r.annualOutput >= B.avgOut ? 'Optimal Range' : 'Below Average'}</span></div>
              ${bar('Your Project', r.annualOutput, outMax, 'var(--teal-500)', U.n(r.annualOutput, 0), 0)}${bar('Industry Avg.', B.avgOut, outMax, '#cbd5e1', U.n(B.avgOut, 0), 1)}${bar('Top Tier', B.topOut, outMax, 'var(--gold)', U.n(B.topOut, 0), 2)}</div>
          </div>
          <div class="bm-r">
            <div class="card pad"><h3 class="card-title ink3">Performance Insights</h3><div class="fi">
              <div class="insight">✦ Your system efficiency is ${Math.abs(b.effVsAvg).toFixed(0)}% ${b.effVsAvg >= 0 ? 'higher' : 'lower'} than industry average${b.effVsAvg >= 0 ? ' due to AI-driven drilling optimization' : ''}.</div>
              <div class="insight">✦ Initial installation costs are ${b.costSqft <= B.topCost ? 'in the top 10th percentile' : b.costSqft <= B.avgCost ? 'below the regional average' : 'above the regional average'}; ROI is ${r.roi10 > 0 ? 'justified by energy gains' : 'not yet positive over 10 years'}.</div></div></div>
            <div class="card pad" style="flex:1"><h3 class="card-title ink3">Market Opportunities</h3><div class="opp">
              <button data-go="drilling-optimization"><span class="n">1</span>Optimize Drilling Depth<span class="go">→</span></button>
              <button id="bm-hvac"><span class="n">2</span>Streamline HVAC Sync<span class="go">→</span></button>
              <button data-go="financial-analysis"><span class="n">3</span>Federal Grant Eligibility<span class="go">→</span></button></div>
              <div class="muted" style="font-size:11.5px;margin-top:18px;line-height:1.5">Benchmarks use an illustrative regional sample of ${B.peers} commercial geothermal projects.</div></div>
          </div>
        </div>
        <div class="card pad bm-pos"><div class="between"><h3 style="margin:0;font-size:17px">Competitive Positioning</h3><div class="row" style="gap:40px"><span class="teal b" style="font-size:14px">Your Project (Top ${b.topPct}%)</span><span class="teal bb" style="font-size:24px">Top ${b.topPct}%</span></div></div>
          <div class="pos-bar"><i style="width:${100 - b.topPct}%"></i><em style="left:${100 - b.topPct}%"></em></div></div>`;
      const hv = U.$('#bm-hvac', el); if (hv) hv.onclick = () => { GX.go('monitoring'); setTimeout(() => { const x = document.getElementById('mon-adjust'); if (x) x.click(); }, 350); };
    },
    foot: () => `<span class="spacer"></span><button class="btn btn-ghost" id="bm-export">Export Benchmark Data</button><button class="btn btn-ghost" id="bm-peers">View Global Peer List</button><button class="btn btn-accent" id="bm-opt" data-edit>Optimize Project Configuration</button>`
  };
  function peers() {
    const r = S.result(), p = S.cur().project, b = E.benchmark(r, p);
    const names = ['Harborview Tower', 'Cedar Ridge Campus', 'Northgate Medical', 'Riverbend Lofts', 'Summit Office Park', 'Lakeshore Library', 'Pinecrest School', 'Granite Point HQ', 'Willow Creek Senior Living', 'Bayside Logistics', 'Maple Commons', 'Ironwood Labs', 'Elm Street Civic', 'Brookfield Arena'];
    const rows = names.map((n, i) => { const sc = 97.5 - i * 1.6 - (i * 37 % 7) * 0.3; return { n, sc, cop: 4.95 - i * 0.07, city: E.LOCATIONS[i % E.LOCATIONS.length].city }; });
    rows.push({ n: p.name + ' (you)', sc: b.score, cop: r.SCOP, city: r.loc.city, you: true });
    rows.sort((a, c) => c.sc - a.sc);
    return { rows, b };
  }
  document.addEventListener('click', e => {
    if (e.target.closest('#bm-peers')) {
      const { rows, b } = peers();
      U.modal({ title: 'Global peer list', wide: true, body: `<div class="muted" style="font-size:12.5px">Illustrative sample of top-ranked projects. Your project ranks #${b.rank} of ${b.B.peers}.</div><div class="peer-t"><div class="lt-h"><span>#</span><span>Project</span><span>Region</span><span>COP</span><span>Score</span></div>${rows.map((x, i) => `<div class="lt-r ${x.you ? 'you' : ''}"><span>${x.you ? b.rank : i + 1 - (rows.slice(0, i).some(y => y.you) ? 1 : 0)}</span><span>${esc(x.n)}</span><span>${esc(x.city)}</span><span>${x.cop.toFixed(2)}</span><span><b>${x.sc.toFixed(1)}</b></span></div>`).join('')}</div>` });
    }
    if (e.target.closest('#bm-export')) {
      const r = S.result(), b = E.benchmark(r, S.cur().project), B = b.B;
      const rows = [['Metric', 'Your project', 'Industry avg', 'Top tier'], ['Score', b.score.toFixed(1), B.avgScore, B.topScore], ['Seasonal COP', r.SCOP.toFixed(2), B.avgCop, B.topCop], ['Installation cost ($/sq.ft)', b.costSqft.toFixed(2), B.avgCost, B.topCost], ['Annual output (MWh)', r.annualOutput.toFixed(0), B.avgOut, B.topOut], ['Rank', b.rank, '', B.peers]];
      U.exportData('Benchmark data', `${S.cur().project.ref}-benchmark.csv`, U.csv(rows), 'text/csv');
    }
    if (e.target.closest('#bm-opt')) {
      if (!GX.guard()) return; if (S.cur().locked) { U.toast('System Design is locked. Unlock it first.', 'warn'); return; }
      const before = E.benchmark(S.result(), S.cur().project).score; const best = S.scenarios().best;
      S.setDesign({ n: best.design.n, depth: best.design.depth, spacing: best.design.spacing, flow: best.design.flow }); S.setMitigation({ rebalance: true });
      const after = E.benchmark(S.result(), S.cur().project).score; S.log(`Benchmark optimization applied (${best.name})`, 'Intelligence', 'Completed');
      U.toast(`Configuration optimized: score ${before.toFixed(1)} → <b>${after.toFixed(1)}</b>`);
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
      const rows = [];
      text.split(/\r?\n/).forEach(line => { const c = line.split(/[,;\t]/).map(x => x.trim()); if (c.length < 3) return; let m = c[0];
        if (/^\d{4}-\d{1,2}$/.test(m)) m = m.slice(0, 5) + m.slice(5).padStart(2, '0'); else if (/^\d{1,2}\/\d{4}$/.test(m)) { const [mm, yy] = m.split('/'); m = yy + '-' + mm.padStart(2, '0'); } else return;
        const th = parseFloat(c[1]), el = parseFloat(c[2]); if (!(th >= 0) || !(el > 0)) return; const lp = c[3] !== undefined && c[3] !== '' ? parseFloat(c[3]) : null;
        rows.push({ month: m, thermal: th, elec: el, loop: isFinite(lp) ? lp : null }); });
      return rows;
    },
    merge(newRows) { const map = {}; (S.cur().ops.rows || []).forEach(r => map[r.month] = r); newRows.forEach(r => map[r.month] = r); S.setOps(Object.values(map)); },
    template() { const ex = O.expected(); const y = new Date().getFullYear() - 1; return 'month,thermal_kwh,electricity_kwh,loop_temp_c\n' + MN.map((m, i) => `${y}-${String(i + 1).padStart(2, '0')},${Math.round(ex.thermal[i])},${Math.round(ex.thermal[i] / ex.cop[i])},`).join('\n'); },
    paint(el) {
      const host = U.$('#mon', el) || el; const rows = O.enrich(); const r = S.result();
      if (!rows.length) {
        host.innerHTML = `<div class="card empty-state" style="max-width:720px"><div class="es-ico">⇪</div><h2>Connect operating data</h2>
          <p class="muted">Upload monthly readings from the building's meters or BMS. GeoThermX compares the measured efficiency with what the design predicts for each month and flags deviations in Alerts.</p>
          <table class="ex-t" style="text-align:left;margin:6px 0 16px"><tr><td><b>month</b></td><td>YYYY-MM, e.g. 2026-09</td></tr><tr><td><b>thermal_kwh</b></td><td>Heat delivered + heat removed by the heat pumps</td></tr><tr><td><b>electricity_kwh</b></td><td>Electricity used by heat pumps and circulation pumps</td></tr><tr><td><b>loop_temp_c</b></td><td>Optional: average loop return temperature, °C</td></tr></table>
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
      U.modal({ title: 'Add monthly reading', body: `<div class="pair"><div class="field"><label for="om-m">Month</label><input class="input" id="om-m" type="month" value="${m}"></div><div class="field"><label for="om-l">Loop return temp (°C, optional)</label><input class="input" id="om-l" type="number" step="0.1"></div></div>
        <div class="pair"><div class="field"><label for="om-t">Thermal energy (kWh)</label><input class="input" id="om-t" type="number" min="0"></div><div class="field"><label for="om-e">Electricity (kWh)</label><input class="input" id="om-e" type="number" min="1"></div></div><div class="muted" style="font-size:12.5px" id="om-err"></div>`,
        actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Save reading', kind: 'accent', onClick: md => { const mo = U.$('#om-m', md).value, t = parseFloat(U.$('#om-t', md).value), e = parseFloat(U.$('#om-e', md).value), l = U.$('#om-l', md).value;
          if (!/^\d{4}-\d{2}$/.test(mo) || !(t >= 0) || !(e > 0)) { U.$('#om-err', md).textContent = 'Enter a month, thermal energy and electricity.'; return false; }
          O.merge([{ month: mo, thermal: t, elec: e, loop: l !== '' ? parseFloat(l) : null }]); S.log('Operating data added for ' + mo, 'System', 'Success'); U.toast('Reading saved'); } }] });
    },
    upload() { const f = document.createElement('input'); f.type = 'file'; f.accept = '.csv,text/csv'; f.onchange = () => { const file = f.files[0]; if (!file) return; const rd = new FileReader(); rd.onload = () => { const rows = O.parse(String(rd.result)); if (!rows.length) { U.toast('No valid rows. Columns: month (YYYY-MM), thermal_kwh, electricity_kwh, loop_temp_c', 'err'); return; } O.merge(rows); S.log(`Imported ${rows.length} months of operating data`, 'System', 'Success'); U.toast(`Imported <b>${rows.length}</b> month(s) of operating data`); }; rd.readAsText(file); }; f.click(); }
  };
  document.addEventListener('click', e => {
    if (e.target.closest('#op-up,#op-up2')) O.upload();
    if (e.target.closest('#op-add,#op-add2')) O.addModal();
    if (e.target.closest('#op-tpl,#op-tpl2')) U.exportData('Operating data template', 'geothermx-operating-data-template.csv', O.template(), 'text/csv');
    if (e.target.closest('#op-exp')) U.exportData('Operating data', `${S.cur().project.ref}-operating-data.csv`, U.csv([['month', 'thermal_kwh', 'electricity_kwh', 'loop_temp_c', 'measured_cop', 'expected_cop', 'deviation_pct']].concat(O.enrich().map(x => [x.month, x.thermal, x.elec, x.loop == null ? '' : x.loop, x.cop ? x.cop.toFixed(3) : '', x.ecop.toFixed(3), x.dev != null ? x.dev.toFixed(1) : '']))), 'text/csv');
    const d = e.target.closest('[data-op-del]'); if (d) { S.setOps((S.cur().ops.rows || []).filter(r => r.month !== d.dataset.opDel)); U.toast('Month removed'); }
  });
})();
