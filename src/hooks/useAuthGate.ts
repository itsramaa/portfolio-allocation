import { useEffect, useState } from 'react'
import { checkAuth, login, clearAuthToken, changePassword } from '../services/api'
import { initStorageFromBackend } from '../utils/storage'
import { initCurrencyFromBackend } from '../utils/currency'

export function useAuthGate() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const verify = async () => {
      const ok = await checkAuth()
      if (ok) {
        await Promise.all([initStorageFromBackend(), initCurrencyFromBackend()])
      }
      setIsAuthenticated(ok)
    }
    void verify()
  }, [])

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!password.trim()) return
    setLoading(true)
    setError(null)
    const result = await login(password.trim())
    if (result.success) {
      await Promise.all([initStorageFromBackend(), initCurrencyFromBackend()])
      setIsAuthenticated(true)
    } else {
      setError(result.error || 'Password salah. Password bawaan: 132456')
    }
    setLoading(false)
  }

  const logout = () => {
    clearAuthToken()
    setIsAuthenticated(false)
    setPassword('')
  }

  return {
    isAuthenticated, password, setPassword, showPassword, setShowPassword,
    loading, error, handleLogin, logout,
    updatePassword: (current: string, next: string) => changePassword(current, next),
  }
}
