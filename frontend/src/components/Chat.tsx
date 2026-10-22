import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { api } from '../api'
import type { AskResponse, Source } from '../types'
import type { Dict } from '../i18n'

interface Turn {
  id: number
  question: string
  response?: AskResponse
  error?: string
}

export default function Chat({ t }: { t: Dict }) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const nextId = useRef(1)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turns])

  async function ask(question: string) {
    const q = question.trim()
    if (!q || busy) return
    const id = nextId.current++
    setTurns((t) => [...t, { id, question: q }])
    setInput('')
    setBusy(true)
    try {
      const response = await api.ask(q)
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, response } : x)))
    } catch (e) {
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, error: (e as Error).message } : x)))
    } finally {
      setBusy(false)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    ask(input)
  }

  return (
    <section className="chat">
      {turns.length === 0 && (
        <div className="empty-state">
          <h1>{t.emptyTitle}</h1>
          <p className="muted">{t.emptyText}</p>
          <div className="examples">
            {t.examples.map((ex) => (
              <button key={ex} className="chip" onClick={() => ask(ex)}>
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="turns">
        {turns.map((turn) => (
          <article key={turn.id} className="turn">
            <div className="bubble question">{turn.question}</div>
            {!turn.response && !turn.error && <div className="bubble answer loading">{t.searching}</div>}
            {turn.error && <div className="bubble answer error">{t.error} : {turn.error}</div>}
            {turn.response && <Answer response={turn.response} t={t} />}
          </article>
        ))}
        <div ref={endRef} />
      </div>

      <form className="composer" onSubmit={submit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t.placeholder}
          aria-label={t.inputLabel}
          disabled={busy}
        />
        <button className="primary" disabled={busy || !input.trim()}>
          {busy ? '…' : t.ask}
        </button>
      </form>
    </section>
  )
}

function Answer({ response, t }: { response: AskResponse; t: Dict }) {
  const [active, setActive] = useState<number | null>(response.sources[0]?.ref ?? null)

  if (!response.found) {
    return (
      <div className="bubble answer not-found">
        <strong>{t.notFound}</strong> {response.answer}
      </div>
    )
  }

  return (
    <div className="bubble answer">
      <p className="answer-text">{renderWithCitations(response.answer, response.sources, active, setActive, t.seeSource)}</p>
      {response.sources.length > 0 && (
        <div className="sources">
          {response.sources.map((s) => (
            <SourceCard key={s.ref} source={s} active={active === s.ref} onSelect={() => setActive(s.ref)} t={t} />
          ))}
        </div>
      )}
    </div>
  )
}

function renderWithCitations(
  text: string,
  sources: Source[],
  active: number | null,
  onSelect: (ref: number) => void,
  title: string,
): ReactNode[] {
  const known = new Set(sources.map((s) => s.ref))
  return text.split(/(\[\d+\])/g).map((part, i) => {
    const m = part.match(/^\[(\d+)\]$/)
    if (!m) return part
    const ref = Number(m[1])
    if (!known.has(ref)) return part
    return (
      <button
        key={i}
        className={active === ref ? 'cite active' : 'cite'}
        onClick={() => onSelect(ref)}
        title={title}
      >
        {ref}
      </button>
    )
  })
}

function SourceCard({ source, active, onSelect, t }: { source: Source; active: boolean; onSelect: () => void; t: Dict }) {
  return (
    <div className={active ? 'source active' : 'source'} onClick={onSelect}>
      <div className="source-head">
        <span className="ref">{source.ref}</span>
        <span className="file">{source.filename}</span>
        <span className="page">{t.page} {source.page}</span>
        {source.verified ? (
          <span className="badge ok" title={t.verifiedTitle}>
            {t.verified}
          </span>
        ) : (
          <span className="badge warn" title={t.notVerifiedTitle}>
            {t.notVerified}
          </span>
        )}
      </div>
      {active && (
        <>
          <blockquote>“{source.quote}”</blockquote>
          <a
            className="open-pdf"
            href={api.fileUrl(source.document_id, source.page)}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            {t.openPdf(source.page)}
          </a>
        </>
      )}
    </div>
  )
}
