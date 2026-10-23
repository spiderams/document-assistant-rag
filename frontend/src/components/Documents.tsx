import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import { api } from '../api'
import type { Doc } from '../types'
import type { Dict } from '../i18n'

interface UploadTask {
  name: string
  step: 'import' | 'index' | 'done' | 'error'
  message?: string
}

export default function Documents({ t, isAdmin }: { t: Dict; isAdmin: boolean }) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tasks, setTasks] = useState<UploadTask[]>([])
  const [dragging, setDragging] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    try {
      setDocs(await api.listDocuments())
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  function updateTask(name: string, patch: Partial<UploadTask>) {
    setTasks((ts) => ts.map((t) => (t.name === name ? { ...t, ...patch } : t)))
  }

  async function handleFiles(files: FileList | File[]) {
    const pdfs = Array.from(files).filter((f) => f.name.toLowerCase().endsWith('.pdf'))
    if (pdfs.length === 0) {
      setError(t.onlyPdf)
      return
    }
    setError(null)
    setTasks(pdfs.map((f) => ({ name: f.name, step: 'import' })))

    // Un fichier à la fois : plus simple à suivre et évite de surcharger les API
    for (const file of pdfs) {
      try {
        const doc = await api.uploadDocument(file)
        if (doc.status === 'error') {
          updateTask(file.name, { step: 'error', message: doc.error ?? t.importError })
          continue
        }
        updateTask(file.name, { step: 'index' })
        const idx = await api.indexDocument(doc.id)
        updateTask(file.name, { step: 'done', message: t.doneDetail(doc.page_count, idx.chunks) })
      } catch (e) {
        updateTask(file.name, { step: 'error', message: (e as Error).message })
      }
      await refresh()
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  async function reindex(doc: Doc) {
    setBusyId(doc.id)
    try {
      await api.indexDocument(doc.id)
    } catch (e) {
      setError(`${doc.filename} : ${(e as Error).message}`)
    } finally {
      setBusyId(null)
      refresh()
    }
  }

  async function remove(doc: Doc) {
    if (!confirm(t.confirmDelete(doc.filename))) return
    setBusyId(doc.id)
    try {
      await api.deleteDocument(doc.id)
    } catch (e) {
      setError(`${doc.filename} : ${(e as Error).message}`)
    } finally {
      setBusyId(null)
      refresh()
    }
  }

  const indexed = docs.filter((d) => d.status === 'indexed').length

  return (
    <section className="docs">
      {isAdmin ? (
      <div
        className={dragging ? 'dropzone dragging' : 'dropzone'}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
      >
        <strong>{t.dropTitle}</strong>
        <span className="muted">{t.dropText}</span>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>
      ) : (
        <p className="notice">{t.readOnlyNotice}</p>
      )}

      {tasks.length > 0 && (
        <ul className="tasks">
          {tasks.map((task) => (
            <li key={task.name} className={`task ${task.step}`}>
              <span className="file">{task.name}</span>
              <span>
                {task.step === 'import' && t.importing}
                {task.step === 'index' && t.indexing}
                {task.step === 'done' && `✓ ${task.message}`}
                {task.step === 'error' && `✕ ${task.message}`}
              </span>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="error-text">{error}</p>}

      <div className="docs-head">
        <h2>{t.documents}</h2>
        <span className="muted small">
          {t.indexedCount(indexed, docs.length)}
        </span>
      </div>

      {loading ? (
        <p className="muted">{t.loading}</p>
      ) : docs.length === 0 ? (
        <p className="muted">{t.noDocs}</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t.colFile}</th>
                <th className="num">{t.colPages}</th>
                <th>{t.colStatus}</th>
                <th>{t.colAdded}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id}>
                  <td>
                    <button className="link-btn" onClick={() => api.openFile(d.id).catch((e) => setError((e as Error).message))}>
                      {d.filename}
                    </button>
                    {d.error && <div className="error-text small">{d.error}</div>}
                  </td>
                  <td className="num">{d.page_count ?? '—'}</td>
                  <td>
                    <span className={`status ${d.status}`}>{t.status[d.status]}</span>
                  </td>
                  <td className="muted">{new Date(d.created_at).toLocaleDateString(t.dateLocale)}</td>
                  <td className="actions">
                    {isAdmin && (
                      <>
                    {d.status !== 'indexed' && (
                      <button onClick={() => reindex(d)} disabled={busyId === d.id}>
                        {t.index}
                      </button>
                    )}
                    <button className="danger" onClick={() => remove(d)} disabled={busyId === d.id}>
                      {t.delete}
                    </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
