import { useEffect, useMemo, useRef, useState } from 'react'
import type { ApiCredentials, Asset, TargetAllocation, CurrencyCode } from '../types'
import { saveCredentials, saveTargetAllocation, clearCredentials } from '../utils/storage'
import { testBinanceConnection } from '../services/api'
import { useAuth } from '../components/AuthGate'

const POPULAR_COINS = ['BTC', 'ETH', 'SOL', 'BNB', 'DOGE', 'XRP', 'ADA', 'AVAX', 'DOT', 'LINK', 'MATIC', 'LTC', 'ATOM', 'UNI', 'NEAR', 'APT', 'ARB', 'OP', 'FDUSD', 'USDT', 'USDC', 'FUTURES_USDT', 'OTHER']

export function useSettings({ credentials, targets, assets, prices, currency, rates, onCredentialsChange, onTargetsChange, onRefreshRates }: {
  credentials: ApiCredentials | null; targets: TargetAllocation; assets: Asset[]; prices: Record<string, number>; currency: CurrencyCode; rates: Record<string, number>
  onCredentialsChange: (credentials: ApiCredentials | null) => void
  onTargetsChange: (targets: TargetAllocation) => void
  onRefreshRates: () => Promise<void>
}) {
  const [apiKey, setApiKey] = useState(credentials?.apiKey ?? '')
  const [apiSecret, setApiSecret] = useState(credentials?.apiSecret ?? '')
  const [showSecret, setShowSecret] = useState(false)
  const [testing, setTesting] = useState(false)
  const [savingCredentials, setSavingCredentials] = useState(false)
  const [credentialsMessage, setCredentialsMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null)
  const [testError, setTestError] = useState<string | null>(null)
  const [refreshingRates, setRefreshingRates] = useState(false)
  const [rateRefreshSuccess, setRateRefreshSuccess] = useState(false)
  const [currentPass, setCurrentPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [passLoading, setPassLoading] = useState(false)
  const [passMsg, setPassMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [localTargets, setLocalTargets] = useState<TargetAllocation>(() => ({ ...targets }))
  const [searchTerm, setSearchTerm] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { logout, updatePassword } = useAuth()

  useEffect(() => setLocalTargets({ ...targets }), [targets])
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const targetSum = Object.values(localTargets).reduce((sum, value) => sum + value, 0)
  const targetValid = Math.abs(targetSum - 100) < 0.5
  const coinOptions = useMemo(() => {
    const symbols = new Map<string, { symbol: string; price?: number }>()
    POPULAR_COINS.forEach(symbol => symbols.set(symbol, { symbol }))
    assets.forEach(asset => symbols.set(asset.symbol, { symbol: asset.symbol, price: asset.price }))
    Object.keys(prices).forEach(pair => {
      if (pair.endsWith('USDT')) {
        const symbol = pair.replace(/USDT$/, '').toUpperCase()
        if (symbol && !symbols.has(symbol)) symbols.set(symbol, { symbol, price: prices[pair] })
      }
    })
    symbols.forEach((item, symbol) => {
      if (item.price === undefined) item.price = ['USDT', 'USDC', 'FDUSD', 'FUTURES_USDT'].includes(symbol) ? 1 : prices[symbol] ?? prices[`${symbol}USDT`]
    })
    return [...symbols.values()].sort((a, b) => {
      const aTarget = localTargets[a.symbol] !== undefined
      const bTarget = localTargets[b.symbol] !== undefined
      if (aTarget !== bTarget) return aTarget ? -1 : 1
      return a.symbol.localeCompare(b.symbol)
    })
  }, [assets, prices, localTargets])
  const filteredCoins = useMemo(() => {
    const term = searchTerm.trim().toUpperCase()
    return term ? coinOptions.filter(coin => coin.symbol.includes(term)) : coinOptions
  }, [coinOptions, searchTerm])

  const handleTestConnection = async () => {
    setTesting(true); setTestResult(null); setTestError(null)
    const result = await testBinanceConnection(apiKey.trim(), apiSecret.trim())
    setTestResult(result.ok ? 'ok' : 'fail')
    if (!result.ok) setTestError(result.error ?? 'Connection failed')
    setTesting(false)
  }
  const handleSaveCredentials = async () => {
    setSavingCredentials(true); setCredentialsMessage(null)
    const result = await saveCredentials({ apiKey: apiKey.trim(), apiSecret: apiSecret.trim() })
    if (result.ok) {
      setApiKey(''); setApiSecret(''); setTestResult(null)
      setCredentialsMessage({ type: 'ok', text: 'API credentials berhasil disimpan dan dienkripsi.' })
      onCredentialsChange({ apiKey: '', apiSecret: '' })
    } else setCredentialsMessage({ type: 'error', text: result.error || 'Gagal menyimpan API credentials.' })
    setSavingCredentials(false)
  }
  const handleDisconnect = async () => {
    if (!confirm('Remove your API key from this server?')) return
    const removed = await clearCredentials()
    if (!removed) { setCredentialsMessage({ type: 'error', text: 'Gagal menghapus API credentials.' }); return }
    setApiKey(''); setApiSecret(''); setCredentialsMessage(null); onCredentialsChange(null)
  }
  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault(); if (!currentPass || !newPass) return
    setPassLoading(true); setPassMsg(null)
    const result = await updatePassword(currentPass, newPass)
    if (result.ok) { setPassMsg({ type: 'ok', text: 'Password berhasil diubah!' }); setCurrentPass(''); setNewPass('') }
    else setPassMsg({ type: 'err', text: result.error || 'Gagal mengubah password' })
    setPassLoading(false)
  }
  const handleTargetChange = (symbol: string, value: string) => {
    const number = parseFloat(value); if (!isNaN(number) && number >= 0) setLocalTargets(previous => ({ ...previous, [symbol]: number }))
  }
  const handleRemoveTarget = (symbol: string) => setLocalTargets(previous => { const next = { ...previous }; delete next[symbol]; return next })
  const handleSelectCoin = (symbol: string) => {
    const normalized = symbol.trim().toUpperCase(); if (!normalized) return
    if (localTargets[normalized] === undefined) setLocalTargets(previous => ({ ...previous, [normalized]: 0 }))
    setSearchTerm(''); setDropdownOpen(false)
  }
  const handleSaveTargets = () => {
    const cleaned: TargetAllocation = {}
    Object.entries(localTargets).forEach(([symbol, value]) => { if (value > 0) cleaned[symbol] = value })
    saveTargetAllocation(cleaned); onTargetsChange(cleaned)
  }
  const handleAutoPopulate = () => {
    const populated: TargetAllocation = {}
    assets.forEach(asset => { if (!localTargets[asset.symbol]) populated[asset.symbol] = parseFloat(asset.currentPct.toFixed(1)) })
    setLocalTargets(previous => ({ ...previous, ...populated }))
  }
  const handleRefreshFx = async () => {
    setRefreshingRates(true); setRateRefreshSuccess(false)
    try { await onRefreshRates(); setRateRefreshSuccess(true); setTimeout(() => setRateRefreshSuccess(false), 3000) }
    finally { setRefreshingRates(false) }
  }

  return { apiKey, setApiKey, apiSecret, setApiSecret, showSecret, setShowSecret, testing, savingCredentials, credentialsMessage, testResult, testError, refreshingRates, rateRefreshSuccess, activeRate: rates[currency] ?? 1, logout, currentPass, setCurrentPass, newPass, setNewPass, passLoading, passMsg, localTargets, searchTerm, setSearchTerm, dropdownOpen, setDropdownOpen, dropdownRef, targetSum, targetValid, filteredCoins, handleTestConnection, handleSaveCredentials, handleDisconnect, handleChangePassword, handleTargetChange, handleRemoveTarget, handleSelectCoin, handleSaveTargets, handleAutoPopulate, handleRefreshFx }
}
