// ─── Local Demo Data (offline / no-backend fallback) ─────────────────────────
// Used when the Go backend is unreachable. Mirrors the shape of the backend
// API responses so the rest of the app works without modification.
import type { PortfolioSyncResponse, NarrativesReportResponse } from '../services/api'

const NOW = Date.now()

// Total portfolio: ~22 280 USDT across 5 assets
export function getLocalDemoPortfolio(): PortfolioSyncResponse {
  return {
    status: 'connected',
    isDemo: true,
    totalUSDT: 22280,
    btcPrice: 62000,
    lastRefreshed: NOW,
    prices: {
      BTCUSDT: 62000,
      ETHUSDT: 2450,
      BNBUSDT: 580,
      SOLUSDT: 145,
      NEARUSDT: 5.1,
    },
    assets: [
      {
        symbol: 'BTC', name: 'Bitcoin',
        amount: 0.15, price: 62000, value: 9300,
        currentPct: 41.74, targetPct: 40,
        targetValue: 8912, diff: 388, diffPct: 1.74,
        action: 'SELL', drift: 1.74,
      },
      {
        symbol: 'ETH', name: 'Ethereum',
        amount: 2.1, price: 2450, value: 5145,
        currentPct: 23.09, targetPct: 25,
        targetValue: 5570, diff: -425, diffPct: -1.91,
        action: 'BUY', drift: -1.91,
      },
      {
        symbol: 'BNB', name: 'BNB',
        amount: 8, price: 580, value: 4640,
        currentPct: 20.83, targetPct: 20,
        targetValue: 4456, diff: 184, diffPct: 0.83,
        action: 'HOLD', drift: 0.83,
      },
      {
        symbol: 'SOL', name: 'Solana',
        amount: 15, price: 145, value: 2175,
        currentPct: 9.76, targetPct: 10,
        targetValue: 2228, diff: -53, diffPct: -0.24,
        action: 'HOLD', drift: -0.24,
      },
      {
        symbol: 'NEAR', name: 'NEAR Protocol',
        amount: 200, price: 5.1, value: 1020,
        currentPct: 4.58, targetPct: 5,
        targetValue: 1114, diff: -94, diffPct: -0.42,
        action: 'BUY', drift: -0.42,
      },
    ],
  }
}

