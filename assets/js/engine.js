/* GeoThermX calculation engine — single source of truth for every module.
   Preliminary engineering logic (ASHRAE-style simplified sizing). Not a substitute for licensed design. */
(function (root) {
  'use strict';

  const GROUND = {
    'Silty Sand / Gravel': { k: 2.8, drill: 55.0, drillability: 0.92, stability: 0.94, water: 0.70, layer: 'saturated sand & gravel' },
    'Clay / Silt':         { k: 1.5, drill: 50.0, drillability: 0.95, stability: 0.86, water: 0.55, layer: 'clay / silt' },
    'Sandstone':           { k: 3.0, drill: 70.0, drillability: 0.80, stability: 0.96, water: 0.60, layer: 'sandstone' },
    'Limestone':           { k: 2.6, drill: 66.0, drillability: 0.78, stability: 0.90, water: 0.65, layer: 'limestone' },
    'Granite / Bedrock':   { k: 3.3, drill: 90.0, drillability: 0.60, stability: 0.98, water: 0.30, layer: 'granite bedrock' },
    'Dry Sand':            { k: 1.1, drill: 52.0, drillability: 0.90, stability: 0.70, water: 0.20, layer: 'dry sand' }
  };

  const CLIMATE = {
    '1A': { label: 'Zone 1A (Very Hot Humid)', tg: 25.0, fit: 0.60, heatShare: 0.05, hdd: 100, cdd: 2400, tdh: 10, tdc: 33 },
    '2B': { label: 'Zone 2B (Hot Dry)',     tg: 23.0, fit: 0.65, heatShare: 0.10, hdd: 550,  cdd: 2300, tdh: 3,   tdc: 43 },
    '3A': { label: 'Zone 3A (Warm Humid)',  tg: 17.5, fit: 0.85, heatShare: 0.35, hdd: 1500, cdd: 1150, tdh: -4,  tdc: 35 },
    '3C': { label: 'Zone 3C (Warm Marine)', tg: 15.0, fit: 0.80, heatShare: 0.60, hdd: 1500, cdd: 100,  tdh: 3,   tdc: 28 },
    '4B': { label: 'Zone 4B (Mixed Dry)',   tg: 14.0, fit: 0.88, heatShare: 0.50, hdd: 2300, cdd: 750,  tdh: -9,  tdc: 35 },
    '6B': { label: 'Zone 6B (Cold Dry)',    tg: 7.5,  fit: 0.86, heatShare: 0.72, hdd: 4300, cdd: 300,  tdh: -26, tdc: 32 },
    '7':  { label: 'Zone 7 (Very Cold)',    tg: 5.5,  fit: 0.80, heatShare: 0.80, hdd: 5300, cdd: 150,  tdh: -31, tdc: 29 },
    '8':  { label: 'Zone 8 (Subarctic)',    tg: 2.0,  fit: 0.65, heatShare: 0.90, hdd: 7500, cdd: 50,   tdh: -40, tdc: 27 },
    '2A': { label: 'Zone 2A (Hot Humid)',   tg: 21.0, fit: 0.72, heatShare: 0.15, hdd: 800,  cdd: 1650, tdh: 2,   tdc: 35 },
    '3B': { label: 'Zone 3B (Warm Dry)',    tg: 18.5, fit: 0.78, heatShare: 0.25, hdd: 1250, cdd: 1350, tdh: -1,  tdc: 38 },
    '4A': { label: 'Zone 4A (Mixed Humid)', tg: 13.5, fit: 0.90, heatShare: 0.45, hdd: 2300, cdd: 900,  tdh: -9,  tdc: 33 },
    '4C': { label: 'Zone 4C (Marine)',      tg: 12.5, fit: 0.90, heatShare: 0.45, hdd: 2600, cdd: 250,  tdh: -4,  tdc: 29 },
    '5A': { label: 'Zone 5A (Cool Humid)',  tg: 10.5, fit: 0.93, heatShare: 0.58, hdd: 3300, cdd: 600,  tdh: -18, tdc: 32 },
    '5B': { label: 'Zone 5B (Cool Dry)',    tg: 10.0, fit: 0.91, heatShare: 0.60, hdd: 3200, cdd: 550,  tdh: -16, tdc: 33 },
    '6A': { label: 'Zone 6A (Cold Humid)',  tg: 8.5,  fit: 0.88, heatShare: 0.68, hdd: 4000, cdd: 400,  tdh: -23, tdc: 31 }
  };

  // Representative city per state: climate zone (IECC), typical ground, approx. grid CO2 factor (kg/kWh), PV yield (kWh/kWp·yr)
  const STATES = [
    ['AL','Alabama','Birmingham',33.52,-86.80,'3A','Limestone',0.36,1450],['AK','Alaska','Anchorage',61.22,-149.90,'7','Silty Sand / Gravel',0.45,900],
    ['AZ','Arizona','Phoenix',33.45,-112.07,'2B','Dry Sand',0.33,1800],['AR','Arkansas','Little Rock',34.75,-92.29,'3A','Clay / Silt',0.45,1450],
    ['CA','California','Sacramento',38.58,-121.49,'3B','Silty Sand / Gravel',0.20,1650],['CO','Colorado','Denver',39.74,-104.99,'5B','Sandstone',0.55,1600],
    ['CT','Connecticut','Hartford',41.76,-72.67,'5A','Granite / Bedrock',0.23,1250],['DE','Delaware','Wilmington',39.74,-75.55,'4A','Clay / Silt',0.33,1300],
    ['DC','District of Columbia','Washington',38.91,-77.04,'4A','Clay / Silt',0.30,1350],['FL','Florida','Orlando',28.54,-81.38,'2A','Limestone',0.39,1500],
    ['GA','Georgia','Atlanta',33.75,-84.39,'3A','Granite / Bedrock',0.35,1450],['HI','Hawaii','Honolulu',21.31,-157.86,'1A','Granite / Bedrock',0.68,1600],
    ['ID','Idaho','Boise',43.62,-116.20,'5B','Silty Sand / Gravel',0.10,1500],['IL','Illinois','Chicago',41.88,-87.63,'5A','Clay / Silt',0.30,1300],
    ['IN','Indiana','Indianapolis',39.77,-86.16,'5A','Limestone',0.70,1300],['IA','Iowa','Des Moines',41.59,-93.62,'5A','Clay / Silt',0.32,1350],
    ['KS','Kansas','Wichita',37.69,-97.34,'4A','Limestone',0.38,1500],['KY','Kentucky','Louisville',38.25,-85.76,'4A','Limestone',0.78,1350],
    ['LA','Louisiana','New Orleans',29.95,-90.07,'2A','Clay / Silt',0.37,1450],['ME','Maine','Portland',43.66,-70.26,'6A','Granite / Bedrock',0.10,1250],
    ['MD','Maryland','Baltimore',39.29,-76.61,'4A','Silty Sand / Gravel',0.28,1350],['MA','Massachusetts','Boston',42.36,-71.06,'5A','Granite / Bedrock',0.35,1250],
    ['MI','Michigan','Detroit',42.33,-83.05,'5A','Clay / Silt',0.45,1250],['MN','Minnesota','Minneapolis',44.98,-93.27,'6A','Silty Sand / Gravel',0.38,1300],
    ['MS','Mississippi','Jackson',32.30,-90.18,'3A','Clay / Silt',0.42,1450],['MO','Missouri','St. Louis',38.63,-90.20,'4A','Limestone',0.70,1400],
    ['MT','Montana','Helena',46.59,-112.04,'6B','Sandstone',0.45,1400],['NE','Nebraska','Omaha',41.26,-95.93,'5A','Clay / Silt',0.55,1400],
    ['NV','Nevada','Las Vegas',36.17,-115.14,'3B','Dry Sand',0.33,1800],['NH','New Hampshire','Manchester',42.99,-71.46,'5A','Granite / Bedrock',0.11,1250],
    ['NJ','New Jersey','Newark',40.74,-74.17,'4A','Silty Sand / Gravel',0.23,1300],['NM','New Mexico','Albuquerque',35.08,-106.65,'4B','Sandstone',0.45,1850],
    ['NY','New York','New York',40.71,-74.01,'4A','Granite / Bedrock',0.23,1300],['NC','North Carolina','Raleigh',35.78,-78.64,'4A','Granite / Bedrock',0.33,1450],
    ['ND','North Dakota','Bismarck',46.81,-100.78,'6A','Clay / Silt',0.70,1400],['OH','Ohio','Columbus',39.96,-83.00,'5A','Limestone',0.55,1250],
    ['OK','Oklahoma','Oklahoma City',35.47,-97.52,'3A','Sandstone',0.33,1550],['OR','Oregon','Portland',45.52,-122.68,'4C','Silty Sand / Gravel',0.14,1150],
    ['PA','Pennsylvania','Philadelphia',39.95,-75.17,'4A','Silty Sand / Gravel',0.33,1300],['RI','Rhode Island','Providence',41.82,-71.41,'5A','Granite / Bedrock',0.40,1250],
    ['SC','South Carolina','Columbia',34.00,-81.03,'3A','Clay / Silt',0.25,1450],['SD','South Dakota','Sioux Falls',43.55,-96.73,'6A','Clay / Silt',0.15,1400],
    ['TN','Tennessee','Nashville',36.16,-86.78,'4A','Limestone',0.30,1400],['TX','Texas','Dallas',32.78,-96.80,'3A','Limestone',0.38,1550],
    ['UT','Utah','Salt Lake City',40.76,-111.89,'5B','Silty Sand / Gravel',0.65,1600],['VT','Vermont','Burlington',44.48,-73.21,'6A','Granite / Bedrock',0.02,1200],
    ['VA','Virginia','Richmond',37.54,-77.44,'4A','Clay / Silt',0.30,1400],['WA','Washington','Seattle',47.61,-122.33,'4C','Silty Sand / Gravel',0.10,1150],
    ['WV','West Virginia','Charleston',38.35,-81.63,'4A','Sandstone',0.85,1300],['WI','Wisconsin','Milwaukee',43.04,-87.91,'5A','Clay / Silt',0.55,1300],
    ['WY','Wyoming','Cheyenne',41.14,-104.82,'6B','Sandstone',0.85,1600]
  ];
  // Average retail energy prices by state — EIA annual averages (approx. 2024). Starting values only; editable per project.
  // [residential electricity ¢/kWh, commercial electricity ¢/kWh, residential natural gas $/Mcf]
  const PRICES = {
    AL:[15.4,13.9,19],AK:[25.0,21.5,13],AZ:[14.9,12.0,20],AR:[12.8,10.5,16],CA:[32.0,26.0,20],CO:[15.4,12.5,12],CT:[30.0,22.0,20],DE:[16.5,12.0,18],DC:[18.0,15.5,17],
    FL:[15.0,11.5,26],GA:[14.2,11.8,20],HI:[41.0,38.0,50],ID:[11.4,9.0,11],IL:[16.0,12.0,12.5],IN:[15.4,12.8,12],IA:[13.5,10.5,12],KS:[14.3,11.5,13],KY:[13.2,12.0,15],
    LA:[12.0,11.0,15],ME:[27.5,19.5,22],MD:[18.5,13.0,17],MA:[30.5,22.0,22],MI:[19.5,14.0,11.5],MN:[15.6,12.5,11],MS:[13.6,12.5,15],MO:[13.4,10.8,15],MT:[13.0,11.8,11],
    NE:[11.9,9.8,12],NV:[15.5,11.0,15],NH:[25.0,19.0,21],NJ:[19.5,15.0,13],NM:[14.5,11.5,13],NY:[24.5,19.5,18],NC:[14.0,10.8,17],ND:[11.2,10.0,10],OH:[16.0,11.8,14],
    OK:[13.0,10.5,16],OR:[14.0,11.0,16],PA:[18.0,11.5,16],RI:[29.0,21.0,21],SC:[14.5,11.5,18],SD:[13.0,11.0,11],TN:[12.8,12.5,13],TX:[15.0,9.5,16],UT:[11.8,9.5,10.5],
    VT:[22.5,19.5,18],VA:[14.7,9.8,17],WA:[12.5,11.0,16],WV:[14.8,11.5,14],WI:[17.8,13.0,11.5],WY:[12.5,10.8,11]
  };
  const KWH_PER_MCF = 303.9;
  const LOCATIONS = STATES.map(([code, name, city, lat, lon, zone, ground, grid, pv]) => { const pr = PRICES[code] || [16, 12.5, 15];
    return { id: 'st-' + code, code, state: name, label: `${city}, ${code}`, city: `${city}, ${code}`, lat, lon, zone, ground, grid, pv,
      price: { res: { elec: pr[0] / 100, gas: pr[2] / KWH_PER_MCF }, com: { elec: pr[1] / 100, gas: pr[2] * 0.74 / KWH_PER_MCF } } }; });

  // Existing ("baseline") heating & cooling system the geothermal system replaces
  const BASELINES = {
    'gas-ac':     { label: 'Natural gas furnace / boiler + AC', short: 'Gas furnace + AC', fuel: 'gas', eff: 0.90, coolCop: 3.2, co2: 0.181 },
    'propane-ac': { label: 'Propane furnace + AC', short: 'Propane + AC', fuel: 'propane', eff: 0.90, coolCop: 3.2, co2: 0.215 },
    'oil-ac':     { label: 'Heating oil boiler + AC', short: 'Heating oil + AC', fuel: 'oil', eff: 0.84, coolCop: 3.2, co2: 0.267 },
    'elec-ac':    { label: 'Electric resistance heat + AC', short: 'Electric heat + AC', fuel: 'elec', eff: 1.0, coolCop: 3.2, co2: null },
    'ashp':       { label: 'Air-source heat pump', short: 'Air-source heat pump', fuel: 'elec', eff: null, coolCop: 3.6, co2: null }
  };
  const SECTOR = {
    residential: { label: 'Residential', itc: 0, equipRate: 950, avoidedPerKw: 900, maintPerKw: 10, itcNote: 'Federal 25D residential credit ended for systems installed after Dec 31, 2025. Check state and utility programs.' },
    commercial:  { label: 'Commercial', itc: 0.30, equipRate: 450, avoidedPerKw: 380, maintPerKw: 15, itcNote: 'Federal §48 ITC for geothermal heat pumps: 30% base (prevailing wage / apprenticeship or < 1 MW) for construction starting before 2033, then 26% (2033), 22% (2034). Verify with a tax advisor.' }
  };
  const PROJECT_TYPES = {
    replace:  { label: 'Replacing a system at end of life', short: 'End-of-life replacement', avoided: true },
    new:      { label: 'New construction', short: 'New construction', avoided: true },
    retrofit: { label: 'Early retrofit (current system still works)', short: 'Early retrofit', avoided: false }
  };
  const sectorOf = p => p.sector || (/Residential|Single-Family/.test(p.buildingType || '') ? 'residential' : 'commercial');
  /* Project-specific economic defaults: state prices + sector rules. p.econ entries override them. */
  function econDefaults(p) {
    const loc = location(p.locationId, p), sec = sectorOf(p), S0 = SECTOR[sec], pr = loc.price[sec === 'residential' ? 'res' : 'com'];
    return { elec: +pr.elec.toFixed(3), gas: +pr.gas.toFixed(3), propane: 0.105, oil: 0.095, itc: S0.itc, equipRate: S0.equipRate, maintPerKw: S0.maintPerKw, avoidedPerKw: S0.avoidedPerKw, drillMult: 1, grant: 0, utilityRebate: 0 };
  }
  function econ(p) { const d = econDefaults(p), o = p.econ || {}; Object.keys(o).forEach(k => { if (o[k] !== null && o[k] !== '' && o[k] !== undefined && isFinite(+o[k])) d[k] = +o[k]; }); return d; }

  const FLUIDS = {
    'Propylene Glycol 25%': { cop: 0.97, freeze: -10, density: 1.03 },
    'Ethanol 20%':          { cop: 0.98, freeze: -9,  density: 0.98 },
    'Methanol 20%':         { cop: 0.985, freeze: -11, density: 0.97 },
    'Water':                { cop: 1.00, freeze: 0,   density: 1.00 }
  };

  const BUILDINGS = {
    'Single-Family Residential':   { other: 45,  eui: 100, gains: 6,  vent: 0.75 },
    'Commercial Office (Class A)': { other: 95,  eui: 160, gains: 25, vent: 1.0 },
    'Medical / Healthcare':        { other: 210, eui: 330, gains: 34, vent: 1.6 },
    'Multifamily Residential':     { other: 60,  eui: 120, gains: 9,  vent: 0.8 },
    'Education / Campus':          { other: 70,  eui: 140, gains: 20, vent: 1.3 },
    'Retail / Mixed Use':          { other: 120, eui: 190, gains: 28, vent: 1.1 },
    'Industrial / Warehouse':      { other: 50,  eui: 90,  gains: 12, vent: 0.7 }
  };

  const VINTAGE = { 'Pre-1980 (uninsulated)': 2.3, '1980–2004 (code minimum)': 1.85, '2005–2015 (modern code)': 1.5, '2016+ (high performance)': 1.05 };
  const HOURS = { 'Standard (10 h × 5 d)': 2600, 'Extended (14 h × 6 d)': 3640, 'Continuous (24/7)': 8760 };
  const GLAZING = { 'Low (< 25%)': 0.7, 'Medium (25–40%)': 1.0, 'High (> 40%)': 1.35 };

  /* ---------- Building thermal load calculation (degree-day + design-day method) ---------- */
  function loadCalc(p) {
    const c = CLIMATE[p.zone] || CLIMATE['4C'];
    const bt = BUILDINGS[p.buildingType] || BUILDINGS['Commercial Office (Class A)'];
    const uaF = (VINTAGE[p.vintage] || 1.5) * bt.vent;          // W/m²floor·K, envelope + ventilation
    const hours = HOURS[p.hours] || 3640;
    const glz = GLAZING[p.glazing] || 1.0;
    const A = Math.max(1, +p.floorArea);
    const UA = uaF * A / 1000;                                   // kW/K
    const gainsKw = bt.gains * A / 1000 * Math.min(1, hours / 3640 * 0.85 + 0.15);
    const solarW = 30 * glz;                                     // W/m² floor, peak solar through glazing
    const heatPeak = UA * (20 - c.tdh) * 0.9;
    const coolPeak = A * (bt.gains * 0.9 + uaF * Math.max(0, c.tdc - 24) + solarW * 0.5) / 1000;
    const gainsAnnual = gainsKw * hours;
    const heat = Math.max(0, UA * c.hdd * 24 * (hours >= 8760 ? 0.97 : 0.82) - 0.1 * gainsAnnual);
    const res = sectorOf(p) === 'residential';
    const gainFrac = res ? clamp(c.cdd / 3000, 0.08, 0.6) : 0.75;             // homes only need cooling for gains in the warm season
    const solarFrac = res ? clamp(c.cdd / 2000, 0.15, 0.6) : 0.5;
    const cool = gainsAnnual * gainFrac + UA * c.cdd * 24 * 0.6 + A * solarW * 1100 / 1000 * solarFrac;
    const peak = Math.max(heatPeak, coolPeak) * 0.8;
    return { heat: Math.round(heat / 1000) * 1000, cool: Math.round(cool / 1000) * 1000, heatPeak, coolPeak, peak: peak < 50 ? Math.round(peak * 2) / 2 : Math.round(peak / 5) * 5, UA, uaF, gainsKw, hours, c, bt, glz };
  }

  /* ---------- Safety & compliance checks (preliminary, verify locally) ---------- */
  function compliance(r, p, d, u) {
    const fx = (v, dd) => Number(v).toLocaleString('en-US', { maximumFractionDigits: dd || 0 });
    u = u || { len: (m, dd) => fx(m, dd) + ' m', area: m2 => fx(m2) + ' m²', temp: (c, dd) => fx(c, dd == null ? 1 : dd) + '°C', dT: (c, dd) => fx(c, dd == null ? 1 : dd) + '°C' };
    const siteArea = +p.siteArea || 0;
    const field = r.footprint * 1.15;
    const items = [];
    const add = (cat, title, status, note, ref) => items.push({ cat, title, status, note, ref });
    add('Design', 'Borehole depth within drilling constraint', d.depth <= p.depthLimit ? 'pass' : 'fail', `${u.len(d.depth)} planned vs ${u.len(p.depthLimit)} limit.`, 'Project constraint');
    add('Design', 'Borehole spacing for thermal interference', d.spacing >= 6 ? 'pass' : d.spacing >= 4.5 ? 'warn' : 'fail', `${u.len(d.spacing, 1)} spacing. Common practice is about ${u.len(6)} or more for large fields.`, 'IGSHPA design guidance');
    add('Design', 'Borefield fits available site area', !siteArea ? 'warn' : field <= siteArea ? 'pass' : 'fail', siteArea ? `Field needs ≈${u.area(field)} incl. setbacks; site has ${u.area(siteArea)}.` : 'Enter available site area on the Building & Loads page.', 'Site survey');
    add('Design', 'Freeze protection margin', r.EWTh - 3 > r.fl.freeze ? 'pass' : 'fail', `Min entering water ${u.temp(r.EWTh)}; fluid freeze point ${u.temp(r.fl.freeze, 0)} (needs ≥${u.dT(3, 0)} margin).`, 'ASHRAE / manufacturer data');
    add('Design', 'Loop length vs. required (redundancy)', r.ratio >= 1 ? 'pass' : r.ratio >= 0.92 ? 'warn' : 'fail', `Installed ${(r.ratio * 100).toFixed(0)}% of required loop length.`, 'GeoThermX sizing');
    add('Permits', 'State well / borehole drilling permit', 'action', 'Most states require a licensed driller and a permit or registration for geothermal boreholes.', 'State water / geological agency');
    if (d.loop === 'open') add('Permits', 'Groundwater withdrawal & discharge permit', 'action', 'Open-loop systems need water-rights and discharge approval plus water-quality testing.', 'State environmental agency');
    add('Permits', 'Setbacks from property lines, wells and septic', 'action', 'Confirm local minimum distances before finalizing the borehole layout.', 'Local / state code');
    add('Safety', 'Underground utility locate before drilling', 'action', 'Call 811 at least a few business days before any excavation or drilling.', '811 / state one-call law');
    add('Safety', 'Respirable crystalline silica controls on drill rig', 'action', 'Dust suppression and exposure control plan for drilling and grouting.', 'OSHA 29 CFR 1926.1153');
    if (d.orient === 'horizontal') add('Safety', 'Trench protective systems', 'action', 'Trenches 5 ft (1.5 m) or deeper need sloping, shoring or shielding.', 'OSHA 29 CFR 1926 Subpart P');
    add('Safety', 'Heat pump electrical circuits and disconnects', 'action', 'Size branch circuits and disconnects for compressor equipment.', 'NEC Article 440');
    add('Quality', 'Full-length grouting with thermally enhanced grout', 'action', 'Seals aquifers and improves heat transfer; follow state grouting rules.', 'IGSHPA / state code');
    add('Quality', 'Loop flushing and pressure test before backfill', 'action', 'Flush, purge air and pressure-test each loop; record results.', 'IGSHPA installation standard');
    return items;
  }

  const FIDELITY = { 'Measured on site (TRT / drill log)': 1.0, 'Local records (well logs, geo maps)': 0.86, 'Regional estimate': 0.72 };
  const FIDELITY_OLD = { 'High (Sensor + Satellite)': 'Measured on site (TRT / drill log)', 'Medium (Satellite Only)': 'Local records (well logs, geo maps)', 'Low (Regional Model)': 'Regional estimate' };

  const DEFAULT_SETTINGS = {
    elec: 0.14,          // $/kWh
    gas: 0.05,           // $/kWh (fuel)
    drillMult: 1.0,      // multiplier on regional drilling rate
    equipRate: 194,      // $/kW heat pump capacity
    discount: 0.06,
    escalation: 0.025,   // energy price escalation / yr
    itc: 0.30,           // fallback only — real value comes from project sector (econDefaults)
    grant: 0,            // state incentive ($), per project
    utilityRebate: 0,    // utility rebate ($), per project
    propane: 0.105, oil: 0.095, maintPerKw: 15, equipMult: 1, drillAdj: 1,
    carbonPrice: 10,     // $/t CO2 offset credit
        baselineBoilerEff: 0.9,
    baselineChillerCop: 3.0,
    includeGrant: true, includeRebate: true, includeCarbon: false, includeItc: true
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sum = a => a.reduce((x, y) => x + y, 0);

  const HEAT_W = norm([0.17, 0.15, 0.12, 0.09, 0.05, 0.02, 0.005, 0.005, 0.025, 0.075, 0.12, 0.17]);
  const COOL_W = norm([0, 0, 0.02, 0.05, 0.10, 0.16, 0.21, 0.21, 0.15, 0.08, 0.02, 0].map(v => 0.5 / 12 + 0.5 * v / 1.0));
  function norm(a) { const s = sum(a); return a.map(v => v / s); }
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function location(id, p) {
    const l = LOCATIONS.find(x => x.id === id) || LOCATIONS.find(x => x.id === 'st-WA');
    return p && p.city ? Object.assign({}, l, { city: p.city, label: p.city }) : l;
  }

  /* ---------- Core steady-state model ---------- */
  function compute(project, design, settings, mitigation) {
    const s = Object.assign({}, DEFAULT_SETTINGS, econ(project), settings || {});
    const sector = sectorOf(project);
    const m = Object.assign({ rebalance: false, returnTemp: 0, flowOpt: false, copBoost: 0 }, mitigation || {});
    const p = project, d = design;
    const g0 = GROUND[p.ground] || GROUND['Silty Sand / Gravel'];
    const g = +p.kOverride > 0 ? Object.assign({}, g0, { k: +p.kOverride }) : g0;
    const c = CLIMATE[p.zone] || CLIMATE['4C'];
    const loc = location(p.locationId, p);
    const fl = FLUIDS[d.fluid] || FLUIDS['Propylene Glycol 25%'];
    const H = Math.max(0, +p.heatDemand), C = Math.max(0, +p.coolDemand);
    const heatPeak = Math.max(1, +d.heatPeak), coolPeak = Math.max(1, +d.coolPeak);
    const n = Math.max(1, Math.round(+d.n)), depth = Math.max(10, +d.depth), spacing = Math.max(3, +d.spacing);
    const flow = Math.max(0.1, +d.flow);
    const L = n * depth;

    const orientQ = d.orient === 'horizontal' ? 0.42 : 1;
    const orientCost = d.orient === 'horizontal' ? 0.38 : 1;
    const loopQ = d.loop === 'open' ? 2.6 : 1;
    const loopCost = d.loop === 'open' ? 1.35 : 1;
    const fsp = 1 - 0.35 * Math.exp(-(spacing - 3) / 2.5);
    const qh = 20 * g.k * orientQ * loopQ * fsp;   // W/m heat extraction
    const qc = qh * 1.15;                         // W/m heat rejection
    const flowF = flow < 0.6 ? 0.85 + 0.25 * (flow / 0.6) : 1;
    const effFlow = m.flowOpt ? Math.min(flow, 0.95) : flow;
    const pumpKw = 0.02 * Math.max(heatPeak, coolPeak) * Math.pow(effFlow, 2.5);
    const pumpKwh = pumpKw * 3500 * 0.6;

    let COPh = 3.7, COPc = 5.5, Lh, Lc, rh, rc, EWTh, EWTc, drift, Enet;
    for (let i = 0; i < 4; i++) {
      Lh = heatPeak * 1000 * (1 - 1 / COPh) / qh;
      Lc = coolPeak * 1000 * (1 + 1 / COPc) / qc;
      rh = L / Lh; rc = L / Lc;
      Enet = C * (1 + 1 / COPc) - H * (1 - 1 / COPh);
      const effNet = Enet * (m.rebalance ? 0.62 : 1);
      drift = effNet / (L * g.k * 95);           // °C per year
      const spread = m.rebalance ? 1.06 : 1;   // rebalancing spreads peak load across redundant loops
      const life = drift * 5;                  // mid-life average ground temperature shift
      EWTh = c.tg - 7 / Math.pow(rh * spread, 0.8) + life * 0.6;
      EWTc = c.tg + 9 / Math.pow(rc * spread, 0.8) + Math.max(0, life) - (m.returnTemp ? 0.6 : 0);
      COPh = (2.0 + 0.1 * (EWTh + 10)) * fl.cop * flowF * (1 + m.copBoost);
      COPc = (9.2 - 0.17 * EWTc) * flowF * (1 + m.copBoost);
      COPh = clamp(COPh, 1.6, 6.5); COPc = clamp(COPc, 2.0, 9.0);
    }
    const Lreq = Math.max(Lh, Lc);
    const ratio = L / Lreq;
    const SCOP = (H + C) / (H / COPh + C / COPc);
    const capacityC = L * qc / 1000 / (1 + 1 / COPc);
    const capacityH = L * qh / 1000 / (1 - 1 / COPh);
    const capacity = Math.min(capacityC * (coolPeak / Math.max(coolPeak, heatPeak)) + capacityH * (heatPeak / Math.max(coolPeak, heatPeak)), Math.max(capacityC, capacityH));
    const utilization = Math.max(coolPeak / capacityC, heatPeak / capacityH);
    const coverage = clamp(0.62 + 0.38 * Math.min(rh, rc), 0, 1);
    const annualOutput = (H + C) * coverage / 1000; // MWh
    const effScore = clamp(SCOP / 5.0 * 100, 0, 99.5);

    // Costs
    const drillPerM = g.drill * (1 + 0.0012 * Math.max(0, depth - 150)) * orientCost * loopCost * s.drillMult * (s.drillAdj || 1);
    const drilling = L * drillPerM + n * 380;
    const equipment = s.equipRate * (s.equipMult || 1) * Math.max(heatPeak, coolPeak);
    const fieldPrep = n * spacing * spacing * 9;
    const integration = 0.05 * (drilling + equipment) + fieldPrep;
    const capex = drilling + equipment + integration;

    // Operations
    const bl = Object.assign({ key: BASELINES[p.baseline] ? p.baseline : 'gas-ac' }, BASELINES[p.baseline] || BASELINES['gas-ac']);
    if (bl.eff == null) bl.eff = clamp(3.2 - c.hdd * 0.00025, 1.7, 3.1);   // air-source seasonal heating COP falls in colder climates
    bl.price = bl.fuel === 'elec' ? s.elec : s[bl.fuel];
    const baseHeatFuel = H / bl.eff;
    const baseCoolElec = C / bl.coolCop;
    const baseHeatCost = baseHeatFuel * bl.price, baseCoolCost = baseCoolElec * s.elec;
    const baselineCost = baseHeatCost + baseCoolCost;
    Object.assign(bl, { heatCost: baseHeatCost, coolCost: baseCoolCost, heatFuelKwh: baseHeatFuel, coolElecKwh: baseCoolElec });
    const backupElec = (H + C) * (1 - coverage) / 3.0;
    const gshpElec = H * coverage / COPh + C * coverage / COPc + pumpKwh + backupElec;
    const gshpCost = gshpElec * s.elec;
    const energySavings = baselineCost - gshpCost;
    const maintSave = s.maintPerKw * Math.max(heatPeak, coolPeak);
    const annualSavings = energySavings + maintSave;

    // Carbon
    const bt = BUILDINGS[p.buildingType] || BUILDINGS['Commercial Office (Class A)'];
    const otherCo2 = p.floorArea * bt.other * loc.grid / 1000;
    const baseCo2 = (baseHeatFuel * (bl.co2 == null ? loc.grid : bl.co2) + baseCoolElec * loc.grid) / 1000;
    const gshpCo2 = gshpElec * loc.grid / 1000;
    const co2Saved = baseCo2 - gshpCo2;
    const co2Pct = co2Saved / (baseCo2 + otherCo2) * 100;

    // Incentives
    const itc = s.includeItc ? s.itc * capex : 0;
    const grant = s.includeGrant ? s.grant : 0;
    const rebate = s.includeRebate ? s.utilityRebate : 0;
    const carbonCredit = s.includeCarbon ? Math.round(co2Saved * s.carbonPrice) : 0;
    const incentives = itc + grant + rebate + carbonCredit;
    const ptype = PROJECT_TYPES[p.projectType] ? p.projectType : 'replace';
    const avoided = PROJECT_TYPES[ptype].avoided ? s.avoidedPerKw * Math.max(heatPeak, coolPeak) : 0;   // baseline equipment that would have been bought anyway
    const netCapex = Math.max(0, capex - incentives - avoided);

    // Lifecycle cash flow (20 years) with escalation + degradation
    const degr = clamp(Math.abs(drift) * 0.17 / Math.max(COPc, 1) * 100 * 0.6 + 0.35, 0.2, 6); // %/yr efficiency loss
    const flows = [], cum = [-netCapex];
    let paybackYears = null;
    for (let y = 1; y <= 25; y++) {
      const f = annualSavings * Math.pow(1 + s.escalation, y - 1) * Math.pow(1 - degr / 100, y - 1);
      flows.push(f);
      cum.push(cum[y - 1] + f);
      if (paybackYears === null && cum[y] >= 0) paybackYears = y - 1 + (-cum[y - 1]) / f;
    }
    const sav10 = sum(flows.slice(0, 10));
    const netProfit10 = sav10 - netCapex;
    const roi10 = netCapex > 0 ? netProfit10 / netCapex * 100 : 0;
    const npv20 = -netCapex + flows.slice(0, 20).reduce((a, f, i) => a + f / Math.pow(1 + s.discount, i + 1), 0);
    const irr = solveIrr([-netCapex].concat(flows.slice(0, 20)));
    const simplePayback = annualSavings > 0 ? netCapex / annualSavings : Infinity;

    // Imbalance & risk
    const rej = C * (1 + 1 / COPc), ext = H * (1 - 1 / COPh);
    const imbalance = Math.abs(rej - ext) / Math.max(1, rej + ext) * (m.rebalance ? 0.62 : 1);
    const risk = riskModel({ imbalance, utilization, flow: effFlow, drift, EWTh, EWTc, fl, g, depth, ratio, degr, d, p });
    const stability = clamp(0.985 - 0.55 * Math.max(0, Math.abs(drift) - 0.08) - 0.35 * Math.max(0, 1 - ratio) - 0.06 * Math.max(0, effFlow - 1.1) - 0.12 * imbalance, 0.3, 0.99);

    // Site suitability
    const fid = FIDELITY[p.fidelity] || 1;
    const kScore = clamp((g.k - 0.8) / 2.6, 0, 1);
    const depthFit = clamp(p.depthLimit / 300, 0.2, 1);
    const suit = Math.round(100 * (0.30 * kScore + 0.20 * g.drillability + 0.15 * g.stability + 0.15 * c.fit + 0.10 * depthFit + 0.10 * fid));

    return {
      inputs: { p, d, s, m }, g, c, loc, fl, sector, baseline: bl, maintSave,
      n, depth, spacing, flow: effFlow, L, Lreq, Lh, Lc, ratio, rh, rc, fsp, qh, qc,
      COPh, COPc, SCOP, EWTh, EWTc, drift, imbalance, Enet,
      capacity, capacityC, capacityH, utilization, coverage, annualOutput, effScore, stability,
      pumpKw, pumpKwh,
      drillPerM, drilling, equipment, integration, fieldPrep, capex,
      baselineCost, gshpCost, gshpElec, energySavings, annualSavings,
      co2Saved, co2Pct, baseCo2, otherCo2,
      itc, grant, rebate, carbonCredit, incentives, netCapex, avoided, projectType: ptype,
      degr, flows, cum, paybackYears: paybackYears === null ? 99 : paybackYears, simplePayback,
      sav10, netProfit10, roi10, npv20, irr,
      risk, suit, kScore, footprint: n * spacing * spacing,
      capexLow: capex * 0.93, capexHigh: capex * 1.08,
      paybackLow: Math.max(0, capex * 0.93 - incentives - avoided) / Math.max(1, annualSavings * 1.10) * (paybackYears === null ? 1 : paybackYears / Math.max(0.1, simplePayback)),
      paybackHigh: Math.max(0, capex * 1.08 - incentives - avoided) / Math.max(1, annualSavings * 0.88) * (paybackYears === null ? 1 : paybackYears / Math.max(0.1, simplePayback)),
      ftPerTon: (L * 3.28084) / Math.max(0.1, Math.max(coolPeak, heatPeak) / 3.517),
      mPerKw: L / Math.max(1, Math.max(coolPeak, heatPeak))
    };
  }

  function solveIrr(cf) {
    const npv = r => cf.reduce((a, v, i) => a + v / Math.pow(1 + r, i), 0);
    let lo = -0.9, hi = 1.5;
    if (npv(lo) * npv(hi) > 0) return null;
    for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (npv(lo) * npv(mid) <= 0) hi = mid; else lo = mid; }
    return (lo + hi) / 2;
  }

  function level(v, a, b) { return v < a ? 'Low' : v < b ? 'Medium' : 'Critical'; }

  function riskModel(x) {
    const imb = clamp(x.imbalance / 0.45, 0, 1);
    const overload = clamp((x.utilization - 0.80) / 0.35, 0, 1);
    const cavitation = clamp(x.flow > 1.05 ? 0.25 + (x.flow - 1.05) * 1.3 : 0.08 + 0.1 * Math.max(0, 0.5 - x.flow), 0, 1);
    const saturation = clamp(Math.abs(x.drift) / 0.45, 0, 1);
    const freeze = clamp((3 - x.EWTh) / 6 + (x.fl.freeze >= 0 ? 0.3 : 0), 0, 1) * (x.fl.freeze >= 0 ? 1 : 0.4);
    const drilling = clamp((1 - x.g.drillability) * 1.4 + Math.max(0, x.depth - 300) / 300, 0, 1);
    const overheating = clamp((x.EWTc + Math.max(0, x.drift) * 10 - 24) / 10, 0, 1);
    const effDrop = clamp(x.degr / 2.2, 0, 1);
    const undersize = clamp((1 - x.ratio) * 2.5, 0, 1);
    const hydro = x.d.loop === 'open' ? 0.55 : 0.1;
    const parts = { imbalance: imb, overload, cavitation, saturation, freeze, drilling, overheating, effDrop, undersize, hydro };
    const w = { imbalance: 0.26, overload: 0.16, cavitation: 0.12, saturation: 0.14, freeze: 0.06, drilling: 0.07, overheating: 0.07, effDrop: 0.06, undersize: 0.04, hydro: 0.02 };
    const raw = sum(Object.keys(w).map(k => w[k] * parts[k]));
    const score = Math.round(clamp(13 + raw * 118, 5, 98));
    const label = score < 40 ? 'Low Risk' : score < 72 ? 'Moderate Risk' : 'High Risk';
    return {
      parts, score, label,
      levels: {
        overheating: level(overheating, 0.33, 0.66),
        effDrop: level(effDrop, 0.33, 0.66),
        imbalance: level(imb, 0.3, 0.6),
        overload: level(overload, 0.33, 0.66)
      }
    };
  }

  /* ---------- Baseline recommendation from Project Setup ---------- */
  function recommend(project, settings, base) {
    const d = Object.assign({ loop: 'closed', orient: 'vertical', spacing: 6.5, fluid: 'Propylene Glycol 25%', flow: 1.24 }, base || {});
    const peak = +project.peakLoad || 450;
    const share = (CLIMATE[project.zone] || CLIMATE['4C']).heatShare;
    const totalE = (+project.heatDemand) + (+project.coolDemand);
    const hFrac = totalE > 0 ? (+project.heatDemand) / totalE : share;
    const rnd = v => v < 60 ? Math.max(2, Math.round(v * 2) / 2) : Math.round(v / 5) * 5;   // fine steps for homes, 5 kW steps for large buildings
    d.heatPeak = rnd(peak * (0.5 + 1.0 * hFrac));
    d.coolPeak = rnd(peak * (0.55 + 1.3 * (1 - hFrac)));
    const depth = clamp(Math.floor(Math.min(+project.depthLimit || 300, 280) / 10) * 10, 60, 400);
    d.depth = depth; d.n = 10;
    let r = compute(project, d, settings);
    for (let i = 0; i < 6; i++) {
      d.n = Math.max(1, Math.ceil(r.Lreq * 1.0 / depth));
      r = compute(project, d, settings);
    }
    return { design: d, result: r };
  }

  /* ---------- Drilling optimizer: minimise lifecycle cost ---------- */
  const optMemo = new Map();
  function optimize(project, design, settings, mitigation, opts) {
    opts = opts || {};
    const key = JSON.stringify([project, Object.assign({}, design, { n: 0, depth: 0, spacing: 0, flow: opts.keepFlow ? design.flow : 0 }), settings, mitigation, opts]);
    if (optMemo.has(key)) return optMemo.get(key);
    const maxDepth = Math.min(+project.depthLimit || 300, 400);
    const evalAt = (sp, dep) => {
      const d = Object.assign({}, design, { spacing: +sp.toFixed(1), depth: dep, flow: opts.keepFlow ? design.flow : 0.95 });
      d.n = 10;
      let r = compute(project, d, settings, mitigation);
      for (let i = 0; i < 3; i++) { d.n = Math.max(1, Math.ceil(r.Lreq * (opts.target || 1.04) / dep)); r = compute(project, d, settings, mitigation); }
      const pv = r.flows.slice(0, 20).reduce((a, f, i) => a + f / Math.pow(1 + r.inputs.s.discount, i + 1), 0);
      return { obj: r.capex - pv + r.risk.score * 900, design: d, result: r };
    };
    let best = null;
    const dep0 = Math.max(30, Math.min(100, maxDepth));   // shallow sites (depth limit under 100 m) are still searched
    for (let sp = 5; sp <= 8.01; sp += 0.5) for (let dep = dep0; dep <= maxDepth; dep += dep0 < 100 ? 10 : 20) { const c = evalAt(sp, dep); if (!best || c.obj < best.obj) best = c; }
    const s0 = best.design.spacing, d0 = best.design.depth;
    for (let sp = Math.max(5, s0 - 0.4); sp <= Math.min(8, s0 + 0.4) + 1e-9; sp += 0.1) for (let dep = Math.max(Math.min(60, dep0), d0 - 20); dep <= Math.min(maxDepth, d0 + 20); dep += 10) { const c = evalAt(sp, dep); if (c.obj < best.obj) best = c; }
    if (optMemo.size > 60) optMemo.clear();
    optMemo.set(key, best);
    return best;
  }

  /* ---------- Scenarios ---------- */
  function scenarios(project, design, settings, mitigation) {
    const opt = optimize(project, design, settings, mitigation);
    const std = Object.assign({}, design, { depth: Math.min(200, project.depthLimit || 200), spacing: 6.0, flow: 1.24 });
    std.n = 10; let rs = compute(project, std, settings, mitigation);
    for (let i = 0; i < 3; i++) { std.n = Math.ceil(rs.Lreq * 1.10 / std.depth); rs = compute(project, std, settings, mitigation); }
    rs = compute(project, std, Object.assign({}, settings, { equipMult: 0.94 }), Object.assign({}, mitigation, { copBoost: -0.04 }));
    const ce = Object.assign({}, opt.design, { spacing: 5.0, flow: 1.24 });
    ce.n = Math.max(1, Math.ceil(opt.result.Lreq * 0.80 / ce.depth));
    const rc = compute(project, ce, Object.assign({}, settings, { equipMult: 0.85, drillAdj: 0.92 }), Object.assign({}, mitigation, { copBoost: -0.06 }));
    const list = [
      { id: 'standard', name: 'Standard Design', design: std, r: rs },
      { id: 'optimized', name: 'Optimized Layout', design: opt.design, r: opt.result },
      { id: 'cost', name: 'Cost-Efficient Model', design: ce, r: rc }
    ];
    list.forEach(sc => {
      sc.score = sc.r.effScore * 0.45 + (100 - Math.min(100, sc.r.paybackYears * 7)) * 0.35 + (100 - sc.r.risk.score) * 0.20;
      const rsk = sc.r.risk.score;
      sc.riskLabel = rsk < 42 ? 'Minimal' : rsk < 55 ? 'Low' : rsk < 70 ? 'Moderate' : 'High';
    });
    const best = list.reduce((a, b) => (b.score > a.score ? b : a));
    list.forEach(sc => { sc.best = sc === best; });
    const trust = clamp(88 + (best.score - Math.max(...list.filter(x => x !== best).map(x => x.score))) * 0.9, 80, 99.6);
    return { list, best, trust };
  }

  /* ---------- Monthly simulation ---------- */
  function simulate(project, design, settings, mitigation, sim) {
    const base = compute(project, design, settings, mitigation);
    const years = sim.years || 5, months = years * 12;
    const amb = +sim.ambient || 0, lv = 1 + (+sim.loadVar || 0) / 100;
    const demandScale = sim.demand ? (sim.demand * 1e6) / Math.max(1, (+project.heatDemand + +project.coolDemand)) : 1;
    const H = project.heatDemand * lv * demandScale, C = project.coolDemand * lv * demandScale;
    const g = base.g, Tg = base.c.tg, L = base.L;
    const out = { months: [], cop: [], load: [], ground: [], ewtc: [], ewth: [], overloadMonths: 0 };
    const maxHW = Math.max(...HEAT_W), maxCW = Math.max(...COOL_W);
    let cumNet = 0;
    for (let i = 0; i < months; i++) {
      const mo = i % 12;
      const winter = HEAT_W[mo] > 0.08, summer = COOL_W[mo] > 0.1;
      const hMul = winter ? 1 + 0.035 * Math.max(0, -amb) - 0.02 * Math.max(0, amb) : 1;
      const cMul = summer ? 1 + 0.04 * Math.max(0, amb) - 0.02 * Math.max(0, -amb) : 1;
      const Hm = H * HEAT_W[mo] * hMul, Cm = C * COOL_W[mo] * cMul;
      const hp = base.inputs.d.heatPeak * lv * (HEAT_W[mo] / maxHW) * hMul;
      const cp = base.inputs.d.coolPeak * lv * (COOL_W[mo] / maxCW) * cMul;
      const net = Cm * (1 + 1 / base.COPc) - Hm * (1 - 1 / base.COPh);
      cumNet += net * (mitigation && mitigation.rebalance ? 0.62 : 1);
      const swing = (net - (base.Enet / 12)) / (L * g.k * 9);
      const Tground = Tg + cumNet / (L * g.k * 95) + swing;
      const rh = Math.max(0.2, base.capacityH / Math.max(1, hp)), rc = Math.max(0.2, base.capacityC / Math.max(1, cp));
      const ewth = Tground - 7 / Math.pow(Math.min(rh, 4), 0.8) * (base.inputs.d.heatPeak / Math.max(1, base.capacityH)) ** 0.2;
      const ewtc = Tground + 9 / Math.pow(Math.min(rc, 4), 0.8) * (base.inputs.d.coolPeak / Math.max(1, base.capacityC)) ** 0.2;
      const coph = clamp((2.0 + 0.1 * (ewth + 10)) * base.fl.cop, 1.4, 6.5);
      const copc = clamp(9.2 - 0.17 * ewtc, 1.8, 9);
      const cop = (Hm + Cm) > 0 ? (Hm + Cm) / (Hm / coph + Cm / copc) : base.SCOP;
      if (hp > base.capacityH || cp > base.capacityC) out.overloadMonths++;
      out.months.push(i);
      out.cop.push(cop);
      out.load.push((Hm + Cm) / 730);
      out.ground.push(Tground);
      out.ewtc.push(ewtc); out.ewth.push(ewth);
    }
    const avg = sum(out.cop) / months;
    const minCop = Math.min(...out.cop), maxCop = Math.max(...out.cop);
    const worst = out.cop.indexOf(minCop);
    const peakLoadKw = Math.max(base.inputs.d.heatPeak, base.inputs.d.coolPeak) * lv;
    const firstYr = sum(out.cop.slice(0, 12)) / 12, lastYr = sum(out.cop.slice(-12)) / 12;
    const degPerYr = years > 1 ? clamp((firstYr - lastYr) / firstYr / (years - 1) * 100, 0, 15) : base.degr;
    const overloadProb = clamp(out.overloadMonths / months * 100 + Math.max(0, base.utilization * lv - 0.85) * 60, 1, 99);
    const imb = base.imbalance * (lv > 1 ? 1 + (lv - 1) * 0.5 : 1);
    return Object.assign(out, {
      base, years, avgCop: avg, minCop, maxCop, worstMonth: worst,
      avgLoad: sum(out.load) / months, peakCap: clamp(peakLoadKw / Math.max(1, base.capacity) * 100, 0, 199),
      stability: degPerYr < 1.2 && overloadProb < 20 ? 'Excellent' : degPerYr < 2.5 && overloadProb < 40 ? 'Good' : 'Fair',
      lossPct: (avg - minCop) / avg * 100, degPerYr: Math.max(degPerYr, base.degr * 0.6), overloadProb,
      imbalanceLabel: imb < 0.15 ? 'Low' : imb < 0.32 ? 'Moderate' : 'High', imbalanceVal: clamp(imb / 0.5, 0.05, 1),
      worstBorehole: 1 + ((worst + 3) * 7) % Math.max(1, base.n)
    });
  }

  /* ---------- Benchmarks (illustrative regional sample) ---------- */
  const BENCH = { avgCop: 3.80, topCop: 4.95, avgCost: 3.60, topCost: 2.75, avgOut: 1480, topOut: 2350, avgScore: 78.0, topScore: 97.5, peers: 480, sd: 8.5 };
  function benchmark(r, project) {
    const sqft = project.floorArea * 10.764;
    const costSqft = r.capex / sqft;
    const effPart = clamp((r.SCOP - 2.8) / (BENCH.topCop - 2.8), 0, 1.05) * 100;
    const costPart = clamp((5.0 - costSqft) / (5.0 - BENCH.topCost), 0, 1.05) * 100;
    const outPart = clamp(r.annualOutput / BENCH.topOut, 0, 1.05) * 100;
    const score = clamp(0.5 * effPart + 0.25 * costPart + 0.25 * outPart, 30, 99.9);
    const z = (score - BENCH.avgScore) / BENCH.sd;
    const pct = 1 - normCdf(z);
    const rank = clamp(Math.ceil(pct * BENCH.peers), 1, BENCH.peers);
    return { score, costSqft, rank, topPct: Math.max(1, Math.ceil(rank / BENCH.peers * 100)), effVsAvg: (r.SCOP / BENCH.avgCop - 1) * 100, B: BENCH };
  }
  function normCdf(z) { const t = 1 / (1 + 0.2316419 * Math.abs(z)); const d = 0.3989423 * Math.exp(-z * z / 2); let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; }

  /* ---------- Site probe (deterministic spatial field) ---------- */
  function hash(x, y, seed) { const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453; return s - Math.floor(s); }
  function noise(x, y, seed) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed), c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function probe(r, x, y) { // x,y in 0..1 across the site map
    const seed = r.loc.lat;
    const f = 0.6 * noise(x * 4, y * 4, seed) + 0.4 * noise(x * 9, y * 9, seed + 3);
    const k = r.g.k * (0.82 + 0.36 * f);
    const cop = clamp(r.SCOP * (0.86 + 0.26 * f), 2, 6.2);
    const drill = clamp(r.g.drillability * (0.85 + 0.25 * noise(x * 6, y * 6, seed + 9)), 0, 1);
    const water = clamp(4 + 14 * noise(x * 3, y * 3, seed + 5), 2, 20);
    return { k, cop, drill, water, zone: cop > 4.8 ? 'High Efficiency' : cop > 3.2 ? 'Moderate' : 'Constraint Zone' };
  }

  /* ---------- Solar hybrid alternative ---------- */
  function hybrid(r, project) {
    const roof = project.floorArea / Math.max(1, project.floors) * 0.6;
    const kw = roof * 0.2;
    const kwh = kw * r.loc.pv;
    const offset = Math.min(kwh, r.gshpElec) * r.inputs.s.elec;
    const cost = kw * 1600 * (1 - (r.inputs.s.includeItc ? r.inputs.s.itc : 0));
    const roiUp = offset / Math.max(1, r.netCapex + cost) * 100 * 2.2;
    return { kw, kwh, offset, cost, roiUp };
  }

  root.GXEngine = { FIDELITY_OLD, PROJECT_TYPES, PRICES, BASELINES, SECTOR, sectorOf, econ, econDefaults, STATES, VINTAGE, HOURS, GLAZING, loadCalc, compliance, GROUND, CLIMATE, LOCATIONS, FLUIDS, BUILDINGS, FIDELITY, DEFAULT_SETTINGS, MONTHS, HEAT_W, COOL_W, compute, recommend, optimize, scenarios, simulate, benchmark, probe, hybrid, location, clamp, normCdf };
})(typeof window !== 'undefined' ? window : globalThis);
