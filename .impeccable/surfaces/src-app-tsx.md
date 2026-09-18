---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: []
---

## Visitor mode

Operate — solo retail investor completing allocation tasks periodically.

## Audience, job, action, proof, constraints

Solo retail investor with Binance spot holdings. Arrives to answer: "Where am I vs. my target?" and "How do I deploy this new cash?" Primary action: enter a cash injection amount, receive a precise buy plan. Secondary: view allocation drift, adjust target config, review history. Constraints: Binance API CORS via Vite proxy; read-only key; client-side only; localStorage persistence.

## Direction contract

THESIS: A night-mode quant workstation that renders a crypto-native investor's actual Binance holdings at precision-instrument density — refusing the dashboard-card grid of every competing fintech app in favor of a tabular, chart-led surface where data is the design.

OWN-WORLD: Ground `#0B0E11` (Binance deep slate), surface `#1E2026`, accent `#F0B90B` (Binance gold). Secondary tint `#848E9C`. Monospace face (JetBrains Mono or similar) for all numerals, tabular-nums, tight tracking. One workhorse grotesk (Geist or Inter) for UI labels. Chart lines emit a subtle glow on the active/selected series. Elevation declared once per layer: surface cards use `1px solid rgba(255,255,255,0.07)` border only, no shadow duplicating the border. State is rendered as mark and number, not hue: connected/error, loading/idle use icon + value changes, not wholesale regional repaints.

STORY: Investor opens the app → sees total portfolio value at monumental scale, allocation donut, and drift bars in one glance → switches to Inject tab, enters cash amount → receives a surgical buy plan table → executes manually on Binance.

FIRST VIEWPORT (Dashboard): Fixed 64px left sidebar (icon nav + connection status at bottom). Main area: a single monumental USDT total value (4–5rem mono, gold glow) anchoring a header stat row (24h change, asset count, largest position). Below: two-column — donut chart left, drift bar chart right. Below that: full-width holdings table (asset, amount, USDT, current %, target %, drift with ▲▼ indicator). Signature interaction: the injection amount field on the Inject tab live-updates the drift bars and per-asset "new weight" preview as the user types.

FORM: Night-mode quant workstation, candidate 3 of my grounded list. Seed key 9b55cbd1.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
