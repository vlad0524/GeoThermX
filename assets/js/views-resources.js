/* GeoThermX resources: US payback map (all states), methodology & data sources, feedback / pilot form.
   These pages also work without a project (public layout). */
(function () {
  'use strict';
  const U = window.GXUI, S = window.GXStore, E = window.GXEngine, GX = window.GX;
  const esc = U.esc;

  /* ================= US PAYBACK MAP ================= */
  // Tile-grid layout (col,row) — every state the same size, so small Northeast states stay readable
  const GRID = { AK: [1, 1], ME: [12, 1], WI: [7, 2], VT: [11, 2], NH: [12, 2], WA: [2, 3], ID: [3, 3], MT: [4, 3], ND: [5, 3], MN: [6, 3], IL: [7, 3], MI: [8, 3], NY: [10, 3], MA: [11, 3],
    OR: [2, 4], NV: [3, 4], WY: [4, 4], SD: [5, 4], IA: [6, 4], IN: [7, 4], OH: [8, 4], PA: [9, 4], NJ: [10, 4], CT: [11, 4], RI: [12, 4],
    CA: [2, 5], UT: [3, 5], CO: [4, 5], NE: [5, 5], MO: [6, 5], KY: [7, 5], WV: [8, 5], VA: [9, 5], MD: [10, 5], DE: [11, 5],
    AZ: [3, 6], NM: [4, 6], KS: [5, 6], AR: [6, 6], TN: [7, 6], NC: [8, 6], SC: [9, 6], DC: [10, 6],
    OK: [5, 7], LA: [6, 7], MS: [7, 7], AL: [8, 7], GA: [9, 7], HI: [2, 8], TX: [5, 8], FL: [10, 8] };
  const KINDS = {
    home:   { label: 'Home', sub: 'single-family', p: { buildingType: 'Single-Family Residential', floorArea: 230, floors: 2, hours: 'Continuous (24/7)', vintage: '2005–2015 (modern code)', glazing: 'Medium (25–40%)', siteArea: 1500, depthLimit: 180, projectType: 'replace' } },
    office: { label: 'Office', sub: 'mid-size', p: { buildingType: 'Commercial Office (Class A)', floorArea: 5000, floors: 4, hours: 'Extended (14 h × 6 d)', vintage: '2005–2015 (modern code)', glazing: 'Medium (25–40%)', siteArea: 6000, depthLimit: 250, projectType: 'replace' } },
    school: { label: 'School', sub: 'new build', p: { buildingType: 'Education / Campus', floorArea: 6500, floors: 2, hours: 'Standard (10 h × 5 d)', vintage: '2016+ (high performance)', glazing: 'Medium (25–40%)', siteArea: 12000, depthLimit: 200, projectType: 'new' } }
  };
  const METRICS = {
    pb:  { label: 'Payback', fmt: v => v >= 25 ? '25+ yrs' : v.toFixed(1) + ' yrs', better: 'low' },
    sav: { label: 'Annual savings', fmt: v => U.moneyK(v), better: 'high' },
    net: { label: 'Net investment', fmt: v => U.moneyK(v), better: 'low' },
    co2: { label: 'CO₂ avoided', fmt: v => U.n(v, v < 10 ? 1 : 0) + ' t/yr', better: 'high' }
  };
  const memo = new Map();
  function calc(code, kind, baseline) {
    const key = [code, kind, baseline, S.state.settings.escalation, S.state.settings.discount].join('|');
    if (memo.has(key)) return memo.get(key);
    const L = E.location('st-' + code);
    const p = Object.assign({ locationId: L.id, city: L.city, zone: L.zone, ground: L.ground, baseline, loadMode: 'calculated', fidelity: 'Regional estimate', econ: {} }, KINDS[kind].p);
    p.sector = E.sectorOf(p);
    const lc = E.loadCalc(p); p.heatDemand = lc.heat; p.coolDemand = lc.cool; p.peakLoad = lc.peak;
    const d = E.recommend(p, {}).design;
    const r = E.compute(p, d, S.state.settings);
    const o = { code, state: L.state, city: L.city, pb: Math.min(25, r.paybackYears), sav: r.annualSavings, net: r.netCapex, capex: r.capex, co2: Math.max(0, r.co2Saved),
      elec: r.inputs.s.elec, fuel: r.baseline.fuel, fuelPrice: r.baseline.price, base: r.baselineCost, gshp: r.gshpCost, n: d.n, depth: d.depth, scop: r.SCOP, k: r.g.k, ground: p.ground, zone: r.c.label, inc: r.incentives, avoided: r.avoided };
    memo.set(key, o); return o;
  }
  const PB_SCALE = [[8, '#0f766e', '≤ 8 yrs'], [12, '#14b8a6', '8–12'], [16, '#5eead4', '12–16'], [20, '#fcd34d', '16–20'], [24.99, '#fb923c', '20–25'], [99, '#e2e8f0', 'over 25']];
  function color(metric, v, all) {
    if (metric === 'pb') return PB_SCALE.find(x => v <= x[0])[1];
    const vals = all.map(x => x[metric]).sort((a, b) => a - b), lo = vals[0], hi = vals[vals.length - 1];
    let t = hi > lo ? (v - lo) / (hi - lo) : 0.5; if (METRICS[metric].better === 'low') t = 1 - t;
    const stops = ['#f1f5f9', '#ccfbf1', '#5eead4', '#14b8a6', '#0f766e'];
    return stops[Math.min(4, Math.max(0, Math.round(t * 4)))];
  }

  GX.views['us-map'] = {
    name: 'US Payback Map', header: { mode: 'title', title: 'Where geothermal pays off in the US' },
    state: { kind: 'home', base: 'propane-ac', metric: 'pb', sel: null, first: true },
    render(el) {
      GX.track('us-map-opened');
      const st = this.state;
      el.innerHTML = `<div class="rs-map">
        <div class="rs-hero">
          <div><div class="rs-kick">All 50 states + DC · live model</div><h2>Where does a geothermal heat pump pay off?</h2>
            <p class="muted">The same engine that runs your projects calculates a typical building in every state, using each state's energy prices, climate and ground. Pick a building and the system it replaces.</p></div>
          <div class="rs-ctl">
            <div class="rs-seg" role="group" aria-label="Building">${Object.entries(KINDS).map(([k, v]) => `<button data-kind="${k}" class="${st.kind === k ? 'on' : ''}">${v.label}<em>${v.sub}</em></button>`).join('')}</div>
            <div class="rs-row"><label for="rs-base">Replacing</label><select class="select" id="rs-base">${Object.entries(E.BASELINES).map(([k, b]) => `<option value="${k}" ${k === st.base ? 'selected' : ''}>${b.label}</option>`).join('')}</select></div>
            <div class="rs-seg sm" role="group" aria-label="Metric">${Object.entries(METRICS).map(([k, v]) => `<button data-metric="${k}" class="${st.metric === k ? 'on' : ''}">${v.label}</button>`).join('')}</div>
          </div>
        </div>
        <div class="rs-body">
          <div class="card rs-mapcard"><div class="rs-sum" id="rs-sum"></div><div class="rs-grid" id="rs-grid"></div><div class="rs-legend" id="rs-legend"></div></div>
          <div class="rs-side"><div class="card pad rs-detail" id="rs-detail"></div><div class="card pad"><h3 class="card-title" id="rs-top-t">Best 10 states</h3><div class="rs-top" id="rs-top"></div></div></div>
        </div>
        <p class="muted rs-note">Typical buildings: home ${U.area(230)}, office ${U.area(5000)}, school ${U.area(6500)}. Average state energy prices (EIA, approx. 2024), sector incentives, regional ground. Your project can differ — open a project for a site-specific result. <a href="#methodology">Methodology</a></p>
      </div>`;
      el.querySelectorAll('[data-kind]').forEach(b => b.onclick = () => { st.kind = b.dataset.kind; this.render(el); U.bindTips(el); });
      el.querySelectorAll('[data-metric]').forEach(b => b.onclick = () => { st.metric = b.dataset.metric; el.querySelectorAll('[data-metric]').forEach(x => x.classList.toggle('on', x === b)); this.paint(el); U.bindTips(el); });
      U.$('#rs-base', el).onchange = e => { st.base = e.target.value; this.paint(el); U.bindTips(el); };
      this.paint(el);
    },
    paint(el) {
      const st = this.state, grid = U.$('#rs-grid', el); if (!grid) return;
      const all = Object.keys(GRID).map(code => calc(code, st.kind, st.base));
      const M = METRICS[st.metric];
      const first = st.first; st.first = false;
      grid.innerHTML = all.map(o => { const [c, r] = GRID[o.code]; const col = color(st.metric, o[st.metric], all); const dark = ['#0f766e', '#14b8a6'].includes(col);
        return `<button class="rs-t ${dark ? 'dk' : ''} ${st.sel === o.code ? 'sel' : ''} ${first ? 'in' : ''}" style="grid-column:${c};grid-row:${r};--bg:${col};--d:${(c + r) * 28}ms" data-st="${o.code}"
          data-tip="<b>${esc(o.state)}</b><br>${M.label}: <b>${M.fmt(o[st.metric])}</b><br>Payback ${METRICS.pb.fmt(o.pb)} · saves ${U.moneyK(o.sav)}/yr"><b>${o.code}</b><span>${st.metric === 'pb' ? (o.pb >= 25 ? '25+' : o.pb.toFixed(0)) : st.metric === 'co2' ? U.n(o.co2, 0) : U.moneyK(o[st.metric]).replace('$', '')}</span></button>`; }).join('');
      const good = all.filter(o => o.pb <= 12).length, ok = all.filter(o => o.pb < 25).length;
      const best = all.slice().sort((a, b) => a.pb - b.pb)[0];
      U.$('#rs-sum', el).innerHTML = `<div><b class="num">${U.count(good, 'n0', 'rs-g')}</b><span>states pay back within 12 years</span></div><div><b class="num">${U.count(ok, 'n0', 'rs-o')}</b><span>within 25 years</span></div><div><b>${esc(best.state)}</b><span>fastest · ${METRICS.pb.fmt(best.pb)}</span></div>`;
      U.$('#rs-legend', el).innerHTML = st.metric === 'pb' ? PB_SCALE.map(x => `<span><i style="background:${x[1]}"></i>${x[2]}</span>`).join('') : `<span><i style="background:#f1f5f9"></i>${M.better === 'low' ? 'higher' : 'lower'}</span><span class="rs-grad"></span><span><i style="background:#0f766e"></i>${M.better === 'low' ? 'lower (better)' : 'higher (better)'}</span>`;
      const ranked = all.slice().sort((a, b) => M.better === 'low' ? a[st.metric] - b[st.metric] : b[st.metric] - a[st.metric]).slice(0, 10);
      const mx = Math.max(...ranked.map(o => Math.abs(o[st.metric]))) || 1;
      U.$('#rs-top-t', el).textContent = 'Best 10 states · ' + M.label.toLowerCase();
      U.$('#rs-top', el).innerHTML = ranked.map((o, i) => `<button class="rs-bar" data-st="${o.code}" style="--w:${Math.max(4, Math.abs(o[st.metric]) / mx * 100)}%;--d:${i * 50}ms"><span>${i + 1}. ${esc(o.state)}</span><i></i><b>${M.fmt(o[st.metric])}</b></button>`).join('');
      this.detail(el, st.sel ? calc(st.sel, st.kind, st.base) : best, !st.sel);
      el.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { st.sel = b.dataset.st; el.querySelectorAll('.rs-t').forEach(t => t.classList.toggle('sel', t.dataset.st === st.sel)); this.detail(el, calc(st.sel, st.kind, st.base), false); U.animateNumbers(el, {}); });
    },
    detail(el, o, isBest) {
      const st = this.state, fuelU = { gas: ['natural gas', 29.307, 'therm'], propane: ['propane', 26.8, 'gal'], oil: ['heating oil', 40.6, 'gal'] }[o.fuel];
      U.$('#rs-detail', el).innerHTML = `<div class="rs-dh"><div><span class="rs-kick">${isBest ? 'Fastest payback' : 'Selected state'}</span><h3>${esc(o.state)}</h3><span class="muted">${esc(KINDS[st.kind].label)} · replacing ${esc(E.BASELINES[st.base].short)}</span></div><div class="rs-pb ${o.pb < 25 ? '' : 'bad'}"><b>${o.pb >= 25 ? '25+' : U.count(o.pb, 'n1', 'rs-pb')}</b><span>years</span></div></div>
        <div class="rs-kv">
          <div><span>Annual savings</span><b class="${o.sav > 0 ? 'green' : 'red'}">${U.count(o.sav, 'money', 'rs-sav')}</b></div>
          <div><span>Net investment</span><b>${U.count(o.net, 'money', 'rs-net')}</b></div>
          <div><span>Energy cost now → geo</span><b>${U.moneyK(o.base)} → ${U.moneyK(o.gshp)}</b></div>
          <div><span>CO₂ avoided</span><b>${U.n(o.co2, 1)} t/yr</b></div>
          <div><span>Electricity</span><b>$${o.elec.toFixed(3)}/kWh</b></div>
          <div><span>${fuelU ? fuelU[0][0].toUpperCase() + fuelU[0].slice(1) : 'Heating'}</span><b>${fuelU ? '$' + (o.fuelPrice * fuelU[1]).toFixed(2) + '/' + fuelU[2] : 'electric'}</b></div>
          <div><span>Ground loop</span><b>${o.n} × ${U.len(o.depth)}</b></div>
          <div><span>Seasonal COP</span><b>${o.scop.toFixed(2)}</b></div>
        </div>
        <div class="muted" style="font-size:12px;margin:10px 0 14px">${esc(o.zone)} · ${esc(o.ground)} (k ${U.cond(o.k)})${o.inc > 0 ? ' · incentives ' + U.moneyK(o.inc) : ''}${o.avoided > 0 ? ' · avoided equipment ' + U.moneyK(o.avoided) : ''}</div>
        <button class="btn btn-primary btn-block" id="rs-start">Start a project in ${esc(o.state)} →</button>`;
      U.$('#rs-start', el).onclick = () => { GX.track('map-start-project', o.code); GX.newProject(Object.assign({ locationId: 'st-' + o.code, baseline: st.base, name: `${KINDS[st.kind].label} — ${o.state}` }, KINDS[st.kind].p)); };
    }
  };

  /* ================= METHODOLOGY & DATA SOURCES ================= */
  GX.views.methodology = {
    name: 'Methodology & Data', header: { mode: 'title', title: 'Methodology & data sources' },
    render(el) {
      GX.track('methodology-opened');
      const flow = [['Site', 'State, city, ground type, climate zone'], ['Loads', 'Degree-day & design-day heating / cooling'], ['Ground loop', 'Loop length, COP, 25-yr ground temperature'], ['Costs', 'Drilling, heat pumps, incentives, avoided equipment'], ['Payback', 'Savings vs. current system, NPV, IRR']];
      const src = [
        ['Electricity & natural gas prices', 'U.S. Energy Information Administration (EIA) — state average retail prices by sector, approx. 2024', 'Starting values; enter the client\'s tariff for a site-specific result'],
        ['Propane & heating oil prices', 'EIA residential heating fuel averages (US), approx. 2024', 'Editable per project'],
        ['Climate (HDD, CDD, design temperatures)', 'IECC / ASHRAE climate zones, representative values per zone', 'One representative city per state'],
        ['Ground thermal conductivity', 'Typical ranges by soil / rock type (ASHRAE, IGSHPA design guidance)', 'Replace with a thermal response test (TRT) value when available'],
        ['Grid CO₂ intensity', 'State-level averages, approximate (EPA eGRID-based)', 'Fuel factors: gas 0.181, propane 0.215, oil 0.267 kg CO₂/kWh'],
        ['Federal incentives', 'IRC §48 investment tax credit for geothermal heat pumps (commercial); §25D residential credit ended for expenditures after Dec 31, 2025', 'Verify eligibility and rate with a tax advisor'],
        ['State & utility incentives', 'Not built in — amounts vary by program; look up in DSIRE (dsireusa.org)', 'Entered per project'],
        ['Installed costs', 'Typical US ranges: drilling incl. loop & grout ≈ $15–27/ft by ground type; heat pumps per ton by sector', 'Editable per project; regional multiplier']
      ];
      el.innerHTML = `<div class="rs-meth">
        <div class="rs-hero"><div><div class="rs-kick">Transparent by design</div><h2>How GeoThermX calculates</h2>
          <p class="muted">Preliminary feasibility for ground-source heat pump systems in the US. Every number in the platform comes from the steps below — no hidden inputs and no invented data.</p></div></div>
        <div class="rs-flow">${flow.map((f, i) => `<div class="rs-fs" style="--d:${i * 120}ms"><span>${i + 1}</span><b>${f[0]}</b><em>${f[1]}</em></div>`).join('<i class="rs-arrow" aria-hidden="true"></i>')}</div>
        <div class="rs-cols">
          <div class="card pad"><h3 class="card-title">Core formulas</h3>
            <div class="rs-f"><b>Building loads</b><div class="formula">Q<sub>heat</sub> = UA × HDD × 24 · Q<sub>peak</sub> = UA × (T<sub>indoor</sub> − T<sub>design</sub>)</div><p>UA from envelope vintage, ventilation and floor area; internal gains and solar reduce heating and add cooling.</p></div>
            <div class="rs-f"><b>Ground loop length</b><div class="formula">L = Q<sub>peak</sub> × (1 ∓ 1/COP) ÷ q′, &nbsp; q′ = 20 × k × f<sub>spacing</sub></div><p>The larger of the heating and cooling requirement governs. Checked against the ${U.loopRange()} rule of thumb.</p></div>
            <div class="rs-f"><b>Heat pump efficiency</b><div class="formula">COP<sub>h</sub> = f(EWT<sub>h</sub>) · COP<sub>c</sub> = f(EWT<sub>c</sub>) · EWT shifts with loop size and long-term ground drift</div><p>Seasonal COP is weighted by annual heating and cooling energy.</p></div>
            <div class="rs-f"><b>Current system (baseline)</b><div class="formula">Cost<sub>base</sub> = Q<sub>heat</sub> ÷ η × fuel price + Q<sub>cool</sub> ÷ COP<sub>AC</sub> × electricity price</div><p>Air-source heat pump efficiency falls with colder climates (HDD).</p></div>
            <div class="rs-f"><b>Economics</b><div class="formula">Net investment = CAPEX − incentives − avoided equipment<br>Payback: first year cumulative savings ≥ net investment (escalation, degradation)</div><p>NPV and IRR over 20 years; payback beyond 25 years is reported as “over 25”.</p></div>
          </div>
          <div class="rs-col2">
            <div class="card pad"><h3 class="card-title">Data sources</h3><div class="rs-src">${src.map(s => `<div><b>${s[0]}</b><span>${s[1]}</span><em>${s[2]}</em></div>`).join('')}</div></div>
            <div class="card pad"><h3 class="card-title">Intended use &amp; limits</h3><ul class="rs-ul">
              <li><b>Use it for:</b> early feasibility, comparing options, client conversations, deciding whether a detailed design is worth paying for.</li>
              <li><b>Not a substitute for:</b> a licensed engineer's design, a thermal response test, or permit drawings.</li>
              <li>Loop sizing uses a simplified specific-heat-extraction method, not full g-function simulation.</li>
              <li>Prices and incentives change; defaults are averages and should be replaced with real tariffs.</li>
              <li>Validation against completed projects by a licensed geothermal engineer is planned.</li></ul>
              <div class="rs-ver"><span>Model version 2.2</span><span>Price data: approx. 2024 averages</span></div></div>
          </div>
        </div></div>`;
    }
  };

  /* ================= FEEDBACK & PILOT ================= */
  const ROLES = ['Drilling contractor', 'HVAC / geothermal installer', 'Mechanical engineer / designer', 'Developer / builder', 'Building owner / facility manager', 'Utility / public agency', 'Researcher / student', 'Other'];
  GX.views.feedback = {
    name: 'Feedback & Pilot', header: { mode: 'title', title: 'Feedback & pilot program' },
    render(el) {
      const mode = GX.formMode(), stats = GX.publicStatsUrl(), c = S.cur();
      el.innerHTML = `<div class="rs-fb">
        <div class="rs-hero"><div><div class="rs-kick">Help shape GeoThermX</div><h2>Join the pilot or send feedback</h2>
          <p class="muted">We are looking for drilling contractors, installers, engineers and developers who want faster feasibility studies for their clients. Pilot users get early access and direct input on the roadmap.</p></div></div>
        <div class="rs-cols">
          <form class="card pad rs-form" id="fb-form" novalidate>
            <div class="pair"><div class="field"><label for="fb-name">Name</label><input class="input" id="fb-name" autocomplete="name" required></div><div class="field"><label for="fb-email">Work email</label><input class="input" id="fb-email" type="email" autocomplete="email" required></div></div>
            <div class="pair"><div class="field"><label for="fb-co">Company</label><input class="input" id="fb-co" autocomplete="organization"></div><div class="field"><label for="fb-st">State</label><select class="select" id="fb-st"><option value="">—</option>${E.LOCATIONS.slice().sort((a, b) => a.state.localeCompare(b.state)).map(l => `<option ${c && c.project.locationId === l.id ? 'selected' : ''}>${l.state}</option>`).join('')}</select></div></div>
            <div class="field"><label for="fb-role">I am a…</label><select class="select" id="fb-role">${ROLES.map(r => `<option>${r}</option>`).join('')}</select></div>
            <div class="field"><label>I'm interested in</label><div class="rs-chips">${['Pilot access', 'Feedback', 'Partnership', 'Data / API'].map((x, i) => `<label class="rs-chip"><input type="checkbox" name="fb-int" value="${x}" ${i === 0 ? 'checked' : ''}><span>${x}</span></label>`).join('')}</div></div>
            <div class="field"><label for="fb-msg">Message</label><textarea class="input" id="fb-msg" rows="4" placeholder="What would make GeoThermX useful in your work? How many feasibility studies do you do per year?"></textarea></div>
            ${c ? `<label class="rs-check"><input type="checkbox" id="fb-proj"><span>Attach a summary of my current project (<b>${esc(c.project.name)}</b>: state, building type, payback — no personal data)</span></label>` : ''}
            <label class="rs-check"><input type="checkbox" id="fb-ok" required><span>I agree to be contacted about GeoThermX. My details are used only for this.</span></label>
            <div class="rs-fb-err" id="fb-err" role="alert"></div>
            <button class="btn btn-accent btn-lg" id="fb-send" type="submit">${mode === 'email' ? 'Send via email →' : 'Send →'}</button>
            ${mode === 'off' ? '<div class="rs-off">The form is not connected yet. Site owner: add a Formspree form ID or a contact email in <code>assets/js/config.js</code>.</div>' : ''}
          </form>
          <div class="rs-col2">
            <div class="card pad rs-why"><h3 class="card-title">What pilot users get</h3><ul class="rs-ul">
              <li><b>Unlimited feasibility studies</b> for client projects in any state</li><li><b>Branded PDF reports</b> with your company details</li><li><b>Direct line</b> to the team — features you need get built first</li><li><b>Early pricing</b> locked in for later plans</li></ul></div>
            <div class="card pad"><h3 class="card-title">Usage statistics</h3>
              ${GX.statsOn ? `<p class="muted rs-p">Anonymous usage statistics are on (GoatCounter): page views and actions such as projects created and reports generated. No cookies and no personal data.</p>` : `<p class="muted rs-p">Usage statistics are not connected yet. When enabled, GeoThermX counts page views and actions (projects created, reports generated) anonymously — no cookies, no personal data.</p>`}
              ${stats ? `<a class="btn btn-ghost" href="${esc(stats)}" target="_blank" rel="noopener">View public usage statistics ↗</a>` : ''}</div>
          </div>
        </div></div>`;
      const form = U.$('#fb-form', el), err = U.$('#fb-err', el), btn = U.$('#fb-send', el);
      form.onsubmit = async ev => {
        ev.preventDefault(); err.textContent = '';
        const v = id => (U.$('#' + id, el) || {}).value || '';
        const email = v('fb-email').trim(), name = v('fb-name').trim();
        if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { err.textContent = 'Please enter your name and a valid email.'; return; }
        if (!U.$('#fb-ok', el).checked) { err.textContent = 'Please confirm that we may contact you.'; return; }
        const data = { name, email, company: v('fb-co').trim(), state: v('fb-st'), role: v('fb-role'), interest: [...el.querySelectorAll('[name="fb-int"]:checked')].map(x => x.value).join(', '), message: v('fb-msg').trim(), source: 'GeoThermX app' };
        const pj = U.$('#fb-proj', el);
        if (pj && pj.checked && S.cur()) { const r = S.result(), p = S.cur().project; data.project = `${r.loc.state} · ${p.buildingType} · vs ${r.baseline.short} · payback ${GX.pb(r.paybackYears)} yrs · net investment ${U.money(r.netCapex)}`; }
        btn.disabled = true; btn.textContent = 'Sending…';
        try {
          const res = await GX.sendFeedback(data);
          if (res === 'sent') form.outerHTML = `<div class="card pad rs-done"><div class="rs-tick"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-16"/></svg></div><h3>Thank you, ${esc(name.split(' ')[0])}!</h3><p class="muted">Your message was sent. We will get back to you at <b>${esc(email)}</b>.</p></div>`;
          else { btn.disabled = false; btn.textContent = 'Send via email →'; U.toast('Your email app opened with the message ready to send.'); }
        } catch (e) {
          btn.disabled = false; btn.textContent = 'Send →';
          err.textContent = e.message === 'not-connected' ? 'The form is not connected yet — please try again later.' : 'Could not send: ' + e.message;
        }
      };
    }
  };
})();
