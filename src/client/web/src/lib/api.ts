import type { DatabaseContent, Diagram, DiagramKind, DiagramSummary } from '../types'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch('/api' + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`
    try {
      const body = await res.json()
      if (body?.error) msg = body.error
    } catch {
      // non-JSON error body
    }
    throw new ApiError(res.status, msg)
  }
  return (res.status === 204 ? undefined : await res.json()) as T
}

export interface DiagramInput {
  name: string
  kind: DiagramKind
  content: DatabaseContent
}

export const api = {
  health: () => request<{ status: string; version: string }>('/health', { signal: AbortSignal.timeout(2000) }),
  list: () => request<DiagramSummary[]>('/diagrams'),
  get: (id: string) => request<Diagram>(`/diagrams/${encodeURIComponent(id)}`),
  create: (input: DiagramInput) => request<Diagram>('/diagrams', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: DiagramInput) =>
    request<Diagram>(`/diagrams/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) }),
  remove: (id: string) => request<void>(`/diagrams/${encodeURIComponent(id)}`, { method: 'DELETE' }),
}
