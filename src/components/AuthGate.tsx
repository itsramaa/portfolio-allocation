import { createContext, useContext, type ReactNode } from 'react'
import { useAuthGate } from '../hooks/useAuthGate'

interface AuthContextType {
  isAuthenticated: boolean
  offlineMode: boolean
  logout: () => void
  updatePassword: (current: string, next: string) => Promise<{ ok: boolean; error?: string }>
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  offlineMode: false,
  logout: () => {},
  updatePassword: async () => ({ ok: false, error: 'Not implemented' }),
})

export function useAuth() {
  return useContext(AuthContext)
}

interface AuthGateProps {
  children: ReactNode
}

export function AuthGate({ children }: AuthGateProps) {
  const {
    isAuthenticated, offlineMode, password, setPassword, showPassword, setShowPassword,
    loading, error, handleLogin, logout, updatePassword,
  } = useAuthGate()

  // Initial checking state
  if (isAuthenticated === null) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'oklch(10% 0.01 240)',
          color: 'oklch(80% 0.01 240)',
          gap: '1rem',
        }}
      >
        <span className="loading loading-bars loading-lg text-warning" />
        <span style={{ fontSize: '0.88rem', color: 'oklch(60% 0.01 240)' }}>
          Verifikasi autentikasi…
        </span>
      </div>
    )
  }

  // Not authenticated: render password prompt
  if (!isAuthenticated) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(ellipse at 50% 20%, oklch(18% 0.04 85 / 0.3) 0%, oklch(10% 0.01 240) 70%)',
          padding: '1.5rem',
        }}
      >
        <div
          className="fade-up"
          style={{
            maxWidth: 420,
            width: '100%',
            background: 'oklch(14% 0.015 240)',
            border: '1px solid oklch(100% 0 0 / 0.1)',
            borderRadius: '1rem',
            padding: '2.5rem 2rem',
            boxShadow: '0 20px 45px -15px rgba(0, 0, 0, 0.7), 0 0 30px -10px rgba(240, 185, 11, 0.1)',
          }}
        >
          {/* Header & Logo */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: '1rem',
                background: 'linear-gradient(135deg, rgba(240,185,11,0.2) 0%, rgba(240,185,11,0.05) 100%)',
                border: '1px solid rgba(240, 185, 11, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem',
                color: '#F0B90B',
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </div>
            <h1
              style={{
                fontSize: '1.45rem',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: 'oklch(95% 0.01 240)',
                marginBottom: '0.35rem',
              }}
            >
              Portfolio Access
            </h1>
            <p style={{ fontSize: '0.82rem', color: 'oklch(60% 0.01 240)' }}>
              Masukkan password untuk membuka portfolio
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label
                htmlFor="auth-password"
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'oklch(65% 0.01 240)',
                  marginBottom: '0.5rem',
                }}
              >
                Password
              </label>

              <div style={{ position: 'relative' }}>
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  className="input w-full mono"
                  placeholder="Masukkan password…"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoFocus
                  required
                  style={{
                    background: 'oklch(18% 0.015 240)',
                    border: '1px solid oklch(100% 0 0 / 0.12)',
                    paddingRight: '3rem',
                    fontSize: '0.95rem',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  tabIndex={-1}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'oklch(55% 0.01 240)',
                    cursor: 'pointer',
                    padding: '0.25rem',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title={showPassword ? 'Sembunyikan' : 'Perlihatkan'}
                >
                  {showPassword ? (
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>

              <div
                style={{
                  marginTop: '0.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.72rem',
                }}
              >
                <span style={{ color: 'oklch(50% 0.01 240)' }}>
                  Default password:{' '}
                  <button
                    type="button"
                    onClick={() => setPassword('132456')}
                    className="mono font-semibold"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#F0B90B',
                      cursor: 'pointer',
                      padding: 0,
                      textDecoration: 'underline',
                    }}
                  >
                    132456
                  </button>
                </span>
              </div>
            </div>

            {error && (
              <div
                style={{
                  padding: '0.65rem 0.9rem',
                  borderRadius: '0.5rem',
                  background: 'oklch(25% 0.08 25 / 0.4)',
                  border: '1px solid oklch(60% 0.2 25 / 0.5)',
                  color: '#f87171',
                  fontSize: '0.78rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="btn btn-warning w-full font-bold"
              style={{
                background: '#F0B90B',
                color: '#181a20',
                border: 'none',
                height: '2.75rem',
                fontSize: '0.92rem',
              }}
            >
              {loading ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  Membuka…
                </>
              ) : (
                'Buka Portfolio'
              )}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        offlineMode,
        logout,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
