// ─── Onboarding / First-run screen ──────────────────────────────────────────
import { useOnboarding } from '../hooks/useOnboarding'

interface OnboardingProps {
  onComplete: () => void
  onExploreDemo?: () => void
}

export function Onboarding({ onComplete, onExploreDemo }: OnboardingProps) {
  const { apiKey, setApiKey, apiSecret, setApiSecret, loading, error, showSecret, setShowSecret, handleSubmit } = useOnboarding(onComplete)

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'oklch(10% 0.01 240)',
      padding: '2rem',
    }}>
      <div className="fade-up" style={{ maxWidth: 480, width: '100%' }}>
        {/* Logo + title */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'oklch(80% 0.18 85 / 0.12)',
            border: '1px solid oklch(80% 0.18 85 / 0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.5rem',
          }}>
            <svg width="36" height="36" viewBox="0 0 28 28" fill="none">
              <path d="M14 5L9 10h3v4H8v3h4v1l-3 3h10l-3-3v-1h4v-3h-4v-4h3L14 5z" fill="oklch(80% 0.18 85)" />
            </svg>
          </div>
          <h1 style={{
            fontSize: '1.75rem',
            fontWeight: 600,
            color: 'oklch(92% 0.01 240)',
            marginBottom: '0.5rem',
            letterSpacing: '-0.03em',
          }}>
            Portfolio Allocator
          </h1>
          <p style={{ color: 'oklch(55% 0.01 240)', fontSize: '0.9rem', lineHeight: 1.6 }}>
            Connect your Binance account to get started.<br />
            Your credentials are encrypted and stored securely on the server.
          </p>
        </div>

        {/* Form */}
        <div className="surface-card" style={{ padding: '2rem' }}>
          <form id="onboarding-form" onSubmit={handleSubmit}>
            <fieldset className="fieldset" style={{ border: 'none', padding: 0, margin: '0 0 1.25rem' }}>
              <label className="label" htmlFor="onboard-api-key" style={{ color: 'oklch(65% 0.01 240)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500, marginBottom: '0.5rem', display: 'block' }}>
                Binance API Key
              </label>
              <input
                id="onboard-api-key"
                type="text"
                className="input w-full"
                placeholder="Paste your read-only API key"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem' }}
                required
              />
            </fieldset>

            <fieldset className="fieldset" style={{ border: 'none', padding: 0, margin: '0 0 1.75rem' }}>
              <label className="label" htmlFor="onboard-api-secret" style={{ color: 'oklch(65% 0.01 240)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500, marginBottom: '0.5rem', display: 'block' }}>
                API Secret
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="onboard-api-secret"
                  type={showSecret ? 'text' : 'password'}
                  className="input w-full"
                  placeholder="Paste your API secret"
                  value={apiSecret}
                  onChange={e => setApiSecret(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', paddingRight: '3rem' }}
                  required
                />
                <button
                  type="button"
                  id="toggle-secret-visibility"
                  onClick={() => setShowSecret(s => !s)}
                  style={{
                    position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'oklch(50% 0.01 240)', padding: '0.25rem',
                  }}
                  aria-label={showSecret ? 'Hide secret' : 'Show secret'}
                >
                  {showSecret
                    ? <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                    : <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  }
                </button>
              </div>
            </fieldset>

            {error && (
              <div role="alert" className="alert alert-error mb-4" style={{ fontSize: '0.85rem' }}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
              </div>
            )}

            <button
              id="onboarding-submit"
              type="submit"
              className="btn btn-primary w-full"
              disabled={loading || !apiKey || !apiSecret}
            >
              {loading
                ? <><span className="loading loading-spinner loading-sm" />Connecting…</>
                : 'Connect to Binance'
              }
            </button>

            {onExploreDemo && (
              <button
                id="onboarding-demo"
                type="button"
                className="btn btn-ghost w-full mt-2"
                style={{ border: '1px solid oklch(100% 0 0 / 0.1)', color: 'oklch(75% 0.01 240)', fontSize: '0.82rem' }}
                onClick={onExploreDemo}
              >
                ⚡ Explore Demo Portfolio (No API Key Required)
              </button>
            )}
          </form>

          {/* Security note */}
          <div style={{
            marginTop: '1.5rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid oklch(100% 0 0 / 0.07)',
            display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="oklch(68% 0.18 150)" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
            <p style={{ fontSize: '0.78rem', color: 'oklch(50% 0.01 240)', lineHeight: 1.5, margin: 0 }}>
              Credentials are validated by Binance and saved encrypted in your local SQLite database on the server.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
