import { useState } from 'react'
import type { AppTab, Asset, TargetAllocation } from '../types'
import { loadTargetAllocation, saveTargetAllocation, loadArchivedAssets, saveArchivedAssets } from '../utils/storage'
import { recalculateAssetTargets } from '../lib/portfolio'
import { DEMO_TARGETS } from '../config/demo'

export function usePortfolioApp() {
  const savedTargets = loadTargetAllocation()
  const initialTargets = Object.keys(savedTargets).length > 0 ? savedTargets : DEMO_TARGETS
  const [targets, setTargets] = useState(initialTargets)
  const [archivedAssets, setArchivedAssets] = useState<Set<string>>(() => loadArchivedAssets())
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const handleTargetsChange = (nextTargets: TargetAllocation, setAssets: React.Dispatch<React.SetStateAction<Asset[]>>) => {
    setTargets(nextTargets); saveTargetAllocation(nextTargets); setAssets(previous => recalculateAssetTargets(previous, nextTargets))
  }
  const handleToggleArchive = (symbol: string) => setArchivedAssets(previous => {
    const next = new Set(previous); if (next.has(symbol)) next.delete(symbol); else next.add(symbol); saveArchivedAssets(next); return next
  })
  const handleTabChange = (tab: AppTab) => { setActiveTab(tab); setMobileSidebarOpen(false) }
  return { targets, setTargets, archivedAssets, activeTab, setActiveTab, sidebarCollapsed, setSidebarCollapsed, mobileSidebarOpen, setMobileSidebarOpen, handleTargetsChange, handleToggleArchive, handleTabChange }
}
