import { supabase } from './supabase'
import type { AskResponse, Doc, IndexResponse, Me, UploadResponse } from './types'

const BASE = '/api'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Écouteur appelé quand le serveur répond 401 (session expirée) : l'interface revient à la connexion. */
let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function send(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = { ...(init.headers as Record<string, string> | undefined), ...(await authHeader()) }
  const res = await fetch(BASE + path, { ...init, headers })
  if (!res.ok) {
    let message = `Erreur ${res.status}`
    try {
      const body = await res.json()
      if (body?.detail) message = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
      /* réponse non JSON */
    }
    if (res.status === 401) onUnauthorized?.()
    throw new ApiError(res.status, message)
  }
  return res
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await send(path, init)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const api = {
  me: () => request<Me>('/me'),

  ask: (question: string) => request<AskResponse>('/ask', json({ question })),

  agent: (question: string) => request<AskResponse>('/agent', json({ question })),

  listDocuments: () => request<Doc[]>('/documents'),

  uploadDocument: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<UploadResponse>('/documents', { method: 'POST', body: form })
  },

  indexDocument: (id: string) => request<IndexResponse>(`/documents/${id}/index`, { method: 'POST' }),

  deleteDocument: (id: string) => request<void>(`/documents/${id}`, { method: 'DELETE' }),

  /** Ouvre le PDF dans un nouvel onglet. Un simple lien ne peut pas envoyer le jeton :
   *  on télécharge le fichier avec le jeton, puis on l'affiche. */
  openFile: async (id: string, page?: number) => {
    const tab = window.open('', '_blank') // ouvert tout de suite pour ne pas être bloqué par le navigateur
    try {
      const res = await send(`/documents/${id}/file`)
      const url = URL.createObjectURL(await res.blob())
      const target = page ? `${url}#page=${page}` : url
      if (tab) tab.location.href = target
      else window.location.href = target
    } catch (e) {
      tab?.close()
      throw e
    }
  },
}
