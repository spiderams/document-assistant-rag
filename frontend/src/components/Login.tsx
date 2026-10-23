import { useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import type { Dict } from '../i18n'

export default function Login({ t }: { t: Dict }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setError(t.loginError)
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <h1>{t.loginTitle}</h1>
        <p className="muted">{t.loginText}</p>
        <label>
          {t.email}
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          {t.password}
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button className="primary" disabled={busy}>
          {busy ? '…' : t.signIn}
        </button>
      </form>
    </div>
  )
}