export function getLocalDemoNarratives(): NarrativesReportResponse {
  const sig = (score: number, c24: number, c7: number) => ({
    score, available: true, confidence: 0.75,
    change24h: c24, change7d: c7,
    sources: ['demo'],
  })

  return {
    topNarrative: 'ai-depin',
    coveredCount: 2,
    totalNarratives: 6,
    diversificationScore: 45,
    marketSentiment: {
      value: 62, classification: 'Greed',
      available: true, source: 'demo', updatedAt: NOW,
    },
    narratives: [
      {
        id: 'ai-depin',
        name: 'AI & DePIN',
        emoji: '🤖',
        description: 'Convergence of AI infrastructure and decentralized physical networks driving compute demand.',
        lifecycle: 'emerging',
        score: 78, score24hChange: 4.2, score7dChange: 18.5,
        signals: {
          social:      sig(82, 5.1, 20),
          market:      sig(71, 2.3, 12),
          volume:      sig(79, 6.4, 22),
          onchain:     sig(68, 3.1, 14),
          capitalFlow: sig(85, 7.2, 25),
          catalyst:    sig(74, 3.5, 18),
        },
        signalChanges: { social24h: 5.1, volume24h: 6.4, capitalFlow7d: 25, onchain7d: 14 },
        assets: ['FET', 'RENDER', 'TAO', 'NEAR', 'AR'],
        drivers: [
          'Major AI labs partnering with blockchain networks for decentralized compute',
          'GPU rental demand surging as AI training costs rise',
          'New DePIN protocols launching with significant VC backing',
        ],
        updatedAt: NOW,
        heldAssets: ['NEAR'], heldAllocation: 4.58, heldValueUSDT: 1020,
      },
      {
        id: 'btc-ecosystem',
        name: 'Bitcoin Ecosystem',
        emoji: '₿',
        description: 'Layer 2 solutions, Ordinals, and new protocols building on top of the Bitcoin base layer.',
        lifecycle: 'growing',
        score: 69, score24hChange: 2.1, score7dChange: 7.8,
        signals: {
          social:      sig(72, 2.5,  9),
          market:      sig(68, 1.8,  7),
          volume:      sig(65, 2.0,  8),
          onchain:     sig(71, 2.3,  8),
          capitalFlow: sig(69, 2.1,  7),
          catalyst:    sig(70, 2.0,  8),
        },
        signalChanges: { social24h: 2.5, volume24h: 2.0, capitalFlow7d: 7, onchain7d: 8 },
        assets: ['BTC', 'STX', 'ORDI', 'RUNE'],
        drivers: [
          'Institutional BTC accumulation accelerating post-ETF approval',
          'Ordinals inscriptions reaching new milestones',
          'Lightning Network capacity growing steadily',
        ],
        updatedAt: NOW,
        heldAssets: ['BTC'], heldAllocation: 41.74, heldValueUSDT: 9300,
      },
      {
        id: 'rwa',
        name: 'Real World Assets',
        emoji: '🏦',
        description: 'Tokenization of bonds, real estate, and commodities gaining institutional traction.',
        lifecycle: 'growing',
        score: 72, score24hChange: 1.8, score7dChange: 9.2,
        signals: {
          social:      sig(68, 1.5,  8),
          market:      sig(76, 2.1, 10),
          volume:      sig(71, 1.8,  9),
          onchain:     sig(74, 2.0, 11),
          capitalFlow: sig(78, 2.5, 12),
          catalyst:    sig(65, 1.2,  6),
        },
        signalChanges: { social24h: 1.5, volume24h: 1.8, capitalFlow7d: 12, onchain7d: 11 },
        assets: ['ONDO', 'MKR', 'LINK', 'POLY'],
        drivers: [
          'BlackRock BUIDL fund surpassing $500M in tokenized treasuries',
          'Growing institutional demand for on-chain yield products',
          'Regulatory clarity improving in key markets',
        ],
        updatedAt: NOW,
        heldAssets: [], heldAllocation: 0, heldValueUSDT: 0,
      },
      {
        id: 'layer2',
        name: 'Ethereum Layer 2',
        emoji: '⚡',
        description: 'Scaling solutions on Ethereum capturing increasing transaction volume and developer activity.',
        lifecycle: 'mainstream',
        score: 64, score24hChange: 0.5, score7dChange: -2.1,
        signals: {
          social:      sig(62,  0.3, -3),
          market:      sig(65,  0.6, -2),
          volume:      sig(68,  0.8, -1),
          onchain:     sig(63,  0.4, -2),
          capitalFlow: sig(62,  0.5, -3),
          catalyst:    sig(66,  0.4, -1),
        },
        signalChanges: { social24h: 0.3, volume24h: 0.8, capitalFlow7d: -3, onchain7d: -2 },
        assets: ['ARB', 'OP', 'MATIC', 'IMX'],
        drivers: [
          'Total L2 TVL stable above $40B despite broader market consolidation',
          'EIP-4844 blob transactions keeping fees low',
          'Competition from new rollup frameworks increasing',
        ],
        updatedAt: NOW,
        heldAssets: [], heldAllocation: 0, heldValueUSDT: 0,
      },
      {
        id: 'defi',
        name: 'DeFi Revival',
        emoji: '🌊',
        description: 'Decentralized finance protocols seeing renewed interest with improved UX and real yield.',
        lifecycle: 'mainstream',
        score: 58, score24hChange: -0.8, score7dChange: 1.2,
        signals: {
          social:      sig(55, -1.0, 1),
          market:      sig(60, -0.5, 2),
          volume:      sig(58, -0.8, 1),
          onchain:     sig(62, -0.6, 2),
          capitalFlow: sig(56, -1.0, 1),
          catalyst:    sig(57, -0.8, 1),
        },
        signalChanges: { social24h: -1.0, volume24h: -0.8, capitalFlow7d: 1, onchain7d: 2 },
        assets: ['UNI', 'AAVE', 'CRV', 'MKR', 'COMP'],
        drivers: [
          'Total DeFi TVL recovering, approaching $100B again',
          'New yield strategies attracting capital from TradFi',
          'Regulatory uncertainty still weighing on sentiment',
        ],
        updatedAt: NOW,
        heldAssets: [], heldAllocation: 0, heldValueUSDT: 0,
      },
      {
        id: 'gamefi',
        name: 'GameFi & Metaverse',
        emoji: '🎮',
        description: 'Blockchain gaming projects facing headwinds as user retention remains challenging.',
        lifecycle: 'cooling',
        score: 32, score24hChange: -1.5, score7dChange: -8.4,
        signals: {
          social:      sig(30, -2.0, -10),
          market:      sig(35, -1.2,  -8),
          volume:      sig(28, -1.8,  -9),
          onchain:     sig(34, -1.5,  -8),
          capitalFlow: sig(30, -1.6,  -9),
          catalyst:    sig(35, -1.0,  -6),
        },
        signalChanges: { social24h: -2.0, volume24h: -1.8, capitalFlow7d: -9, onchain7d: -8 },
        assets: ['AXS', 'SAND', 'MANA', 'GALA'],
        drivers: [
          'Daily active users declining across major GameFi platforms',
          'Token inflation eroding play-to-earn economics',
          'Institutional capital rotating out to AI narratives',
        ],
        updatedAt: NOW,
        heldAssets: [], heldAllocation: 0, heldValueUSDT: 0,
      },
    ],
  }
}
