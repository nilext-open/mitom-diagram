import { useEffect, useRef, type ReactNode } from 'react'

export function Swatches({ colors, value, onChange }: { colors: string[]; value: string; onChange(c: string): void }) {
  return (
    <div className="swatches">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          className={`swatch${c.toLowerCase() === value.toLowerCase() ? ' active' : ''}`}
          style={{ background: c }}
          title={c}
          onClick={() => onChange(c)}
        />
      ))}
      <label className="swatch custom" title="Custom colour">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  )
}

export function Toggle({ on, label, title, onClick }: { on: boolean; label: string; title: string; onClick(): void }) {
  return (
    <button type="button" className={`toggle${on ? ' on' : ''}`} title={title} aria-pressed={on} onClick={onClick}>
      {label}
    </button>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}

/** Scrolls the element into view when it becomes active (e.g. selected on the canvas). */
export function useScrollIntoView<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T>(null)
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [active])
  return ref
}
