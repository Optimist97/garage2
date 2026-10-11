// Store unique : localStorage par défaut, Supabase si configuré (sync simple).
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supa, useSupabase, type Item, type Location, type Loan, type Log, uid } from './lib'

export interface Toast { id: string; msg: string; actionLabel?: string; onAction?: () => void }
interface Data { items: Item[]; locations: Location[]; logs: Log[]; loans: Loan[] }
interface Store extends Data {
  ready: boolean; userEmail: string | null; cloud: boolean
  toast: Toast | null; showToast: (msg: string, undo?: () => void) => void
  addItem: (i: Item) => void; updateItem: (id: string, patch: Partial<Item>) => void; removeItem: (id: string) => void
  addLocation: (l: Location) => void; removeLocation: (id: string) => void
  addLog: (l: Log) => void; removeLog: (id: string) => void
  addLoan: (l: Loan) => void; toggleLoanReturned: (id: string) => void; removeLoan: (id: string) => void
  replaceAll: (d: Data) => void
  signIn: (email: string) => Promise<string>; signOut: () => Promise<void>
}

const Ctx = createContext<Store | null>(null)
export const useStore = () => useContext(Ctx) as Store

const KEY = 'garage2-data-v1'
const seed = (): Data => ({
  locations: [
    { id: 'z1', zone: 'Établi', label: 'Étagère A' },
    { id: 'z2', zone: 'Établi', label: 'Bac 3' },
    { id: 'z3', zone: 'Fond', label: 'Rack voile' },
  ],
  items: [
    { id: uid(), name: 'Dégraissant atelier 5 L', category: 'nettoyage', photo: null, condition: 'bon', quantity: 2, isConsumable: true, threshold: 3, locationId: 'z2', notes: 'Réserve sous l’établi.', details: { contenance: '5 L' }, updatedAt: new Date().toISOString() },
    { id: uid(), name: 'Aile kite 9 m²', category: 'kite', photo: null, condition: 'bon', quantity: null, isConsumable: false, threshold: null, locationId: 'z3', notes: 'Vérifier les lattes.', details: { taille: '9 m²', type: 'Aile' }, updatedAt: new Date().toISOString() },
  ],
  logs: [], loans: [],
})

