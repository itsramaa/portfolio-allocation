# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React 19 + TypeScript + Vite + Tailwind CSS v4 + DaisyUI v5 (existing codebase).

## Users

Individual retail investor managing their own crypto portfolio. Single-user personal tool — no multi-tenancy or authentication beyond the user's own Binance API key, which is entered in the app and stored locally.

## Product Purpose

A personal portfolio allocation dashboard that connects to the Binance API (using the user's own API key) to pull live spot holdings, then enables the user to:
- Visualize current asset allocation vs. a configured target allocation
- Calculate how to deploy new cash injections across assets to move toward the target (buy-only rebalancing, no forced sells)
- Optimize portfolio weights using quantitative models (Efficient Frontier / Sharpe ratio)
- Track performance over time against benchmarks
- Compare multiple allocation scenarios side-by-side

## Positioning

Specifically built around Binance spot holdings as the single source of truth, with a user-defined target allocation config as the north star — so every cash injection is deployed with mathematical precision toward the portfolio the user actually wants, not just spread arbitrarily.

## Operating Context

- User opens the app in a browser on their own machine (personal use, not hosted publicly).
- User enters their Binance read-only API key and secret once; the key is stored in browser local storage.
- The app fetches live balances and prices from Binance REST API.
- Allocation and optimization work happens client-side.
- The tool is used periodically for rebalancing decisions, not as a real-time trading terminal.
- When injecting new cash, user enters the cash amount and the tool produces a buy plan (how much of each asset to purchase).

## Capabilities and Constraints

- **In scope:**
  - Spot holdings only (no futures, margin, or staking unless returned by the Binance spot endpoint)
  - Asset allocation visualization (current vs. target, with drift indicators)
  - **Cash injection calculator:** user enters a new capital amount (USDT or other quote currency); tool calculates buy amounts per asset to bring current allocation as close to target as possible, using only the injected cash — no forced sells required
  - **Target allocation config:** user defines and saves a personal target allocation (e.g. 40% BTC, 30% ETH, 20% BNB, 10% other); config persists in localStorage
  - Portfolio optimization (Efficient Frontier, Sharpe ratio maximization)
  - Performance tracking over time vs. benchmark (e.g. BTC or a custom index)
  - Scenario comparison (e.g. "what if I held 40% BTC instead of 20%?")
- **Out of scope:** Order execution (read-only API key). Non-Binance exchanges. Fiat assets or traditional equities.
- **Constraint:** Binance API CORS — client-side calls to `api.binance.com` may require a CORS proxy or server-side relay in Vite config; this is an open technical decision.
- **Primary theme:** Dark mode.

## Brand Commitments

No external brand commitments. Personal project. Name: "portfoli-allocation" (working title, may be refined).

## Evidence on Hand

No existing screenshots, live data, or design assets. Codebase is a fresh Vite scaffold with Tailwind CSS v4 and DaisyUI v5 installed.

## Product Principles

1. **Real data, not simulations.** Always reflect the user's actual Binance holdings; clearly label any scenario as hypothetical.
2. **Quantitative clarity.** Surface the math (weights, expected return, volatility, Sharpe, injection delta) without hiding it in opaque recommendations.
3. **Target-driven deployment.** Every cash injection is a calculated act — the tool shows exactly how much to buy of what, and by how much that closes the gap to target.
4. **Minimal friction for a solo user.** One API key, one config, one screen — optimized for a user who knows what they want.
5. **Dark-first, finance-grade aesthetic.** The interface should feel like a Bloomberg terminal crossed with modern consumer fintech: precise, dense-but-readable, visually rich.
6. **Privacy by design.** API keys and target config never leave the browser; no server stores user credentials or portfolio data.
