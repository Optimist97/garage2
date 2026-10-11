// UI partagée : Modal bottom-sheet/dialog, Toast, champs, cartes.
import React, { useEffect, useRef } from 'react'
import { useStore } from './store'

/* ---------- Modal : bottom sheet (mobile) / dialogue centré (PC) ---------- */
export function Modal({ title, onClose, children, labelledBy }: {
  title: string; onClose: () => void; children: React.ReactNode; labelledBy?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const prevFocus = useRef<Element | null>(null)
  const startY = useRef<number | null>(null)

  useEffect(() => {
    prevFocus.current = document.activeElement
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Focus initial
    const el = ref.current
    const f = el?.querySelector<HTMLElement>('input,select,textarea,button:not([data-close])')
    ;(f ?? el?.querySelector<HTMLElement>('[data-close]'))?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && el) { // focus trap minimal
        const items = [...el.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href]')].filter((x) => !x.hasAttribute('disabled'))
        if (!items.length) return
        const first = items[0], last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKey)
      ;(prevFocus.current as HTMLElement | null)?.focus?.()
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50" role="presentation">
      <div className="absolute inset-0 bg-black/55 fade-anim" onClick={onClose} aria-hidden />
      <div className="absolute inset-0 flex items-end justify-center sm:items-center sm:p-6 pointer-events-none">
        <div
          ref={ref} role="dialog" aria-modal="true" aria-label={title} id={labelledBy}
          tabIndex={-1}
          className="sheet-anim pointer-events-auto w-full sm:max-w-lg bg-white dark:bg-neutral-900 rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[88dvh]"
          onTouchStart={(e) => { startY.current = e.touches[0].clientY }}
          onTouchMove={(e) => {
            if (startY.current == null) return
            const dy = e.touches[0].clientY - startY.current
            if (dy > 110) onClose() // glissement vers le bas = fermer
          }}
          onTouchEnd={() => { startY.current = null }}
        >
          <div className="pt-2 sm:hidden" aria-hidden><div className="mx-auto h-1 w-10 rounded bg-neutral-300 dark:bg-neutral-700" /></div>
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
            <h2 className="text-base font-semibold truncate">{title}</h2>
            <button data-close onClick={onClose} aria-label="Fermer" className="touch-target px-3 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-xl leading-none">×</button>
          </div>
          <div className="overflow-y-auto px-4 py-4" style={{ WebkitOverflowScrolling: 'touch' }}>{children}</div>
        </div>
      </div>
    </div>
  )
}

/* ---------- Toast discret + Annuler ---------- */
export function Toaster() {
  const { toast } = useStore()
  const [visible, setVisible] = React.useState(false)
  useEffect(() => {
    if (!toast) return
    setVisible(true)
    const t = setTimeout(() => setVisible(false), 4500)
    return () => clearTimeout(t)
  }, [toast])
  if (!toast || !visible) return null
  return (
    <div role="status" className="fixed bottom-24 sm:bottom-8 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-md">
      <div className="flex items-center gap-3 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 px-4 py-3 shadow-lg">
        <p className="flex-1 text-sm truncate">{toast.msg}</p>
        {toast.actionLabel && (
          <button className="touch-target shrink-0 rounded-lg bg-white/15 dark:bg-neutral-900/10 px-3 text-sm font-semibold underline"
            onClick={() => { toast.onAction?.(); setVisible(false) }}>{toast.actionLabel}</button>
        )}
      </div>
    </div>
  )
}

/* ---------- Petits éléments ---------- */
export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'text-2xl' : 'text-xl'
  return (
    <span className={`${cls} font-bold tracking-tight`} aria-label="garage2.">
      garage2<span className="text-[var(--accent)]" aria-hidden>.</span>
    </span>
  )
}
export const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="mb-1 block text-sm font-medium">{label}</span>
    {children}
  </label>
)
export const inputCls = 'w-full touch-target rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 text-base'
export const btnPrimary = 'touch-target rounded-xl bg-[var(--accent)] px-4 font-semibold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)] active:opacity-90 disabled:opacity-50'
export const btnGhost = 'touch-target rounded-xl bg-neutral-200 dark:bg-neutral-800 px-4 font-medium hover:bg-neutral-300 dark:hover:bg-neutral-700'

export function Empty({ title, hint, action }: { title: string; hint: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700 p-8 text-center">
      <p className="text-base font-semibold">{title}</p>
      <p className="mt-1 text-sm text-neutral-500">{hint}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

export function Skeleton() {
  return (
    <div aria-hidden className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-20 animate-pulse rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
      ))}
    </div>
  )
}

export function CondBadge({ c }: { c: string }) {
  const map: Record<string, string> = {
    neuf: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
    bon: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
    moyen: 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100',
    hs: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
  }
  const labels: Record<string, string> = { neuf: 'Neuf', bon: 'Bon', moyen: 'Moyen', hs: 'Hors service' }
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${map[c] ?? 'bg-neutral-200 dark:bg-neutral-700'}`}>{labels[c] ?? c}</span>
}

export function StatusBadge({ s, label }: { s: string; label: string }) {
  const map: Record<string, string> = {
    idee: 'bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200',
    encours: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
    pause: 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100',
    termine: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
    pret: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
    ailleurs: 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100',
    reparation: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
  }
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${map[s] ?? 'bg-neutral-200'}`}>{label}</span>
}

export function Progress({ pct }: { pct: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Avancement ${pct} %`}>
      <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : 'bg-[var(--accent)]'}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

/* Chevrons et en-têtes de section homogènes */
export function Chevron() {
  return <span aria-hidden className="shrink-0 pl-1 text-lg leading-none text-neutral-300 dark:text-neutral-600">›</span>
}
export function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-2">
      <h2 className="font-bold">{children}</h2>
      {aside && <span className="shrink-0 text-xs text-neutral-500">{aside}</span>}
    </div>
  )
}
