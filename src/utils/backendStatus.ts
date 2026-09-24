// ─── Backend Availability Probe ──────────────────────────────────────────────
// Probes /api/health with a short timeout. Any HTTP response (even 4xx) means
// the server is running. A network-level failure means it's unreachable.

let _probed = false
let _online = false

export async function probeBackend(timeoutMs = 1500): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    // Any status code = server is up; network error = server is down
    await fetch('/api/health', { method: 'HEAD', signal: controller.signal })
    clearTimeout(timer)
    _online = true
  } catch {
    _online = false
  }
  _probed = true
  return _online
}

/** Returns cached result of the last probe (sync). */
export function backendOnline(): boolean {
  return _online
}

/** True once probeBackend() has been called at least once. */
export function backendProbed(): boolean {
  return _probed
}
