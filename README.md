# GeoThermX — Web Platform (v2.1)

Interactive engineering & analytics web app for geothermal (ground-source heat pump) projects,
built from the GeoThermX UI design (14 screens) and the platform description / business plan.

## Run
Open `index.html` in any modern browser (Chrome, Edge, Safari, Firefox). No build step, no server required.
Optionally serve the folder: `python3 -m http.server` and open http://localhost:8000.

## What's new in v2.0 — restructured as a feasibility workflow
Goal: for a building anywhere in the US, show whether a geothermal heat pump system pays off, how big it must be,
what it costs after incentives and when it pays back against the current heating & cooling system.

**Sidebar (6 steps + operation)**
1. Site — state, city, ground; state energy prices shown.
2. Building & Loads — current heating/cooling system (baseline), sector, project type, building data, loads.
3. Ground Loop — tabs: Design · Borefield & drilling · Long-term simulation · Risks.
4. Costs & Incentives (new) — energy prices (state defaults, editable), installed cost rates, federal / state / utility incentives, net investment, annual operating cost.
5. Payback — tabs: Cash flow & payback · Compare options.
6. Report.
After installation: Operation (Measured data · Alerts). AI assistant removed from navigation.

**Units (v2.1)** — US units by default (ft, ft², tons, °F, gpm, psi, $/ft, $/ton, Btu/h·ft·°F, °F-degree-days, fuel in gal / therms).
One switch (sidebar or Settings) converts every page, chart, tooltip, report, checklist and CSV export. Data is stored once in SI, so switching never changes results.

**Engine changes**
- Energy prices per state and sector (EIA averages, approx. 2024) — residential/commercial electricity and natural gas; propane / heating oil US averages. All editable per project.
- Baseline system: natural gas, propane, heating oil, electric resistance (+AC) or air-source heat pump (climate-dependent COP).
- Sector: residential (no federal credit after 2025, 25D ended) / commercial (§48 ITC 30% default, editable).
- Project type: new construction / end-of-life replacement credit the avoided conventional equipment; early retrofit does not.
- Realistic installed drilling rates ($50–90/m incl. loop & grout), sector-based heat-pump cost, maintenance savings per kW.
- Residential cooling load fix; fine peak-load rounding for small buildings; payback beyond 25 years shown as "over 25".
- Incentives no longer invented: state/utility amounts default to $0 with a link to DSIRE.

## What's new in v1.3
- New welcome screen: animated borefield cross-section (fluid flowing in the loops), animated subsurface background (canvas, honours prefers-reduced-motion), live sample KPIs computed by the engine.
- Removed all leftover mock-up names (Southern Cluster, Zone B/4, B-12, HX-2, Phase 2, Node 412, etc.). Risk, AI assistant, alerts, drilling and dashboard texts are now neutral and derived from the project model.
- AI Assistant: seeded demo dialogue only in the sample project; your projects start with a short greeting.
- Depth slice shows an assumed uniform profile of the selected ground type (no invented strata); site probe labelled as an indicative model.

## What's new in v1.2
- Starts empty with a welcome screen: create your own project or open a clearly labelled sample project.
- Any U.S. location: all 50 states + DC, city/address, climate zone, ground type and optional measured conductivity (TRT).
- Monitoring works with real data: upload monthly operating data (CSV or manual entry); measured COP is compared with the design model and deviations create alerts.
- Navigation grouped by workflow (Site & Building → Design → Results → Operation), page tips with a "Next step" button, project progress and a glossary.
- Removed internal items (plan switcher, roadmap labels) and the benchmarking module that relied on illustrative data.

## What's new in v1.1
- Projects workspace: project list, new-project wizard, lifecycle stages (Assessment → Design → Operational), calculation history with restore.
- Building thermal load calculation (degree-day + design-day method) or known demand with 12-month utility CSV import.
- Full multi-page Engineering Analysis Report (cover + 14 sections, print to PDF).
- "How is this calculated?" panels with formulas and inputs; loop-length reference check (ft/ton).
- Safety, permits & compliance checklist (OSHA, NEC, IGSHPA, state permits, 811).
- Metric / imperial units.
- Monitoring and Alerts only for operational projects; simulated data is labelled "Demo data".

## Modules (sidebar)
General: Projects · Dashboard · Site Intelligence · Project Setup
Engineering: System Design · Drilling Optimization
Analysis: Simulation Lab · Scenario Comparison · Financial Analysis
Operation: Monitoring (uploaded operating data) · Alerts & Issues · Risk Forecast
System: AI Assistant (Engineering Copilot) · Reports · Settings (roles, assumptions, audit log)

## One calculation engine (assets/js/engine.js)
Every screen reads the same model, so numbers stay consistent everywhere:
- Ground-loop sizing: required loop length from peak loads, ground conductivity, borehole spacing interference.
- Entering water temperatures → heating / cooling COP → seasonal COP and efficiency score.
- Long-term ground temperature drift from the heating/cooling imbalance.
- CAPEX (drilling by ground type and depth, heat pumps, integration), OPEX vs conventional HVAC,
  incentives, 25-year cash flow with escalation and degradation, payback, ROI, NPV, IRR, CO₂.
- Drilling optimizer (depth × spacing search minimising lifecycle cost), 3 scenarios, monthly simulation
  over 1/5/10 years, risk model, alert rules, benchmarking.
Assumptions (energy prices, tax credit %, drilling multiplier, $/kW…) are editable in Settings or
Financial Analysis → Assumptions. Results are preliminary engineering estimates, not licensed design.

## Data
Projects, design changes, alerts, reports and the audit log are saved in the browser (localStorage).
Settings → Reset demo data restores the three sample projects.

## Structure
index.html
assets/css/app.css      design tokens + shell + components
assets/css/views.css    per-screen layouts
assets/js/engine.js     calculation engine
assets/js/store.js      state, persistence, audit log
assets/js/alerts.js     rule-based alert engine
assets/js/ui.js         formatting, animations, charts, modals, exports
assets/js/views-*.js    the 15 screens
assets/js/app.js        router, sidebar, top bar
assets/img/             illustrations taken from the design screens
