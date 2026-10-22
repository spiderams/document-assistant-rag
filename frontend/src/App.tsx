import { useEffect, useState } from 'react'
import Chat from './components/Chat'
import Documents from './components/Documents'
import { DICTS, initialLang, saveLang, type Lang } from './i18n'

type Tab = 'chat' | 'docs'

export default function App() {
  const [tab, setTab] = useState<Tab>('chat')
  const [lang, setLang] = useState<Lang>(initialLang)
  const t = DICTS[lang]

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
          <nav className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'chat'} className={tab === 'chat' ? 'tab active' : 'tab'} onClick={() => setTab('chat')}>
              {t.tabAssistant}
            </button>
            <button role="tab" aria-selected={tab === 'docs'} className={tab === 'docs' ? 'tab active' : 'tab'} onClick={() => setTab('docs')}>
              {t.tabDocuments}
            </button>
          </nav>
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
        {/* Le chat reste monté pour garder la conversation en changeant d'onglet */}
        <div hidden={tab !== 'chat'}>
          <Chat t={t} />
        </div>
        {tab === 'docs' && <Documents t={t} />}
      </main>
    </div>
  )
}
