import type { AskResponse, Doc, IndexResponse, UploadResponse } from './types'

const BASE = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, init)
  if (!res.ok) {
    let message = `Erreur ${res.status}`
    try {
      const body = await res.json()
      if (body?.detail) message = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
      /* réponse non JSON */
    }
    throw new Error(message)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const api = {
  ask: (question: string) =>
    request<AskResponse>('/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    }),

  listDocuments: () => request<Doc[]>('/documents'),

  uploadDocument: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<UploadResponse>('/documents', { method: 'POST', body: form })
  },

  indexDocument: (id: string) => request<IndexResponse>(`/documents/${id}/index`, { method: 'POST' }),

  deleteDocument: (id: string) => request<void>(`/documents/${id}`, { method: 'DELETE' }),

  fileUrl: (id: string, page?: number) => `${BASE}/documents/${id}/file${page ? `#page=${page}` : ''}`,
}
