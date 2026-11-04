/* GeoThermX — Step 4: Costs & Incentives. Energy prices, installed cost rates and incentives for the current project.
   Defaults come from the project's state (EIA average prices) and sector; every value can be overridden per project. */
(function () {
  'use strict';
  const U = window.GXUI, S = window.GXStore, E = window.GXEngine, GX = window.GX;
  const esc = U.esc;
  // Price inputs are shown in the units US buyers use and stored as $/kWh
  const UNITS = {
    elec:    { label: 'Electricity', unit: '$/kWh', k: 1, step: 0.005 },
    gas:     { label: 'Natural gas', unit: '$/therm', k: 29.307, step: 0.05 },
    propane: { label: 'Propane', unit: '$/gal', k: 26.8, step: 0.05 },
    oil:     { label: 'Heating oil', unit: '$/gal', k: 40.6, step: 0.05 }
  };
  const fmt = (v, st) => (+v).toFixed(st < 0.01 ? 3 : 2);

  // Fuel quantity in the units on a US bill (gal / therms) or MWh in metric mode
  function fuelQty(bl) {
    const u = UNITS[bl.fuel];
    if (U.imp() && u && bl.fuel !== 'elec') return `${U.n(bl.heatFuelKwh / u.k, 0)} ${u.unit.slice(2)} × $${(bl.price * u.k).toFixed(2)}/${u.unit.slice(2)}`;
    return `${U.n(bl.heatFuelKwh / 1000, 1)} MWh × $${bl.price.toFixed(3)}/kWh`;
  }
  GX.views.costs = {
    name: 'Costs & Incentives', header: { mode: 'step', step: 4, label: 'Costs & Incentives' },
    render(el) {
      S.mark('costs');
      const c = S.cur(), p = c.project, def = E.econDefaults(p), ec = E.econ(p), st = S.state.settings, r = S.result();
      const L = E.location(p.locationId, p), sec = E.SECTOR[E.sectorOf(p)], fuel = r.baseline.fuel;
      const over = k => p.econ && p.econ[k] != null && p.econ[k] !== '';
      const field = (id, label, val, step, unit, hint, key) => `<div class="field cx-f ${over(key) ? 'over' : ''}"><label for="${id}">${label} <span class="muted" style="font-weight:400">${unit}</span></label>
        <input class="input num cx-in" id="${id}" data-key2="${key}" type="number" step="${step}" min="0" value="${val}" data-edit><div class="fhint">${hint}</div></div>`;
      const price = k => { const u = UNITS[k]; return field('cx-' + k, u.label + (fuel === k || (k === 'elec') ? ' <b class="cx-used">used</b>' : ''), fmt(ec[k] * u.k, u.step), u.step, u.unit,
        k === 'elec' || k === 'gas' ? `${L.code} ${sec.label.toLowerCase()} avg: ${fmt(def[k] * u.k, u.step)}` : `US average: ${fmt(def[k] * u.k, u.step)}`, k); };
      el.innerHTML = `<div class="cx-grid">
        <div class="cx-in-col">
          <div class="card pad form-card"><div class="sec-t"><span>Energy prices</span><button class="link-btn" id="cx-reset" data-edit>Reset to defaults</button></div>
            <p class="muted cx-p">Starting values are average retail prices for <b>${esc(L.state)}</b> (EIA, approx. 2024, ${sec.label.toLowerCase()} rates). Enter the tariff from the client's utility bill for a precise result.</p>
            <div class="pair">${price('elec')}${price('gas')}</div><div class="pair">${price('propane')}${price('oil')}</div>
            <div class="pair">${field('cx-esc', 'Price escalation', (st.escalation * 100).toFixed(1), 0.1, '%/yr', 'Yearly energy price growth', 'g:escalation')}${field('cx-disc', 'Discount rate', (st.discount * 100).toFixed(1), 0.1, '%', 'Used for NPV', 'g:discount')}</div>
          </div>
          <div class="card pad form-card"><div class="sec-t"><span>Installed cost ${GX.info('capex')}</span></div>
            <div class="pair">${field('cx-drillMult', 'Drilling cost multiplier', ec.drillMult, 0.05, '×', `Base rate for ${esc(p.ground)}: ${U.perLen(E.GROUND[p.ground].drill, U.imp() ? 1 : 0)} incl. loop &amp; grout`, 'drillMult')}${field('cx-equipRate', 'Heat pumps &amp; installation', Math.round(U.perPowV(ec.equipRate)), U.imp() ? 50 : 10, U.perPowU(), `${sec.label} default: ${U.perPow(def.equipRate)}`, 'equipRate')}</div>
            <div class="pair">${field('cx-avoidedPerKw', 'Avoided baseline equipment', Math.round(U.perPowV(ec.avoidedPerKw)), U.imp() ? 50 : 10, U.perPowU(), E.PROJECT_TYPES[r.projectType].avoided ? 'Credited: ' + esc(E.PROJECT_TYPES[r.projectType].short.toLowerCase()) : 'Not credited for an early retrofit', 'avoidedPerKw')}${field('cx-maintPerKw', 'Maintenance savings', +U.perPowV(ec.maintPerKw).toFixed(0), 1, U.perPowU() + '·yr', 'vs. conventional HVAC', 'maintPerKw')}</div>
          </div>
          <div class="card pad form-card"><div class="sec-t"><span>Incentives</span></div>
            <div class="cx-note">${esc(sec.itcNote)}</div>
            <div class="pair">${field('cx-itc', 'Federal tax credit', Math.round(ec.itc * 100), 1, '% of CAPEX', `${sec.label} default: ${Math.round(def.itc * 100)}%`, 'itc')}${field('cx-grant', 'State incentive', Math.round(ec.grant), 500, '$', 'Grant or rebate from a state program', 'grant')}</div>
            <div class="pair">${field('cx-utilityRebate', 'Utility rebate', Math.round(ec.utilityRebate), 250, '$', 'From the local electric utility', 'utilityRebate')}
              <div class="field"><label>Carbon credits</label><div class="between" style="height:42px"><span class="muted" style="font-size:12.5px">$${st.carbonPrice}/t CO₂ (voluntary market)</span><button class="toggle ${st.includeCarbon ? 'on' : ''}" id="cx-carbon" aria-label="Include carbon credits" data-edit></button></div></div></div>
            <a class="link-btn" href="https://www.dsireusa.org/" target="_blank" rel="noopener">Find state &amp; utility programs for ${esc(L.state)} (DSIRE) ↗</a>
          </div>
        </div>
        <div class="cx-out" id="cx-out"></div>
      </div>`;
      let tm;
      el.querySelectorAll('.cx-in').forEach(inp => {
        const commit = () => {
          clearTimeout(tm);
          if (!inp.isConnected || !GX.guard()) return;
          const key = inp.dataset.key2, raw = parseFloat(inp.value);
          if (!isFinite(raw) || raw < 0) { inp.classList.add('invalid'); return; }
          inp.classList.remove('invalid');
          if (key.startsWith('g:')) { const g = key.slice(2); S.setSettings({ [g]: U.clamp(raw / 100, g === 'escalation' ? -0.05 : 0, g === 'escalation' ? 0.15 : 0.3) }); return; }
          let v = raw;
          if (UNITS[key]) v = raw / UNITS[key].k;
          if (key === 'itc') v = U.clamp(raw / 100, 0, 0.7);
          if (key === 'equipRate' || key === 'avoidedPerKw' || key === 'maintPerKw') v = U.perPowIn(raw);   // $/ton → $/kW in imperial mode
          S.setEcon({ [key]: +v.toFixed(5) });
          inp.closest('.cx-f').classList.add('over');
          S.log(`Costs: ${key} set to ${inp.value}`, 'Config', 'Modified');
        };
        inp.addEventListener('change', commit);
        inp.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(commit, 600); });
      });
      U.$('#cx-reset', el).onclick = () => { if (!GX.guard()) return; S.setProject({ econ: {} }); S.log('Costs reset to state / sector defaults', 'Config'); U.toast('Prices and incentives reset to defaults'); this.render(el); U.animateNumbers(el, {}); };
      U.$('#cx-carbon', el).onclick = () => { if (!GX.guard()) return; S.setSettings({ includeCarbon: !S.state.settings.includeCarbon }); this.render(el); };
      this.paint(el);
    },
    paint(el) {
      const out = U.$('#cx-out', el); if (!out) return;
      const r = S.result(), s = r.inputs.s, bl = r.baseline;
      const peak = Math.max(r.inputs.d.heatPeak, r.inputs.d.coolPeak);
      const row = (l, v, cls, sub) => `<div class="between cx-r ${cls || ''}"><span>${l}${sub ? `<em>${sub}</em>` : ''}</span><b>${v}</b></div>`;
      const pieces = [['Drilling & loop', r.drilling, '#0f766e'], ['Heat pumps', r.equipment, '#14b8a6'], ['Integration', r.integration, '#99f6e4']];
      const off = [['Incentives', r.incentives, '#22c55e'], ['Avoided equipment', r.avoided, '#86efac']].filter(x => x[1] > 0);
      const bar = arr => arr.map(x => `<i style="flex:${Math.max(0.001, x[1])};background:${x[2]}" data-tip="${x[0]}: ${U.money(x[1])}"></i>`).join('');
      const simple = r.annualSavings > 0 ? r.netCapex / r.annualSavings : Infinity;
      const maxC = Math.max(r.baselineCost, r.gshpCost, 1);
      out.innerHTML = `
        <div class="card pad"><h3 class="card-title">Investment</h3>
          <div class="cx-bar">${bar(pieces)}</div>
          ${row('Drilling &amp; ground loop', U.money(r.drilling), '', `${r.n} × ${U.len(r.depth)} · ${U.perLen(r.drillPerM, U.imp() ? 1 : 0)}`)}
          ${row('Heat pumps &amp; installation', U.money(r.equipment), '', `${U.pow(peak, 1)} × ${U.perPow(s.equipRate * (s.equipMult || 1))}`)}
          ${row('Integration &amp; field preparation', U.money(r.integration))}
          ${row('Total installed cost (CAPEX)', U.count(r.capex, 'money', 'cx-cap'), 'tot')}
          ${off.length ? `<div class="cx-bar off">${bar(off)}<i style="flex:${Math.max(0.001, r.netCapex)};background:#e2e8f0" data-tip="Net investment: ${U.money(r.netCapex)}"></i></div>` : ''}
          ${row(`Federal tax credit (${Math.round(s.itc * 100)}%)`, s.includeItc && r.itc > 0 ? '−' + U.money(r.itc) : '—', 'green')}
          ${row('State incentive', r.grant > 0 ? '−' + U.money(r.grant) : '—', 'green')}
          ${row('Utility rebate', r.rebate > 0 ? '−' + U.money(r.rebate) : '—', 'green')}
          ${r.carbonCredit > 0 ? row('Carbon credits (1st year)', '−' + U.money(r.carbonCredit), 'green') : ''}
          ${row('Avoided equipment (' + esc(bl.short) + ')', r.avoided > 0 ? '−' + U.money(r.avoided) : '—', 'green', r.avoided > 0 ? E.PROJECT_TYPES[r.projectType].short : 'early retrofit: not credited')}
          ${row('Net investment', U.count(r.netCapex, 'money', 'cx-net'), 'tot big')}
        </div>
        <div class="card pad"><h3 class="card-title">Annual operating cost</h3>
          <div class="cx-cmp">
            <div><span>Current: ${esc(bl.short)}</span><div class="cx-track"><i style="width:${r.baselineCost / maxC * 100}%;background:#94a3b8"></i></div><b>${U.money(r.baselineCost)}</b></div>
            <div><span>Geothermal heat pump</span><div class="cx-track"><i style="width:${r.gshpCost / maxC * 100}%;background:#14b8a6"></i></div><b>${U.money(r.gshpCost)}</b></div>
          </div>
          ${row('Heating (' + (bl.fuel === 'elec' ? 'electricity' : bl.fuel === 'oil' ? 'heating oil' : bl.fuel === 'gas' ? 'natural gas' : bl.fuel) + ')', U.money(bl.heatCost), '', fuelQty(bl))}
          ${row('Cooling (electricity)', U.money(bl.coolCost), '', `${U.n(bl.coolElecKwh / 1000, 1)} MWh × $${s.elec.toFixed(3)}/kWh`)}
          ${row('Geothermal electricity', U.money(r.gshpCost), '', `${U.n(r.gshpElec / 1000, 1)} MWh · seasonal COP ${r.SCOP.toFixed(2)}`)}
          ${row('Maintenance savings', '+' + U.money(r.maintSave))}
          ${row('Annual savings (year 1)', U.count(r.annualSavings, 'money', 'cx-sav'), 'tot big ' + (r.annualSavings > 0 ? 'green' : 'red'))}
          <div class="cx-pb ${simple < 25 ? '' : 'bad'}">${simple < 25 ? `Simple payback ≈ <b>${simple.toFixed(1)} years</b> · with price escalation and degradation: <b>${r.paybackYears >= 25 ? 'over 25' : r.paybackYears.toFixed(1)} years</b>` : `At these prices the geothermal system does not pay back against the current ${esc(bl.short.toLowerCase())}. Check the tariff, incentives or the baseline system.`}</div>
        </div>`;
    },
    foot: () => `<button class="btn btn-ghost" data-go="system-design">← Ground Loop</button><span class="spacer"></span><span class="note">All changes saved automatically</span><button class="btn btn-primary" data-go="financial-analysis">Continue to Payback →</button>`
  };
})();
