# 📊 Binance Portfolio Allocation

> Real-time crypto portfolio tracker, rebalancer, and narrative intelligence dashboard — powered by your Binance read-only API key.

![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Go](https://img.shields.io/badge/Go-backend-00ADD8?style=flat-square&logo=go&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)

---

## ✨ Features

| Feature | Description |
|---|---|
| 📈 **Dashboard** | Live holdings, allocation pie chart, drift bar chart, rebalance alerts |
| ⚡ **Inject** | Calculate exactly how much to buy when adding fresh capital |
| 🔄 **Rebalance** | Drift-triggered sell/buy plan to restore target weights |
| 🕐 **History** | Portfolio value over time, BTC-denominated tracking |
| 🧠 **Narratives** | Emerging crypto theme detection via social, volume, on-chain & capital flow signals |
| ⚙️ **Settings** | API key management, target allocations, currency, FX rates |

---

## 🏗️ Stack

**Frontend**
- React 19 + TypeScript — component-per-page architecture with co-located hooks
- Vite 8 with React Compiler enabled
- Tailwind CSS 4 + DaisyUI 5 — dark theme, `oklch` color system
- Recharts — allocation pie + drift bar charts

**Backend** (`/server`)
- Go with Fiber — REST API, HMAC-signed Binance proxy, FX rate fetching
- Narrative scoring engine — aggregates signals into lifecycle-aware scores
- Lightweight file-based persistence (no external DB required in dev)

---

## 🚀 Getting Started

### Prerequisites
- Node.js ≥ 20
- Go ≥ 1.22
- [Air](https://github.com/air-verse/air) for backend hot-reload (`go install github.com/air-verse/air@latest`)

### Install & Run

```bash
# Install frontend deps
npm install

# Run frontend + backend concurrently
npm run dev
```

Frontend → `http://localhost:5173`  
Backend API → `http://localhost:8080`

### First-time Setup

1. Open the app — the onboarding screen will guide you through adding your **Binance read-only API key**.
2. Alternatively, click **Explore Demo** to load simulated balances without any API key.
3. Head to **Settings** to configure target allocations per asset.

---

## 📁 Project Structure

```
├── src/
│   ├── components/     # Page-level UI components
│   ├── hooks/          # Co-located data + state hooks (one per component)
│   ├── lib/            # Pure logic: portfolio math, narrative helpers
│   ├── services/       # API call layer (fetch wrappers)
│   ├── types/          # Shared TypeScript interfaces
│   └── utils/          # Currency conversion, storage, formatting
│
└── server/
    └── internal/
        ├── binance/    # Binance REST API client (HMAC auth)
        ├── handler/    # HTTP route handlers
        ├── narratives/ # Narrative scoring engine
        ├── portfolio/  # Portfolio calculation logic
        ├── fx/         # FX rate fetching
        ├── config/     # App config & env
        ├── db/         # Persistence layer
        └── middleware/ # Auth, CORS, request logging
```

---

## 📸 Screenshots

| Dashboard | Rebalance |
|---|---|
| ![Dashboard](docs/demo/dashboard.png) | ![Rebalance](docs/demo/rebalance.png) |

| Inject Capital | Narratives |
|---|---|
| ![Inject](docs/demo/inject.png) | ![Narratives](docs/demo/narative.png) |

| Settings — API Key | Settings — Targets |
|---|---|
| ![Settings 1](docs/demo/settings-1.png) | ![Settings 2](docs/demo/settings-2.png) |

---

## 🔐 Privacy & Security

- API keys are stored **locally in your browser** (`localStorage`) — never sent to any third-party.
- The Go backend acts as a **HMAC-signing proxy**: your secret key signs requests server-side so it is never exposed to the browser.
- Only **read-only** Binance endpoints are used — no trading permissions required or requested.

---

## 🗺️ Roadmap

### Futures Enhancements

The current implementation includes Futures positions in total portfolio value but treats them as read-only — no automatic SPOT → FUT order generation. The planned enhancements below address this gap.

| # | Feature | Description | Status |
|---|---|---|---|
| F-1 | **Futures drift alerts** | Extend rebalance drift detection to flag Futures positions that exceed their target band, with a separate alert tier from Spot | 🔲 Planned |
| F-2 | **Futures inject calculator** | Dedicate a section in the Inject tab to calculate how much USDT to transfer to Futures to close underweight positions | 🔲 Planned |
| F-3 | **SPOT → FUT transfer flow** | Guided step-by-step flow for moving capital from Spot wallet to Futures wallet, with confirmation and fee estimate | 🔲 Planned |
| F-4 | **Futures-only rebalance plan** | Separate rebalance calculation scoped exclusively to Futures positions — sell overweight, buy underweight within Futures | 🔲 Planned |
| F-5 | **Unified rebalance mode** | Combined Spot + Futures rebalance plan with wallet-aware routing (keeps funds in their originating wallet unless explicitly crossing) | 🔲 Planned |
| F-6 | **Futures PnL overlay** | Show unrealized PnL per Futures position alongside allocation percentage in Dashboard and History | 🔲 Planned |
| F-7 | **Leverage-adjusted weighting** | Option to display Futures positions at notional value (quantity × price × leverage) instead of margin value for more accurate allocation math | 🔲 Planned |

### Other Planned Features

| # | Feature | Description | Status |
|---|---|---|---|
| G-1 | **Price alerts** | Notify when an asset drifts past its rebalance threshold between manual checks | 🔲 Planned |
| G-2 | **Multi-exchange support** | OKX and Bybit API adapters alongside Binance | 🔲 Planned |
| G-3 | **Narrative auto-exposure alerts** | Alert when portfolio narrative concentration exceeds a configurable threshold | 🔲 Planned |
| G-4 | **Export to CSV/PDF** | Download rebalance plan, injection plan, and history snapshots | 🔲 Planned |

### Narrative Intelligence — Phase 2

The core ambition: turn the Narratives tab from a read-only monitor into an active allocation copilot. The current scoring engine (social, volume, on-chain, capital flow signals) is the foundation — these features build the decision layer on top of it.

| # | Feature | Description | Status |
|---|---|---|---|
| N-1 | **Narrative scoring engine — production** | Complete the backend deployment of real signal aggregation; move off the current development-mode stubs to live data | 🔧 In Progress |
| N-2 | **Narrative rotation signals** | Highlight which narratives are approaching peak momentum (crowded) vs. which are just starting to accelerate (emerging) — surface the optimal entry and exit windows per theme | 🔲 Planned |
| N-3 | **Altcoin slot system** | Designate a configurable portion of the portfolio (e.g. 20%) as the "rotation bucket" — assets in this bucket are swapped according to narrative momentum rather than held as core positions | 🔲 Planned |
| N-4 | **Narrative-driven rebalance suggestions** | When a narrative peaks or cools, the system generates a suggested swap: exit the cooling coin, enter the emerging one, within the rotation bucket — without touching BTC or core long-term holds | 🔲 Planned |
| N-5 | **Narrative exposure concentration warnings** | Alert when multiple altcoins in the portfolio belong to the same narrative theme, creating hidden correlated risk that a simple allocation percentage doesn't reveal | 🔲 Planned |
| N-6 | **Narrative momentum history** | Track how a narrative's score has moved over the past 7/30/90 days — know whether you're early, in the middle, or late to a theme | 🔲 Planned |

### AI Position Copilot

An AI assistant scoped specifically to the decisions this app already supports — not generic crypto advice, but reasoning grounded in your actual portfolio state, current narrative scores, and Binance Futures mechanics.

| # | Feature | Description | Status |
|---|---|---|---|
| A-1 | **Futures open-position advisor** | Chat interface that takes your current portfolio state + a proposed Futures position and reasons through sizing, leverage, and allocation impact before you open | 🔲 Planned |
| A-2 | **Narrative rotation assistant** | Given current narrative scores and your holdings, the AI suggests which altcoin slot to rotate out of and into — with reasoning based on lifecycle stage and signal trajectory | 🔲 Planned |
| A-3 | **Inject timing advisor** | When adding fresh capital, AI contextualizes the inject plan against current narrative momentum — e.g. "this allocation increases your DeFi exposure at a crowded lifecycle stage" | 🔲 Planned |
| A-4 | **Rebalance risk reasoning** | Before executing a rebalance plan, AI flags non-obvious risks: high narrative concentration, correlated sells, adverse timing relative to signal trends | 🔲 Planned |
| A-5 | **Context-aware chat** | Persistent chat sidebar with full awareness of your live portfolio, targets, narrative scores, and history — answers questions like "am I too exposed to AI narrative?" or "when should I trim SOL?" | 🔲 Planned |

---

## 📖 Architecture

See [`docs/wiki/architecture.md`](docs/wiki/architecture.md) for the full system diagram and data flow.
