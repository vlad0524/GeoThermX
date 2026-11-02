/* GeoThermX alert engine: rule-based incidents derived from the live engineering model. */
(function () {
  'use strict';
  const S = window.GXStore, U = window.GXUI;

  function rules(r) {
    const c = S.cur(), d = c.design;
    const out = [];
    const variance = Math.round(r.imbalance * 42);
    if (r.imbalance > 0.18) out.push({
      id: 'thermal-imbalance', sev: 'critical', status: 'investigating', title: 'Thermal imbalance detected in borefield',
      desc: `Core boreholes showing ${variance}% delta-T variance from the design baseline.`, area: 'Borefield', code: '#TX-9042',
      detailTitle: 'Thermal imbalance in borefield',
      detail: `Subsurface sensors indicate that the heat flow in the core boreholes has exceeded the recovery capacity of the ${r.g.layer} by ${(r.imbalance * 34).toFixed(1)}% over the last 4 hours.`,
      impact: -(r.imbalance * 23).toFixed(1), risk: r.imbalance > 0.3 ? 'High' : 'Medium',
      cause: `Current issue is caused by uneven load distribution across the borefield. Annual heat rejection exceeds extraction by ${Math.round(r.imbalance * 100)}%, leading to localized thermal saturation in the ${r.g.layer}.`,
      actions: ['Balance flow between core and perimeter boreholes', 'Rebalance seasonal heating/cooling load', 'Raise loop return temperature setpoint +2°C', 'Monitor loop return temperature for 1 week'],
      fix: { mitigation: { rebalance: true } }
    });
    if (r.flow > 1.05) out.push({
      id: 'pump-cavitation', sev: 'critical', status: 'active', title: 'Primary Pump Cavitation Alarm',
      desc: `Pressure drop detected in Primary Circulation Unit A at ${d.flow.toFixed(2)} L/s per loop. Mechanical stress detected.`, area: 'Mechanical Room',
      detailTitle: 'Primary pump cavitation', detail: `Circulation at ${d.flow.toFixed(2)} L/s per borehole loop pushes pump power to ${r.pumpKw.toFixed(1)} kW and drops suction head below NPSH margin.`,
      impact: -(Math.min(9, (d.flow - 0.95) * 18)).toFixed(1), risk: 'High',
      cause: `Flow rate is ${Math.round((d.flow / 0.95 - 1) * 100)}% above the optimum turbulent range (0.9–1.0 L/s). Pump runs at high speed during off-peak hours with no variable-speed trim.`,
      actions: ['Reduce pump speed by 15% during off-peak', 'Set circulation to 0.95 L/s per loop', 'Inspect impeller and suction strainer', 'Verify expansion tank pre-charge'],
      fix: { design: { flow: 0.95 } }
    });
    const fl = r.fl;
    if (fl.freeze >= 0 || r.EWTh < 4) out.push({
      id: 'fluid-conc', sev: 'warning', status: 'active', title: 'Low Glycol Concentration Threshold',
      desc: `Secondary loop fluid density below optimal ${fl.density.toFixed(2)} g/cm³ for ${r.EWTh.toFixed(1)}°C entering water. Risk of reduced exchange.`, area: 'Secondary Loop',
      detailTitle: 'Freeze protection margin low', detail: `Minimum entering water temperature is ${r.EWTh.toFixed(1)}°C while the fluid freeze point is ${fl.freeze}°C.`,
      impact: -2.4, risk: 'Medium', cause: 'Heat transfer fluid has insufficient antifreeze for the design winter entering temperature.',
      actions: ['Top up to Propylene Glycol 25%', 'Verify refractometer reading', 'Purge air from loop header'], fix: { design: { fluid: 'Propylene Glycol 25%' } }
    });
    if (r.utilization > 0.97) out.push({
      id: 'capacity', sev: 'warning', status: 'active', title: 'Peak Capacity Margin Below 5%',
      desc: `Peak demand uses ${Math.round(r.utilization * 100)}% of ground-loop capacity (${Math.round(r.capacityC)} kW cooling).`, area: 'Ground Loop',
      detailTitle: 'Low capacity margin', detail: `Design cooling peak of ${c.design.coolPeak} kW is close to the ${Math.round(r.capacityC)} kW the borefield can reject.`,
      impact: -3.1, risk: 'Medium', cause: 'Total loop length is sized with less than 5% redundancy for the cooling-dominated load.',
      actions: ['Add 2 boreholes to the design', 'Enable demand limiting above 95% load', 'Re-run Simulation Lab with +10% load'], fix: { design: { n: c.design.n + 2 } }
    });
    if (r.drift > 0.2) out.push({
      id: 'drift', sev: 'warning', status: 'active', title: 'Ground Temperature Drift Rising',
      desc: `Long-term ground temperature rising ${r.drift.toFixed(2)}°C/year from net heat rejection.`, area: 'Borefield',
      detailTitle: 'Ground temperature drift', detail: `Model projects +${(r.drift * 10).toFixed(1)}°C after 10 years, reducing cooling COP over time.`,
      impact: -(r.drift * 9).toFixed(1), risk: 'Medium', cause: 'Cooling-dominated building rejects more heat than it extracts each year.',
      actions: ['Increase borehole spacing in the design', 'Add dry-cooler for peak rejection', 'Raise return flow temperature +2°C'], fix: { mitigation: { returnTemp: 2, rebalance: true } }
    });
    out.push({ id: 'filter', sev: 'warning', status: 'resolved', title: 'Filter Resistance Increase', desc: 'Maintenance cycle complete. Differential pressure returned to normal range.', area: 'Filtration Unit', detailTitle: 'Filter resistance increase', detail: 'Differential pressure across the primary strainer returned to 0.18 bar after cleaning.', impact: 0, risk: 'Low', cause: 'Scheduled strainer cleaning restored normal pressure drop.', actions: ['No action required'], fix: null, static: true });
    out.push({ id: 'ai-sync', sev: 'info', status: 'info', title: 'AI Pattern Sync Complete', desc: 'System patterns synchronized with Peak Load Model V2. Optimization applied.', area: 'AI Engine', areaLabel: 'System', detailTitle: 'AI pattern sync', detail: 'Load forecasting model retrained on the last 30 days of BMS data.', impact: 0, risk: 'Low', cause: 'Routine model update.', actions: ['No action required'], fix: null, static: true });
    out.push({ id: 'backup', sev: 'scheduled', status: 'scheduled', title: 'Backup Power Test Schedule', desc: 'Routine monthly backup generator load test scheduled for 15:00 today.', area: 'Site Power', detailTitle: 'Backup power test', detail: 'Generator transfer test will run for 20 minutes. Circulation pumps stay on UPS.', impact: 0, risk: 'Low', cause: 'Monthly preventive maintenance.', actions: ['Notify facility team', 'Confirm UPS charge > 90%'], fix: null, static: true });
    return out;
  }

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
        desc: `Loop return ${x.loop.toFixed(1)}°C is outside the expected ${GX.opsData.expected().ewth.toFixed(1)}–${GX.opsData.expected().ewtc.toFixed(1)}°C band.`, area: 'Ground loop', detailTitle: 'Loop temperature deviation', detail: 'Sustained loop temperatures outside the design band reduce efficiency and can indicate ground heat build-up or an undersized borefield.',
        impact: -3, risk: 'Medium', cause: 'Seasonal imbalance between heat rejected and extracted, higher loads than designed, or reduced flow.', actions: ['Compare loads with the design basis', 'Review the Risk Forecast for ground temperature drift', 'Consider load rebalancing or supplemental heat rejection'], fix: null });
      if (x.tdev > 25) out.push({ id: 'load-' + x.month, sev: 'warning', status: 'active', month: lab(x.month), title: `Load above design basis (${lab(x.month)})`,
        desc: `Thermal energy ${x.tdev.toFixed(0)}% above the design model for this month.`, area: 'Building', detailTitle: 'Higher load than designed', detail: 'Operating loads exceed what the borefield was sized for.', impact: -2, risk: 'Medium', cause: 'Occupancy or schedule changes, building additions, or design loads set too low.', actions: ['Update the building data in Project Setup', 'Re-run Simulation Lab with the new load', 'Check borefield capacity margin in System Design'], fix: null });
    });
    out.forEach(a => { const p = prev[a.id]; if (p && (p.status === 'resolved' || p.status === 'assigned')) a.status = p.status; if (p && p.done) a.done = p.done; a.time = a.month; });
    return out;
  }

  const TIMES = ['12:42:08', '12:38:15', '12:10:44', '11:58:20', '11:52:31', '11:55:02', '11:30:00', '11:15:00'];

  const A = {
    list() { const c = S.cur(); if (!c.alerts) A.sync(); return c.alerts; },
    sync() {
      const c = S.cur(); if (!c) return []; const r = S.result();
      if (!c.project.sample) { c.alerts = dataAlerts(c); S.persist(); return c.alerts; }
      const prev = {}; (c.alerts || []).forEach(a => { prev[a.id] = a; });
      const fresh = rules(r);
      const ids = new Set(fresh.map(a => a.id));
      const list = fresh.map((a, i) => {
        const p = prev[a.id];
        a.time = p && p.time ? p.time : TIMES[i % TIMES.length];
        if (p && (p.status === 'resolved' || p.status === 'assigned') && !a.static) a.status = p.status;
        if (p && p.done) a.done = p.done;
        return a;
      });
      // conditions that cleared become resolved history
      (c.alerts || []).forEach(p => { if (!ids.has(p.id) && !p.static) list.push(Object.assign({}, p, { status: 'resolved', sev: p.sev === 'critical' ? 'warning' : p.sev, autoResolved: true })); });
      c.alerts = list;
      S.persist();
      return list;
    },
    openCritical() { return ((S.cur() || {}).alerts || []).filter(a => a.sev === 'critical' && a.status !== 'resolved').length; },
    counts() {
      const l = A.list();
      const open = l.filter(a => a.status !== 'resolved' && a.sev !== 'info' && a.sev !== 'scheduled');
      return {
        critical: open.filter(a => a.sev === 'critical').length,
        warnings: open.filter(a => a.sev === 'warning').length,
        active: open.length,
        resolved: (S.cur().project.sample ? 10 : 0) + l.filter(a => a.status === 'resolved').length
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
