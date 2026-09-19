// ─── Narrative Seed Data ─────────────────────────────────────────────────────
// Static snapshot representing current market narrative landscape.
// Structured to be drop-in replaceable by a live API response.
//
// Signal scoring key (0–100):
//   social      — mention velocity, engagement, unique authors on social platforms
//   market      — price momentum of core assets in the narrative
//   volume      — DEX + CEX trading volume growth
//   onchain     — on-chain activity: transactions, TVL, unique addresses
//   capitalFlow — net capital inflow into narrative assets
//   catalyst    — recent significant protocol launches, integrations, announcements

import type { Narrative } from '../types'

const NOW = Date.now()

export const NARRATIVE_SEED: Narrative[] = [
  {
    id: 'ai-agents',
    name: 'AI Agents',
    emoji: '🤖',
    description: 'Autonomous AI agents operating on-chain, executing transactions, managing protocols, and interacting with DeFi without human intervention.',
    lifecycle: 'growing',
    score: 87,
    score24hChange: 8.2,
    score7dChange: 24.3,
    signals: { social: 92, market: 84, volume: 79, onchain: 71, capitalFlow: 88, catalyst: 91 },
    signalChanges: { social24h: 18, volume24h: 12, capitalFlow7d: 51, onchain7d: 31 },
    assets: ['NEAR', 'FET', 'RNDR', 'GRT', 'OCEAN', 'AGIX'],
    drivers: [
      'Social mentions increased 82% over the past 7 days across X and Farcaster.',
      'DEX trading volume for AI-related tokens surged 64% week-over-week.',
      'On-chain activity grew 31%, driven by agent protocol deployments.',
      'Three major protocols released AI-agent integrations in the past week.',
      'Narrative remains 18% below its 90-day social attention peak — not yet crowded.',
    ],
    updatedAt: NOW,
  },
  {
    id: 'rwa',
    name: 'Real World Assets',
    emoji: '🏦',
    description: 'Tokenization of traditional financial assets including bonds, equities, real estate, and commodities on-chain.',
    lifecycle: 'growing',
    score: 74,
    score24hChange: 3.1,
    score7dChange: 13.2,
    signals: { social: 68, market: 72, volume: 71, onchain: 65, capitalFlow: 82, catalyst: 78 },
    signalChanges: { social24h: 8, volume24h: 11, capitalFlow7d: 35, onchain7d: 22 },
    assets: ['ONDO', 'LINK', 'MKR', 'PAXG'],
    drivers: [
      'Total tokenized RWA on-chain crossed $12B for the first time.',
      'Capital flow into RWA protocols increased 35% over 7 days.',
      'Major TradFi institution announced tokenized treasury product.',
      'Regulatory clarity in Singapore and EU boosting institutional confidence.',
    ],
    updatedAt: NOW,
  },
  {
    id: 'depin',
    name: 'DePIN',
    emoji: '📡',
    description: 'Decentralized Physical Infrastructure Networks — tokenized incentive layers for real-world infrastructure like wireless, compute, energy, and storage.',
    lifecycle: 'growing',
    score: 61,
    score24hChange: 2.2,
    score7dChange: 8.4,
    signals: { social: 58, market: 64, volume: 55, onchain: 62, capitalFlow: 67, catalyst: 61 },
    signalChanges: { social24h: 5, volume24h: 7, capitalFlow7d: 15, onchain7d: 19 },
    assets: ['RNDR', 'HNT', 'FIL', 'AR', 'MOBILE'],
    drivers: [
      'DePIN sector TVL grew 19% on-chain over the past 7 days.',
      'New compute network launched with 40K node operators in week one.',
      'Capital flow positive for 4 consecutive weeks, suggesting sustained interest.',
    ],
    updatedAt: NOW,
  },
  {
    id: 'defi',
    name: 'DeFi',
    emoji: '⚡',
    description: 'Decentralized finance protocols covering lending, borrowing, DEX trading, and yield generation without intermediaries.',
    lifecycle: 'mainstream',
    score: 52,
    score24hChange: 0.8,
    score7dChange: 1.1,
    signals: { social: 48, market: 55, volume: 61, onchain: 58, capitalFlow: 44, catalyst: 47 },
    signalChanges: { social24h: 2, volume24h: 3, capitalFlow7d: -4, onchain7d: 2 },
    assets: ['UNI', 'AAVE', 'MKR', 'CRV', 'LDO', 'SUSHI'],
    drivers: [
      'DeFi TVL stabilizing after Q1 outflows, now at $98B.',
      'DEX volume remains healthy but capital flow is marginally negative.',
      'Narrative is mature — most alpha has been captured by early participants.',
      'Attention is steady but not accelerating. Crowding risk increasing.',
    ],
    updatedAt: NOW,
  },
  {
    id: 'btc-ecosystem',
    name: 'BTC Ecosystem',
    emoji: '₿',
    description: 'Layer-2 and application layers built on Bitcoin — Ordinals, BRC-20, Runes, and EVM-compatible sidechains.',
    lifecycle: 'growing',
    score: 69,
    score24hChange: 4.5,
    score7dChange: 16.8,
    signals: { social: 74, market: 71, volume: 68, onchain: 55, capitalFlow: 76, catalyst: 69 },
    signalChanges: { social24h: 9, volume24h: 14, capitalFlow7d: 28, onchain7d: 12 },
    assets: ['BTC', 'STX', 'ORDI', 'RUNE'],
    drivers: [
      'Bitcoin ETF inflows resumed after 3 weeks of outflows.',
      'Runes protocol transaction volume hit an all-time high.',
      'Capital flow into BTC L2 protocols increased 28% week-over-week.',
      'BTC dominance rising, pulling BTC ecosystem narratives with it.',
    ],
    updatedAt: NOW,
  },
  {
    id: 'lst',
    name: 'Liquid Staking',
    emoji: '💧',
    description: 'Protocols that allow users to stake ETH and other PoS assets while retaining liquidity through derivative tokens.',
    lifecycle: 'mainstream',
    score: 48,
    score24hChange: -1.2,
    score7dChange: -3.8,
    signals: { social: 42, market: 50, volume: 44, onchain: 59, capitalFlow: 41, catalyst: 52 },
    signalChanges: { social24h: -3, volume24h: -2, capitalFlow7d: -11, onchain7d: 4 },
    assets: ['LDO', 'RPL', 'SFRXETH', 'CBETH'],
    drivers: [
      'LST market share stabilized but social attention declining.',
      'Capital outflows from LST protocols for second consecutive week.',
      'Narrative entering crowded phase as yield compression reduces appeal.',
    ],
    updatedAt: NOW,
  },
  {
    id: 'gaming',
    name: 'Gaming & Metaverse',
    emoji: '🎮',
    description: 'Blockchain-native gaming, play-to-earn economies, virtual worlds, and in-game asset ownership.',
    lifecycle: 'cooling',
    score: 34,
    score24hChange: -2.4,
    score7dChange: -12.1,
    signals: { social: 32, market: 28, volume: 31, onchain: 38, capitalFlow: 29, catalyst: 41 },
    signalChanges: { social24h: -8, volume24h: -9, capitalFlow7d: -24, onchain7d: -14 },
    assets: ['AXS', 'SAND', 'MANA', 'ENJ', 'IMX'],
    drivers: [
      'Social mentions dropped 18% week-over-week as user interest shifts to AI.',
      'Capital flow turned negative — 4th consecutive week of outflows.',
      'Several major gaming studios delayed token launches citing market conditions.',
      'On-chain gaming activity declining as bear sentiment persists in the sector.',
    ],
    updatedAt: NOW,
  },
  {
    id: 'privacy',
    name: 'Privacy',
    emoji: '🔐',
    description: 'Privacy-preserving blockchains and zero-knowledge proof systems enabling confidential transactions and computations.',
    lifecycle: 'emerging',
    score: 41,
    score24hChange: 5.8,
    score7dChange: 19.4,
    signals: { social: 44, market: 38, volume: 36, onchain: 48, capitalFlow: 43, catalyst: 38 },
    signalChanges: { social24h: 14, volume24h: 16, capitalFlow7d: 32, onchain7d: 21 },
    assets: ['ZEC', 'XMR', 'SCRT', 'ROSE', 'AZERO'],
    drivers: [
      'Regulatory discussions around financial privacy sparked renewed interest.',
      'New ZK-privacy protocol attracted $40M in funding this week.',
      'On-chain activity growing 21% from a low base — narrative still early.',
      'Social attention accelerating but volume remains modest.',
    ],
    updatedAt: NOW,
  },
  {
    id: 'l1-l2',
    name: 'L1 / L2',
    emoji: '🔷',
    description: 'Layer-1 base chains and Layer-2 scaling solutions competing for developer mindshare, throughput, and fee revenue.',
    lifecycle: 'mainstream',
    score: 55,
    score24hChange: 1.2,
    score7dChange: 2.9,
    signals: { social: 53, market: 58, volume: 62, onchain: 61, capitalFlow: 47, catalyst: 49 },
    signalChanges: { social24h: 1, volume24h: 4, capitalFlow7d: -2, onchain7d: 5 },
    assets: ['ETH', 'SOL', 'AVAX', 'DOT', 'ATOM', 'ARB', 'OP', 'MATIC'],
    drivers: [
      'L2 ecosystem TVL reached $52B, driven by Arbitrum and Base.',
      'Social attention stable but not accelerating — narrative is broadly known.',
      'Fee wars continuing between L2s, compressing protocol revenue.',
    ],
    updatedAt: NOW,
  },
  {
    id: 'meme',
    name: 'Meme Coins',
    emoji: '🐸',
    description: 'Community-driven tokens with viral social dynamics, speculative momentum, and high volatility disconnected from fundamentals.',
    lifecycle: 'cooling',
    score: 29,
    score24hChange: -4.1,
    score7dChange: -18.3,
    signals: { social: 36, market: 22, volume: 38, onchain: 27, capitalFlow: 18, catalyst: 31 },
    signalChanges: { social24h: -12, volume24h: -15, capitalFlow7d: -38, onchain7d: -22 },
    assets: ['DOGE', 'SHIB', 'PEPE', 'WIF', 'BONK'],
    drivers: [
      'Meme coin trading volume fell 38% week-over-week as risk appetite declined.',
      'Capital rotating out of meme coins into AI and BTC ecosystem narratives.',
      'Social mentions dropping significantly — community energy shifting elsewhere.',
    ],
    updatedAt: NOW,
  },
  {
    id: 'interop',
    name: 'Interoperability',
    emoji: '🌉',
    description: 'Cross-chain messaging, bridging infrastructure, and chain-agnostic protocols enabling multi-chain composability.',
    lifecycle: 'emerging',
    score: 46,
    score24hChange: 6.3,
    score7dChange: 21.7,
    signals: { social: 49, market: 44, volume: 42, onchain: 51, capitalFlow: 48, catalyst: 44 },
    signalChanges: { social24h: 11, volume24h: 9, capitalFlow7d: 27, onchain7d: 18 },
    assets: ['LINK', 'AXL', 'DOT', 'ATOM', 'RUNE'],
    drivers: [
      'Cross-chain message volume hit an all-time high this week.',
      'Capital flow into interop protocols up 27% driven by institutional bridging needs.',
      'New CCIP integration announced with 3 major DeFi protocols.',
      'On-chain activity growing steadily — narrative gaining structural traction.',
    ],
    updatedAt: NOW,
  },
  {
    id: 'nft',
    name: 'NFT & Digital Collectibles',
    emoji: '🖼️',
    description: 'Non-fungible tokens, digital art, collectibles, and on-chain provenance — from PFP collections to tokenized IP.',
    lifecycle: 'cooling',
    score: 22,
    score24hChange: -1.8,
    score7dChange: -9.6,
    signals: { social: 24, market: 18, volume: 26, onchain: 29, capitalFlow: 15, catalyst: 21 },
    signalChanges: { social24h: -6, volume24h: -8, capitalFlow7d: -31, onchain7d: -11 },
    assets: ['BLUR', 'APE', 'SAND', 'MANA'],
    drivers: [
      'NFT trading volume on Ethereum at 18-month low.',
      'Capital outflows accelerating — third consecutive quarter of decline.',
      'Social attention at its lowest since 2021 bull run.',
    ],
    updatedAt: NOW,
  },
]

/** Score threshold above which a narrative is considered 'hot'. */
export const HOT_SCORE_THRESHOLD = 70

/** Narrative-to-asset mapping for quick portfolio exposure lookup. */
export const NARRATIVE_ASSET_INDEX: Record<string, string[]> = Object.fromEntries(
  NARRATIVE_SEED.map(n => [n.id, n.assets])
)

/** Scoring weights for the composite narrative score. */
export const NARRATIVE_SCORE_WEIGHTS = {
  social: 0.25,
  market: 0.20,
  volume: 0.20,
  capitalFlow: 0.20,
  onchain: 0.10,
  catalyst: 0.05,
} as const
