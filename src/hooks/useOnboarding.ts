import { useState } from 'react'
import { saveCredentials } from '../utils/storage'

export function useOnboarding(onComplete: () => void) {
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSecret, setShowSecret] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!apiKey.trim() || !apiSecret.trim()) return
    setLoading(true)
    setError(null)
    const result = await saveCredentials({ apiKey: apiKey.trim(), apiSecret: apiSecret.trim() })
    if (result.ok) onComplete()
    else setError(result.error ?? 'Failed to save credentials.')
    setLoading(false)
  }

  return { apiKey, setApiKey, apiSecret, setApiSecret, loading, error, showSecret, setShowSecret, handleSubmit }
}
