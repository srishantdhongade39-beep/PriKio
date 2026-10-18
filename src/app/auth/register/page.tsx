'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Lock, Eye, EyeOff, User, Printer, AlertTriangle } from 'lucide-react'

export default function Register() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to create an account. Please check your inputs.')
        setLoading(false)
      } else {
        router.push('/upload')
        router.refresh()
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="phone-card">
      <div className="auth-wrapper">
        <div className="auth-header">
          <div className="auth-logo">
            <Printer />
          </div>
          <h1 className="auth-title">Create Account</h1>
          <p className="auth-subtitle">Join the Presidency printing network</p>
        </div>

        <form onSubmit={handleRegister} className="auth-form">
          {error && (
            <div className="auth-error-banner">
              <AlertTriangle />
              <span>{error}</span>
            </div>
          )}

          <div className="auth-input-group">
            <input 
              type="text" 
              placeholder="Full Name" 
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required 
              className="auth-input"
            />
            <User className="auth-icon" />
          </div>

          <div className="auth-input-group">
            <input 
              type="email" 
              placeholder="Student Email Address" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
              className="auth-input"
            />
            <Mail className="auth-icon" />
          </div>

          <div className="auth-input-group">
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="Password (Min. 6 chars)" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
              className="auth-input"
              minLength={6}
            />
            <Lock className="auth-icon" />
            <button 
              type="button" 
              className="auth-eye-btn"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff /> : <Eye />}
            </button>
          </div>

          <button type="submit" disabled={loading} className="auth-btn">
            {loading ? (
              <span className="auth-spinner"></span>
            ) : (
              <>
                <span>Sign Up</span>
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Already have an account? <a href="/auth/login">Login</a>
          </p>
        </div>
      </div>
    </div>
  )
}
