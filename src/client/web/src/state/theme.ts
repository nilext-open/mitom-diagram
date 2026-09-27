import { create } from 'zustand'

export type Theme = 'light' | 'dark'

/** Canvas colours are set as SVG attributes (not CSS) so exported images look identical. */
export interface CanvasPalette {
  background: string
  grid: string
  tableBg: string
  tableBorder: string
  rowAlt: string
  rowDivider: string
  text: string
  muted: string
  headerText: string
  edge: string
  edgeActive: string
  accent: string
  pk: string
  fk: string
  noteText: string
}

export const PALETTES: Record<Theme, CanvasPalette> = {
  light: {
    background: '#f8fafc',
    grid: '#e2e8f0',
    tableBg: '#ffffff',
    tableBorder: '#cbd5e1',
    rowAlt: '#f8fafc',
    rowDivider: '#eef2f7',
    text: '#0f172a',
    muted: '#64748b',
    headerText: '#ffffff',
    edge: '#94a3b8',
    edgeActive: '#ea580c',
    accent: '#ea580c',
    pk: '#d97706',
    fk: '#2563eb',
    noteText: '#1f2937',
  },
  dark: {
    background: '#0b1120',
    grid: '#1e293b',
    tableBg: '#111827',
    tableBorder: '#334155',
    rowAlt: '#0f172a',
    rowDivider: '#1e293b',
    text: '#e2e8f0',
    muted: '#94a3b8',
    headerText: '#ffffff',
    edge: '#64748b',
    edgeActive: '#fb923c',
    accent: '#fb923c',
    pk: '#fbbf24',
    fk: '#60a5fa',
    noteText: '#1f2937',
  },
}

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem('mitom.theme')
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // storage unavailable
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const useTheme = create<{ theme: Theme; toggle(): void }>()((set, get) => ({
  theme: initialTheme(),
  toggle: () => {
    const theme = get().theme === 'light' ? 'dark' : 'light'
    try {
      localStorage.setItem('mitom.theme', theme)
    } catch {
      // ignore
    }
    set({ theme })
  },
}))

export const usePalette = () => PALETTES[useTheme((s) => s.theme)]