function load(): Data {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) { const s = seed(); localStorage.setItem(KEY, JSON.stringify(s)); return s }
    return { ...seed(), ...JSON.parse(raw) }
  } catch { return seed() }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Data>(load)
  const [ready, setReady] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const cloud = useSupabase

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(data)) }, [data])
  useEffect(() => {
    // Session existante ?
    supa()?.auth.getSession().then(({ data: s }) => setUserEmail(s.session?.user.email ?? null))
    const { data: sub } = supa()?.auth.onAuthStateChange((_e, s) => setUserEmail(s?.user.email ?? null)) ?? { data: null }
    // Pull cloud si connecté
    pull().finally(() => setReady(true))
    return () => { (sub as { subscription?: { unsubscribe: () => void } } | null)?.subscription?.unsubscribe() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function pull() {
    const c = supa(); if (!c) { setReady(true); return }
    const { data: { session } } = await c.auth.getSession()
    if (!session) return
    const [it, lo, lg, ln] = await Promise.all([
      c.from('items').select('*'), c.from('locations').select('*'),
      c.from('maintenance_logs').select('*'), c.from('loans').select('*'),
    ])
    if (it.data) setData((d) => ({
      ...d,
      items: it.data.map((r: Record<string, never>) => toItem(r as never)),
      locations: (lo.data ?? []).map((r: Record<string, never>) => ({ id: String(r['id']), zone: String(r['zone']), label: String(r['label'] ?? '') })),
      logs: (lg.data ?? []).map((r: Record<string, never>) => ({ id: String(r['id']), itemId: String(r['item_id']), date: String(r['date']), action: String(r['action']), note: String(r['note'] ?? ''), reminder: (r['reminder_date'] as string) ?? null })),
      loans: (ln.data ?? []).map((r: Record<string, never>) => ({ id: String(r['id']), itemId: String(r['item_id']), toWho: String(r['to_who']), since: String(r['since']), returned: Boolean(r['returned']), note: String(r['note'] ?? '') })),
    }))
  }

  function toItem(r: { id: string; name: string; category: string; photo_url: string | null; condition: string; quantity: number | null; is_consumable: boolean; threshold: number | null; location_id: string | null; notes: string; details: Record<string, string>; updated_at: string }): Item {
    return { id: r.id, name: r.name, category: r.category as Item['category'], photo: r.photo_url, condition: r.condition as Item['condition'], quantity: r.quantity, isConsumable: r.is_consumable, threshold: r.threshold, locationId: r.location_id, notes: r.notes ?? '', details: r.details ?? {}, updatedAt: r.updated_at }
  }
  async function push(table: string, op: 'upsert' | 'delete', row?: Record<string, unknown>, id?: string) {
    const c = supa(); if (!c) return
    const { data: { session } } = await c.auth.getSession()
    if (!session) return
    try {
      if (op === 'delete') await c.from(table).delete().eq('id', id)
      else await c.from(table).upsert({ ...row, user_id: session.user.id })
    } catch { /* bonus cloud : le local reste la source de vérité */ }
  }
  const toRow = (i: Item) => ({ id: i.id, name: i.name, category: i.category, photo_url: i.photo, condition: i.condition, quantity: i.quantity, is_consumable: i.isConsumable, threshold: i.threshold, location_id: i.locationId, notes: i.notes, details: i.details })

  const showToast = (msg: string, undo?: () => void) =>
    setToast({ id: uid(), msg, actionLabel: undo ? 'Annuler' : undefined, onAction: undo })

  const api: Store = useMemo(() => ({
    ...data, ready, toast, showToast, userEmail, cloud,
    addItem: (i) => { setData((d) => ({ ...d, items: [i, ...d.items] })); push('items', 'upsert', toRow(i)) },
    updateItem: (id, patch) => {
      let next: Item | undefined
      setData((d) => { next = d.items.find((x) => x.id === id); const items = d.items.map((x) => x.id === id ? { ...x, ...patch, updatedAt: new Date().toISOString() } : x); return { ...d, items } })
      if (next) push('items', 'upsert', toRow({ ...next, ...patch } as Item))
    },
    removeItem: (id) => {
      const backup = data
      setData((d) => ({ ...d, items: d.items.filter((x) => x.id !== id), logs: d.logs.filter((l) => l.itemId !== id), loans: d.loans.filter((l) => l.itemId !== id) }))
      push('items', 'delete', undefined, id)
      showToast('Objet supprimé', () => setData(backup))
    },
    addLocation: (l) => { setData((d) => ({ ...d, locations: [...d.locations, l] })); push('locations', 'upsert', { id: l.id, zone: l.zone, label: l.label }) },
    removeLocation: (id) => { setData((d) => ({ ...d, locations: d.locations.filter((x) => x.id !== id) })); push('locations', 'delete', undefined, id) },
    addLog: (l) => { setData((d) => ({ ...d, logs: [l, ...d.logs] })); push('maintenance_logs', 'upsert', { id: l.id, item_id: l.itemId, date: l.date, action: l.action, note: l.note, reminder_date: l.reminder }) },
    removeLog: (id) => { setData((d) => ({ ...d, logs: d.logs.filter((x) => x.id !== id) })); push('maintenance_logs', 'delete', undefined, id) },
    addLoan: (l) => { setData((d) => ({ ...d, loans: [l, ...d.loans] })); push('loans', 'upsert', { id: l.id, item_id: l.itemId, to_who: l.toWho, since: l.since, returned: l.returned, note: l.note }) },
    toggleLoanReturned: (id) => {
      const l = data.loans.find((x) => x.id === id); if (!l) return
      const next = { ...l, returned: !l.returned }
      setData((d) => ({ ...d, loans: d.loans.map((x) => x.id === id ? next : x) }))
      push('loans', 'upsert', { id: next.id, item_id: next.itemId, to_who: next.toWho, since: next.since, returned: next.returned, note: next.note })
    },
    removeLoan: (id) => { setData((d) => ({ ...d, loans: d.loans.filter((x) => x.id !== id) })); push('loans', 'delete', undefined, id) },
    replaceAll: (d) => setData(d),
    signIn: async (email) => { const c = supa(); if (!c) return 'Mode local : configurez Supabase (voir Réglages).'; const { error } = await c.auth.signInWithOtp({ email }); return error ? error.message : 'Lien magique envoyé — vérifiez vos e-mails.' },
    signOut: async () => { await supa()?.auth.signOut(); setUserEmail(null) },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [data, ready, toast, userEmail])

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}
