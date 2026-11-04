/* GeoThermX alert engine: deviations found in measured monthly operating data vs. the design model. */
(function () {
  'use strict';
  const S = window.GXStore, U = window.GXUI;

  function dataAlerts(c) {
    if (c.project.stage !== 'deployed' || !window.GX || !GX.opsData) return [];
    const rows = GX.opsData.enrich(); if (!rows.length) return [];
    const prev = {}; (c.alerts || []).forEach(a => prev[a.id] = a);
    const out = [];
    const lab = m => { const d = new Date(m + '-15T12:00:00'); return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); };
    rows.slice(-3).forEach(x => {
      if (x.dev != null && x.dev < -10) out.push({ id: 'cop-' + x.month, sev: x.dev < -20 ? 'critical' : 'warning', status: 'active', month: lab(x.month), title: `Measured COP below expected (${lab(x.month)})`,
        desc: `Measured COP ${x.cop.toFixed(2)} vs expected ${x.ecop.toFixed(2)} (${x.dev.toFixed(0)}%).`, area: 'Heat pump plant', detailTitle: 'Efficiency below design', detail: `In ${lab(x.month)} the system delivered ${Math.round(x.thermal).toLocaleString('en-US')} kWh of heating/cooling using ${Math.round(x.elec).toLocaleString('en-US')} kWh of electricity.`,
        impact: +x.dev.toFixed(1), risk: x.dev < -20 ? 'High' : 'Medium',
        cause: 'Typical causes: low or unbalanced loop flow, air in the loop, fouled heat exchangers or strainers, wrong supply setpoints, backup electric heat running, or meter errors.',
        actions: ['Check circulation pump speed and loop flow per circuit', 'Verify setpoints and that backup/auxiliary heat is not running', 'Inspect strainers and heat exchanger approach temperatures', 'Confirm meter readings for this month'], fix: null });
      if (x.loopBad) out.push({ id: 'loop-' + x.month, sev: 'warning', status: 'active', month: lab(x.month), title: `Loop temperature outside design range (${lab(x.month)})`,
        desc: `Loop return ${U.temp(x.loop)} is outside the expected ${U.temp(GX.opsData.expected().ewth)} – ${U.temp(GX.opsData.expected().ewtc)} band.`, area: 'Ground loop', detailTitle: 'Loop temperature deviation', detail: 'Sustained loop temperatures outside the design band reduce efficiency and can indicate ground heat build-up or an undersized borefield.',
        impact: -3, risk: 'Medium', cause: 'Seasonal imbalance between heat rejected and extracted, higher loads than designed, or reduced flow.', actions: ['Compare loads with the design basis', 'Review the Risk Forecast for ground temperature drift', 'Consider load rebalancing or supplemental heat rejection'], fix: null });
      if (x.tdev > 25) out.push({ id: 'load-' + x.month, sev: 'warning', status: 'active', month: lab(x.month), title: `Load above design basis (${lab(x.month)})`,
        desc: `Thermal energy ${x.tdev.toFixed(0)}% above the design model for this month.`, area: 'Building', detailTitle: 'Higher load than designed', detail: 'Operating loads exceed what the borefield was sized for.', impact: -2, risk: 'Medium', cause: 'Occupancy or schedule changes, building additions, or design loads set too low.', actions: ['Update the building data in Project Setup', 'Re-run Simulation Lab with the new load', 'Check borefield capacity margin in System Design'], fix: null });
    });
    out.forEach(a => { const p = prev[a.id]; if (p && (p.status === 'resolved' || p.status === 'assigned')) a.status = p.status; if (p && p.done) a.done = p.done; a.time = a.month; });
    return out;
  }


  const A = {
    list() { const c = S.cur(); if (!c.alerts) A.sync(); return c.alerts; },
    sync() {
      const c = S.cur(); if (!c) return []; const r = S.result();
      c.alerts = dataAlerts(c); S.persist(); return c.alerts;
    },
    openCritical() { return ((S.cur() || {}).alerts || []).filter(a => a.sev === 'critical' && a.status !== 'resolved').length; },
    counts() {
      const l = A.list();
      const open = l.filter(a => a.status !== 'resolved' && a.sev !== 'info' && a.sev !== 'scheduled');
      return {
        critical: open.filter(a => a.sev === 'critical').length,
        warnings: open.filter(a => a.sev === 'warning').length,
        active: open.length,
        resolved: l.filter(a => a.status === 'resolved').length
      };
    },
    setStatus(id, status) { const a = A.list().find(x => x.id === id); if (a) { a.status = status; S.persist(); } },
    applyFix(id) {
      const a = A.list().find(x => x.id === id); if (!a) return false;
      if (a.fix && a.fix.mitigation) S.setMitigation(a.fix.mitigation);
      if (a.fix && a.fix.design) S.setDesign(a.fix.design, 'fix');
      a.status = 'resolved'; a.done = a.actions.map((_, i) => i);
      S.log(`Recommended settings applied: ${a.title}`, 'Intelligence', 'Completed');
      A.sync();
      S.touch('alerts');
      return true;
    }
  };
  S.subscribe(reason => { if (reason !== 'alerts') A.sync(); });
  window.GXAlerts = A;
})();
