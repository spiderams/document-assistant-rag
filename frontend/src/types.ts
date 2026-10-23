export interface Source {
  ref: number
  document_id: string
  filename: string
  page: number
  quote: string
  verified: boolean
  similarity: number
}

export interface Me {
  id: string
  email: string
  role: 'admin' | 'user'
}

export interface ToolCall {
  tool: string
  input: Record<string, unknown>
  result: string
  ms: number
}

export interface AskResponse {
  question: string
  answer: string
  found: boolean
  sources: Source[]
  // Présents seulement pour les réponses de l'agent (/agent)
  tools_used?: ToolCall[]
  duration_ms?: number
}

export type DocStatus = 'uploaded' | 'indexed' | 'error'

export interface Doc {
  id: string
  filename: string
  page_count: number | null
  status: DocStatus
  error: string | null
  created_at: string
}

export interface UploadResponse {
  id: string
  filename: string
  page_count: number
  pages_with_text: number
  status: DocStatus
  error: string | null
}

export interface IndexResponse {
  id: string
  filename: string
  pages: number
  chunks: number
}
