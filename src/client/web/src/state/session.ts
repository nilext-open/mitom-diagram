import { create } from 'zustand'
import { api } from '../lib/api'
import { emptyContent, normalizeContent } from '../lib/model'
import { fitToContent } from '../lib/viewport'
import type { DatabaseContent, Diagram } from '../types'
import { useEditor } from './editor'

type DaemonStatus = 'connecting' | 'online' | 'offline'
type SaveStatus = 'saved' | 'pending' | 'saving' | 'error'

interface SessionState {
  daemon: DaemonStatus
  daemonVersion: string
  save: SaveStatus
  saveError: string
}

export const useSession = create<SessionState>()(() => ({
  daemon: 'connecting',
  daemonVersion: '',
  save: 'saved',
  saveError: '',
}))

const LAST_ID_KEY = 'mitom.lastDiagramId'
const AUTOSAVE_MS = 700

function remember(id: string) {
  try {
    localStorage.setItem(LAST_ID_KEY, id)
  } catch {
    // ignore
  }
}

function lastId(): string | null {
  try {
    return localStorage.getItem(LAST_ID_KEY)
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Daemon health
// ---------------------------------------------------------------------------

export async function checkDaemon(): Promise<boolean> {
  try {
    const h = await api.health()
    const wasOffline = useSession.getState().daemon === 'offline'
    useSession.setState({ daemon: 'online', daemonVersion: h.version })
    // Retry saving whatever piled up while the daemon was unreachable.
    if (wasOffline && hasUnsavedChanges() && !inflight) void flushSave()
    return true
  } catch {
    useSession.setState({ daemon: 'offline' })
    return false
  }
}

// ---------------------------------------------------------------------------
// Autosave
// ---------------------------------------------------------------------------

let savedRevision = 0
let timer: ReturnType<typeof setTimeout> | undefined
let inflight: Promise<void> | null = null

useEditor.subscribe((s, prev) => {
  if (s.diagram?.id !== prev.diagram?.id) {
    savedRevision = s.revision
    clearTimeout(timer)
    useSession.setState({ save: 'saved', saveError: '' })
    return
  }
  if (s.revision !== prev.revision && s.revision !== savedRevision) {
    useSession.setState({ save: 'pending' })
    clearTimeout(timer)
    timer = setTimeout(() => void flushSave(), AUTOSAVE_MS)
  }
})

export async function flushSave(): Promise<void> {
  clearTimeout(timer)
  while (inflight) await inflight
  const { diagram, revision } = useEditor.getState()
  if (!diagram || revision === savedRevision) return

  useSession.setState({ save: 'saving' })
  inflight = (async () => {
    try {
      await api.update(diagram.id, { name: diagram.name, kind: diagram.kind, content: diagram.content })
      // Ignore the result if the user switched diagrams meanwhile.
      if (useEditor.getState().diagram?.id === diagram.id) savedRevision = revision
      const stillCurrent = useEditor.getState().revision === revision
      useSession.setState({ save: stillCurrent ? 'saved' : 'pending', saveError: '' })
      if (!stillCurrent) timer = setTimeout(() => void flushSave(), AUTOSAVE_MS)
    } catch (e) {
      useSession.setState({ save: 'error', saveError: e instanceof Error ? e.message : String(e) })
      void checkDaemon()
    } finally {
      inflight = null
    }
  })()
  await inflight
}

export const hasUnsavedChanges = () => useEditor.getState().revision !== savedRevision

// ---------------------------------------------------------------------------
// Opening / creating diagrams
// ---------------------------------------------------------------------------

function open(d: Diagram) {
  useEditor.getState().load({ ...d, content: normalizeContent(d.content) })
  remember(d.id)
  requestAnimationFrame(fitToContent)
}

export async function openDiagram(id: string) {
  await flushSave()
  open(await api.get(id))
}

export async function createDiagram(name = 'Untitled diagram', content: DatabaseContent = emptyContent()) {
  await flushSave()
  open(await api.create({ name, kind: 'database', content }))
}

/** Opens the last used diagram, else the most recent one, else a new one. */
export async function openInitial() {
  const id = lastId()
  if (id) {
    try {
      return open(await api.get(id))
    } catch {
      // fall through: it was deleted
    }
  }
  const list = await api.list()
  const recent = list.find((d) => d.kind === 'database')
  if (recent) return open(await api.get(recent.id))
  await createDiagram()
}

export async function deleteDiagram(id: string) {
  await api.remove(id)
  if (useEditor.getState().diagram?.id === id) {
    savedRevision = useEditor.getState().revision
    await openInitial()
  }
}
