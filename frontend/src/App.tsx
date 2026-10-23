import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { api, setUnauthorizedHandler } from './api'
import Chat from './components/Chat'
import Documents from './components/Documents'
import Login from './components/Login'
import { DICTS, initialLang, saveLang, type Lang } from './i18n'
import { supabase } from './supabase'
import type { Me } from './types'

type Tab = 'chat' | 'docs'

export default function App() {
  const [tab, setTab] = useState<Tab>('chat')
  const [lang, setLang] = useState<Lang>(initialLang)
  const t = DICTS[lang]
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [me, setMe] = useState<Me | null>(null)

  // Session Supabase : au chargement, puis à chaque connexion / déconnexion
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    setUnauthorizedHandler(() => supabase.auth.signOut())
    return () => data.subscription.unsubscribe()
  }, [])

  // Rôle de l'utilisateur, fourni par le backend (jamais décidé par l'interface)
  useEffect(() => {
    if (!session) {
      setMe(null)
      return
    }
    api.me().then(setMe).catch(() => setMe(null))
  }, [session?.access_token])

  useEffect(() => {
    document.documentElement.lang = lang
    document.title = t.appTitle
    saveLang(lang)
  }, [lang, t.appTitle])

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden>◆</span>
          <div>
            <strong>{t.appTitle}</strong>
            <span className="muted small">{t.appSubtitle}</span>
          </div>
        </div>
        <div className="topbar-right">
          {session && (
          <nav className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'chat'} className={tab === 'chat' ? 'tab active' : 'tab'} onClick={() => setTab('chat')}>
              {t.tabAssistant}
            </button>
            <button role="tab" aria-selected={tab === 'docs'} className={tab === 'docs' ? 'tab active' : 'tab'} onClick={() => setTab('docs')}>
              {t.tabDocuments}
            </button>
          </nav>
          )}
          {session && (
            <div className="user-menu">
              <span className="small">
                {me?.email ?? session.user.email}
                {me && <span className={`role-badge ${me.role}`}>{me.role === 'admin' ? t.roleAdmin : t.roleUser}</span>}
              </span>
              <button className="link-btn small" onClick={() => supabase.auth.signOut()}>
                {t.signOut}
              </button>
            </div>
          )}
          <div className="lang-switch" role="group" aria-label="Langue / Language">
            {(['fr', 'en'] as Lang[]).map((l) => (
              <button key={l} className={lang === l ? 'active' : ''} aria-pressed={lang === l} onClick={() => setLang(l)}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="content">
        {!ready ? null : !session ? (
          <Login t={t} />
        ) : (
          <>
            {/* Le chat reste monté pour garder la conversation en changeant d'onglet */}
            <div hidden={tab !== 'chat'}>
              <Chat t={t} />
            </div>
            {tab === 'docs' && <Documents t={t} isAdmin={me?.role === 'admin'} />}
          </>
        )}
      </main>
    </div>
  )
}
