// ─── Sidebar Navigation ──────────────────────────────────────────────────────
import type { AppTab, ConnectionStatus } from '../types'

const NAV_ITEMS: Array<{ id: AppTab; label: string; icon: string }> = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: `<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25V18z"/></svg>`
  },
  {
    id: 'inject',
    label: 'Inject Cash',
    icon: `<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>`
  },
  {
    id: 'rebalance',
    label: 'Rebalance',
    icon: `<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"/></svg>`
  },
  {
    id: 'history',
    label: 'History',
    icon: `<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
  },
  {
    id: 'narrative',
    label: 'Narratives',
    icon: `<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6.75v6.75"/></svg>`
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: `<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`
  },
]


interface SidebarProps {
  activeTab: AppTab
  onTabChange: (tab: AppTab) => void
  connectionStatus: ConnectionStatus
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen?: boolean
}

export function Sidebar({ activeTab, onTabChange, connectionStatus, collapsed, onToggleCollapse, mobileOpen }: SidebarProps) {
  const statusColor = {
    connected: '#22c55e',
    error: '#ef4444',
    loading: '#F0B90B',
    unconfigured: '#848E9C',
  }[connectionStatus]

  const statusLabel = {
    connected: 'Connected',
    error: 'API Error',
    loading: 'Connecting…',
    unconfigured: 'No API Key',
  }[connectionStatus]

  return (
    <aside
      id="sidebar-nav"
      className={mobileOpen ? 'mobile-open' : ''}
      style={{
        width: collapsed ? 68 : 240,
        height: '100vh',
        background: 'oklch(11% 0.012 240)',
        borderRight: '1px solid oklch(100% 0 0 / 0.07)',
        display: 'flex',
        flexDirection: 'column',
        padding: collapsed ? '1.25rem 0.5rem' : '1.25rem 1rem',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 50,
        transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1), padding 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        overflowX: 'hidden',
      }}
    >
      {/* Header section with Logo & Collapse Toggle */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        marginBottom: '1.75rem',
        paddingBottom: '0.75rem',
        borderBottom: '1px solid oklch(100% 0 0 / 0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '0.375rem',
            background: 'oklch(80% 0.18 85 / 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
              <path d="M14 5L9 10h3v4H8v3h4v1l-3 3h10l-3-3v-1h4v-3h-4v-4h3L14 5z" fill="#F0B90B" />
            </svg>
          </div>

          {!collapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#F0B90B', whiteSpace: 'nowrap' }}>
                BINANCE
              </span>
              <span style={{ fontSize: '0.68rem', color: 'oklch(55% 0.01 240)', letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                Portfolio & Cash
              </span>
            </div>
          )}
        </div>

        {/* Collapse toggle button */}
        <button
          type="button"
          id="toggle-sidebar-collapse"
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'oklch(55% 0.01 240)',
            cursor: 'pointer',
            padding: '0.35rem',
            borderRadius: '0.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.15s, background 0.15s',
          }}
          className="hover:text-white"
        >
          {collapsed ? (
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          ) : (
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          )}
        </button>
      </div>

      {/* Nav items list */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1 }}>
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            id={`nav-${item.id}`}
            onClick={() => onTabChange(item.id)}
            className={`nav-item ${collapsed ? 'collapsed' : 'expanded'} ${activeTab === item.id ? 'active' : ''}`}
            title={collapsed ? item.label : undefined}
            aria-label={item.label}
            aria-current={activeTab === item.id ? 'page' : undefined}
          >
            <span style={{ display: 'inline-flex', flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: item.icon }} />
            {!collapsed && (
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.label}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Connection status card at bottom */}
      <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid oklch(100% 0 0 / 0.05)' }}>
        <button
          id="nav-connection-status"
          onClick={() => onTabChange('settings')}
          title={`Connection status: ${statusLabel}. Click to manage settings.`}
          aria-label={`Connection status: ${statusLabel}`}
          style={{
            width: '100%',
            background: 'oklch(14% 0.012 240)',
            border: '1px solid oklch(100% 0 0 / 0.06)',
            borderRadius: '0.375rem',
            padding: collapsed ? '0.6rem' : '0.65rem 0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: '0.65rem',
            cursor: 'pointer',
            textAlign: 'left',
            color: 'inherit',
          }}
        >
          <span style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: statusColor,
            boxShadow: connectionStatus === 'connected' ? `0 0 8px ${statusColor}` : 'none',
            flexShrink: 0,
            display: 'block',
          }} />
          {!collapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'oklch(85% 0.01 240)', whiteSpace: 'nowrap' }}>
                {statusLabel}
              </span>
              <span style={{ fontSize: '0.68rem', color: 'oklch(50% 0.01 240)', whiteSpace: 'nowrap' }}>
                Binance Spot
              </span>
            </div>
          )}
        </button>
      </div>
    </aside>
  )
}
