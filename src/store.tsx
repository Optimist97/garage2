// Store unique : localStorage par défaut, Supabase si configuré (sync simple).
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_PREFS, sanitizePrefs, supa, useSupabase, type Item, type Location, type Log, type Move, type MoveKind, type Prefs, type Project, type Task, uid } from './lib'

export interface Toast { id: string; msg: string; actionLabel?: string; onAction?: () => void }
interface Data { items: Item[]; locations: Location[]; logs: Log[]; moves: Move[]; projects: Project[]; tasks: Task[]; prefs: Prefs }
interface Store extends Data {
  ready: boolean; authReady: boolean; needsPasswordReset: boolean; syncing: boolean; syncError: string | null; userEmail: string | null; cloud: boolean
  toast: Toast | null; showToast: (msg: string, undo?: () => void) => void
  addItem: (i: Item) => void; updateItem: (id: string, patch: Partial<Item>) => void; removeItem: (id: string) => void
  addLocation: (l: Location) => void; removeLocation: (id: string) => void
  addLog: (l: Log) => void; updateLog: (id: string, patch: Partial<Log>) => void; removeLog: (id: string) => void
  addMove: (m: Move) => void; toggleMoveReturned: (id: string) => void; removeMove: (id: string) => void
  addProject: (p: Project) => void; updateProject: (id: string, patch: Partial<Project>) => void; removeProject: (id: string) => void
  addTask: (t: Task) => void; updateTask: (id: string, patch: Partial<Task>) => void; toggleTask: (id: string) => void; removeTask: (id: string) => void
  consumeTaskMaterial: (taskId: string) => void
  createProjectWithTasks: (p: Project, tasks: Task[]) => void
  seedDemoData: () => Promise<void>; demoCount: number
  updatePrefs: (patch: Partial<Prefs>) => void
  replaceAll: (d: Data) => void
  signIn: (email: string, password: string) => Promise<string>; resetPassword: (email: string) => Promise<string>; updatePassword: (password: string) => Promise<string>; changePassword: (current: string, next: string) => Promise<string>; signOut: () => Promise<void>
}

const Ctx = createContext<Store | null>(null)
export const useStore = () => useContext(Ctx) as Store

const KEY = 'garage2-data-v1'
const emptyData = (): Data => ({ items: [], locations: [], logs: [], moves: [], projects: [], tasks: [], prefs: { ...DEFAULT_PREFS } })
function load(): Data {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) {
      const s = emptyData()
      localStorage.setItem(KEY, JSON.stringify(s))
      return s
    }
    return migrate(JSON.parse(raw))
  } catch { return emptyData() }
}

// Normalise toute donnée externe (vieux localStorage, import JSON) vers le schéma courant.
export function migrate(raw: Record<string, unknown>): Data {
  const base = emptyData()
  const data = { ...base, ...(raw as Partial<Data>) } as Data & Record<string, unknown>
  const asArr = <T,>(v: unknown): T[] => (Array.isArray(v) ? v as T[] : [])
  const oldMoves = asArr<Move>(data.moves).length > 0 ? asArr<Move>(data.moves) : asArr<Move>((data as unknown as { loans?: unknown }).loans)
  const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  const locationIds = new Map(asArr<Location>(data.locations).map((l) => [l.id, isUuid(l.id) ? l.id : uid()]))
  const itemIds = new Map(asArr<Item>(data.items).map((i) => [i.id, isUuid(i.id) ? i.id : uid()]))
  const projectIds = new Map(asArr<Project>(data.projects).map((p) => [p.id, isUuid(p.id) ? p.id : uid()]))
  const kinds: MoveKind[] = ['pret', 'ailleurs', 'reparation']
  return {
    locations: asArr<Location>(data.locations).map((l) => ({ ...l, id: locationIds.get(l.id)!, isDemo: Boolean(l.isDemo) || ((l.zone === 'Établi' && ['Étagère A', 'Bac 3'].includes(l.label)) || (l.zone === 'Fond' && l.label === 'Rack voile')) })),
    items: asArr<Item>(data.items).map((i) => {
      const p = i as Partial<Item>
      return {
        ...i,
        id: itemIds.get(i.id)!,
        locationId: i.locationId ? locationIds.get(i.locationId) ?? (isUuid(i.locationId) ? i.locationId : null) : null,
        price: p.price ?? null,
        boughtAt: p.boughtAt ?? null,
        unit: p.unit ?? '',
        warranty: p.warranty ?? null,
        isDemo: Boolean(p.isDemo) || i.name === 'Dégraissant atelier 5 L' || i.name === 'Aile kite 9 m²',
      }
    }),
    logs: asArr<Log>(data.logs).filter((l) => itemIds.has(l.itemId) || isUuid(l.itemId)).map((l) => ({
      ...l, itemId: itemIds.get(l.itemId) ?? l.itemId, repeat: (l as Partial<Log>).repeat ?? '', isDemo: Boolean(l.isDemo),
    })),
    moves: oldMoves.filter((l) => itemIds.has(l.itemId) || isUuid(l.itemId)).map((l) => {
      const p = l as Partial<Move>
      return {
        ...l,
        itemId: itemIds.get(l.itemId) ?? l.itemId,
        due: p.due ?? null,
        kind: kinds.includes(p.kind as MoveKind) ? (p.kind as MoveKind) : 'pret',
        isDemo: Boolean(p.isDemo),
      }
    }),
    projects: asArr<Project>(data.projects).map((p) => ({ ...p, id: projectIds.get(p.id) ?? p.id, isDemo: Boolean(p.isDemo) || p.title === 'Rénover l’établi' })),
    tasks: asArr<Task>(data.tasks).filter((t) => projectIds.has(t.projectId) || isUuid(t.projectId)).map((t) => ({
      ...t,
      projectId: projectIds.get(t.projectId) ?? t.projectId,
      itemId: t.itemId ? (itemIds.get(t.itemId) ?? (isUuid(t.itemId) ? t.itemId : null)) : null,
      isDemo: Boolean(t.isDemo),
    })),
    prefs: sanitizePrefs(data.prefs),
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Data>(load)
  const [ready, setReady] = useState(false)
  const [authReady, setAuthReady] = useState(!useSupabase)
  const [needsPasswordReset, setNeedsPasswordReset] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const dataRef = useRef(data)
  useEffect(() => { dataRef.current = data }, [data])
  const cloud = useSupabase

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(data)) }, [data])
  useEffect(() => {
    const c = supa()
    if (!c) { setAuthReady(true); setReady(true); return }
    let alive = true
    let channel: ReturnType<typeof c.channel> | null = null
    let channelUserId: string | null = null
    let refreshTimer: number | undefined
    const { data: { subscription } } = c.auth.onAuthStateChange((event, session) => {
      if (!alive) return
      setUserEmail(session?.user.email ?? null)
      setAuthReady(true)
      if (event === 'PASSWORD_RECOVERY') setNeedsPasswordReset(true)
      else if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') setNeedsPasswordReset(false)
      if (event === 'SIGNED_OUT') {
        if (channel) { void c.removeChannel(channel); channel = null; channelUserId = null }
        if (refreshTimer) window.clearTimeout(refreshTimer)
        setData(emptyData())
        setReady(true)
        setSyncing(false)
      } else if (session && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        // Hors du callback Auth : évite une ré-entrée dans le client Supabase.
        Promise.resolve().then(async () => {
          if (!alive) return
          if (channelUserId !== session.user.id) {
            if (channel) void c.removeChannel(channel)
            channelUserId = session.user.id
            channel = c.channel(`garage2:${session.user.id}`)
            for (const table of ['locations', 'items', 'maintenance_logs', 'moves', 'projects', 'project_tasks']) {
              channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
                if (refreshTimer) window.clearTimeout(refreshTimer)
                refreshTimer = window.setTimeout(() => { if (alive) void pull(session.user.id) }, 180)
              })
            }
            channel.subscribe((status) => {
              if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setSyncError('Canal temps réel indisponible ; la synchronisation reprendra au retour sur l’application.')
            })
          }
          await pull(session.user.id)
        }).finally(() => { if (alive) setReady(true) })
      } else if (!session) setReady(true)
    })
    const onFocus = () => { if (document.visibilityState === 'visible') void pull() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      alive = false
      subscription.unsubscribe()
      if (channel) void c.removeChannel(channel)
      if (refreshTimer) window.clearTimeout(refreshTimer)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function pull(expectedUserId?: string) {
    const c = supa(); if (!c) { setReady(true); return }
    const { data: { session }, error: sessionError } = await c.auth.getSession()
    if (sessionError) { setSyncError('Impossible de vérifier la session. Reconnectez-vous.'); return }
    if (!session || (expectedUserId && session.user.id !== expectedUserId)) return
    setReady(false)
    setSyncing(true)
    try {
      // Rejoue les modifications faites hors connexion avant de relire le cloud.
      const queueKey = `${KEY}-pending-${session.user.id}`
      let pending: { table: string; op: 'upsert' | 'delete'; row?: Record<string, unknown>; id?: string }[] = []
      try { pending = JSON.parse(localStorage.getItem(queueKey) ?? '[]') } catch { localStorage.removeItem(queueKey) }
      const left: typeof pending = []
      for (const op of pending) {
        const result = op.op === 'delete'
          ? await c.from(op.table).delete().eq('id', op.id)
          : await c.from(op.table).upsert({ ...op.row, user_id: session.user.id })
        if (result.error) left.push(op)
      }
      if (left.length) localStorage.setItem(queueKey, JSON.stringify(left))
      else localStorage.removeItem(queueKey)

      const [it, lo, lg, mv, pr, ta] = await Promise.all([
      c.from('items').select('*'), c.from('locations').select('*'),
      c.from('maintenance_logs').select('*'), c.from('moves').select('*'),
      c.from('projects').select('*'), c.from('project_tasks').select('*'),
      ])
      const results = [it, lo, lg, mv, pr, ta]
      const failed = results.find((r) => r.error)
      if (failed?.error) throw failed.error
      const remote = {
        items: (it.data ?? []).map((r: Record<string, never>) => toItem(r as never)),
        locations: (lo.data ?? []).map((r: Record<string, never>) => ({ id: String(r['id']), zone: String(r['zone']), label: String(r['label'] ?? ''), isDemo: Boolean(r['is_demo']) })),
        logs: (lg.data ?? []).map((r: Record<string, never>) => ({ id: String(r['id']), itemId: String(r['item_id']), date: String(r['date']), action: String(r['action']), note: String(r['note'] ?? ''), reminder: (r['reminder_date'] as string) ?? null, repeat: String(r['repeat'] ?? ''), isDemo: Boolean(r['is_demo']) })),
        moves: (mv.data ?? []).map((r: Record<string, never>) => toMove(r as never)),
        projects: (pr.data ?? []).map((r: Record<string, never>) => ({ id: String(r['id']), title: String(r['title']), status: String(r['status']) as Project['status'], notes: String(r['notes'] ?? ''), budget: (r['budget'] as number) ?? null, targetDate: (r['target_date'] as string) ?? null, createdAt: String(r['created_at']), updatedAt: String(r['updated_at'] ?? r['created_at']), isDemo: Boolean(r['is_demo']) })),
        tasks: (ta.data ?? []).map((r: Record<string, never>) => ({ id: String(r['id']), projectId: String(r['project_id']), label: String(r['label']), done: Boolean(r['done']), qty: (r['qty'] as number) ?? null, unit: String(r['unit'] ?? ''), itemId: (r['item_id'] as string) ?? null, createdAt: String(r['created_at']), isDemo: Boolean(r['is_demo']) })),
      }
      const remoteCount = Object.values(remote).reduce((sum, rows) => sum + rows.length, 0)
      const local = dataRef.current
      const linkedKey = `${KEY}-cloud-linked-${session.user.id}`
      const firstLink = localStorage.getItem(linkedKey) !== '1'
      const localCount = local.items.length + local.locations.length + local.logs.length + local.moves.length + local.projects.length + local.tasks.length
      if (remoteCount === 0 && localCount > 0 && firstLink) {
        // First device: preserve the existing local inventory when connecting an empty cloud.
        const batches: [string, Record<string, unknown>[]][] = [
          ['locations', local.locations.map((r) => ({ ...r }))],
          ['items', local.items.map(toRow)],
          ['projects', local.projects.map(toProjectRow)],
          ['maintenance_logs', local.logs.map(toLogRow)],
          ['moves', local.moves.map(toMoveRow)],
          ['project_tasks', local.tasks.map(toTaskRow)],
        ]
        for (const [table, rows] of batches) {
          if (!rows.length) continue
          const { error } = await c.from(table).upsert(rows.map((r) => ({ ...r, user_id: session.user.id })))
          if (error) throw error
        }
        localStorage.setItem(linkedKey, '1')
        setData((d) => ({ ...d, ...local }))
      } else if (firstLink && localCount > 0) {
        // Premier appareil connecté à un garage déjà créé : conserve aussi les données locales distinctes.
        const merge = <T extends { id: string }>(cloudRows: T[], localRows: T[]) => [...cloudRows, ...localRows.filter((r) => !cloudRows.some((cRow) => cRow.id === r.id))]
        const combined = { ...remote, locations: merge(remote.locations, local.locations), items: merge(remote.items, local.items), logs: merge(remote.logs, local.logs), moves: merge(remote.moves, local.moves), projects: merge(remote.projects, local.projects), tasks: merge(remote.tasks, local.tasks) }
        const newOnly = {
          locations: combined.locations.filter((r) => !remote.locations.some((x) => x.id === r.id)),
          items: combined.items.filter((r) => !remote.items.some((x) => x.id === r.id)),
          logs: combined.logs.filter((r) => !remote.logs.some((x) => x.id === r.id)),
          moves: combined.moves.filter((r) => !remote.moves.some((x) => x.id === r.id)),
          projects: combined.projects.filter((r) => !remote.projects.some((x) => x.id === r.id)),
          tasks: combined.tasks.filter((r) => !remote.tasks.some((x) => x.id === r.id)),
        }
        const batches: [string, Record<string, unknown>[]][] = [
          ['locations', newOnly.locations.map((r) => ({ id: r.id, zone: r.zone, label: r.label, is_demo: Boolean(r.isDemo) }))],
          ['items', newOnly.items.map(toRow)], ['projects', newOnly.projects.map(toProjectRow)], ['maintenance_logs', newOnly.logs.map(toLogRow)],
          ['moves', newOnly.moves.map(toMoveRow)], ['project_tasks', newOnly.tasks.map(toTaskRow)],
        ]
        for (const [table, rows] of batches) {
          if (!rows.length) continue
          const { error } = await c.from(table).upsert(rows.map((r) => ({ ...r, user_id: session.user.id })))
          if (error) throw error
        }
        localStorage.setItem(linkedKey, '1')
        setData((d) => ({ ...combined, prefs: d.prefs }))
      } else if (firstLink) {
        localStorage.setItem(linkedKey, '1')
        setData((d) => ({ ...remote, prefs: d.prefs }))
      } else {
        // The cloud wins over stale device caches; queued offline edits were applied above.
        setData((d) => ({ ...remote, prefs: d.prefs }))
      }
      localStorage.setItem(linkedKey, '1')
      const stillPending = JSON.parse(localStorage.getItem(queueKey) ?? '[]') as unknown[]
      setSyncError(stillPending.length ? 'Certaines modifications hors connexion restent à synchroniser.' : null)
    } catch (error) {
      console.error('Supabase synchronization failed', error)
      setSyncError('Synchronisation impossible. Vos changements locaux restent conservés.')
    } finally { setSyncing(false); setReady(true) }
  }

  function toItem(r: { id: string; name: string; category: string; condition: string; quantity: number | null; is_consumable: boolean; threshold: number | null; location_id: string | null; notes: string; details: Record<string, string>; updated_at: string; price?: number | null; bought_at?: string | null; unit?: string; warranty_months?: number | null; is_demo?: boolean }): Item {
    return { id: r.id, name: r.name, category: r.category as Item['category'], condition: r.condition as Item['condition'], quantity: r.quantity, isConsumable: r.is_consumable, threshold: r.threshold, locationId: r.location_id, notes: r.notes ?? '', details: r.details ?? {}, price: r.price ?? null, boughtAt: r.bought_at ?? null, unit: r.unit ?? '', warranty: r.warranty_months ?? null, updatedAt: r.updated_at, isDemo: Boolean(r.is_demo) }
  }
  async function push(table: string, op: 'upsert' | 'delete', row?: Record<string, unknown>, id?: string) {
    const c = supa(); if (!c) return
    const { data: { session } } = await c.auth.getSession()
    if (!session) return
    try {
      const queueKey = `${KEY}-pending-${session.user.id}`
      let queue: { table: string; op: 'upsert' | 'delete'; row?: Record<string, unknown>; id?: string }[] = []
      try { queue = JSON.parse(localStorage.getItem(queueKey) ?? '[]') } catch { /* file d'attente invalide */ }
      queue = queue.filter((x) => !(x.table === table && (id ? x.id === id : x.row?.id === row?.id)))
      localStorage.setItem(queueKey, JSON.stringify(queue))
      const result = op === 'delete'
        ? await c.from(table).delete().eq('id', id)
        : await c.from(table).upsert({ ...row, user_id: session.user.id })
      if (result.error) throw result.error
    } catch (error) {
      console.error(`Supabase write failed (${table})`, error)
      const queueKey = `${KEY}-pending-${session.user.id}`
      let pending: { table: string; op: 'upsert' | 'delete'; row?: Record<string, unknown>; id?: string }[] = []
      try { pending = JSON.parse(localStorage.getItem(queueKey) ?? '[]') } catch { /* reset corrupt queue */ }
      pending.push({ table, op, row, id })
      localStorage.setItem(queueKey, JSON.stringify(pending))
      setSyncError('Synchronisation interrompue : les changements sont gardés sur cet appareil et seront réessayés.')
    }
  }
  const toRow = (i: Item) => ({ id: i.id, name: i.name, category: i.category, condition: i.condition, quantity: i.quantity, is_consumable: i.isConsumable, threshold: i.threshold, location_id: i.locationId, notes: i.notes, details: i.details, price: i.price, bought_at: i.boughtAt, unit: i.unit, warranty_months: i.warranty, is_demo: Boolean(i.isDemo) })
  const toMove = (r: { id: string; item_id: string; to_who: string; since: string; returned: boolean; note: string; due?: string | null; kind?: string; is_demo?: boolean }): Move => ({
    id: String(r.id), itemId: String(r.item_id), toWho: String(r.to_who), since: String(r.since),
    returned: Boolean(r.returned), note: String(r.note ?? ''), due: (r.due as string) ?? null,
    kind: (['pret', 'ailleurs', 'reparation'] as MoveKind[]).includes(r.kind as MoveKind) ? (r.kind as MoveKind) : 'pret', isDemo: Boolean(r.is_demo),
  })
  const toMoveRow = (m: Move) => ({ id: m.id, item_id: m.itemId, to_who: m.toWho, since: m.since, returned: m.returned, note: m.note, due: m.due, kind: m.kind, is_demo: Boolean(m.isDemo) })
  const toProjectRow = (p: Project) => ({ id: p.id, title: p.title, status: p.status, notes: p.notes, budget: p.budget, target_date: p.targetDate, is_demo: Boolean(p.isDemo) })
  const toTaskRow = (t: Task) => ({ id: t.id, project_id: t.projectId, label: t.label, done: t.done, qty: t.qty, unit: t.unit, item_id: t.itemId, is_demo: Boolean(t.isDemo) })
  const toLogRow = (l: Log) => ({ id: l.id, item_id: l.itemId, date: l.date, action: l.action, note: l.note, reminder_date: l.reminder, repeat: l.repeat, is_demo: Boolean(l.isDemo) })

  const showToast = (msg: string, undo?: () => void) =>
    setToast({ id: uid(), msg, actionLabel: undo ? 'Annuler' : undefined, onAction: undo })

  const demoCount = data.items.concat([]).filter((x) => x.isDemo).length + data.locations.filter((x) => x.isDemo).length + data.logs.filter((x) => x.isDemo).length + data.moves.filter((x) => x.isDemo).length + data.projects.filter((x) => x.isDemo).length + data.tasks.filter((x) => x.isDemo).length
  const api: Store = useMemo(() => ({
    ...data,
    items: data.prefs.showDemoData ? data.items : data.items.filter((x) => !x.isDemo),
    locations: data.prefs.showDemoData ? data.locations : data.locations.filter((x) => !x.isDemo),
    logs: data.prefs.showDemoData ? data.logs : data.logs.filter((x) => !x.isDemo),
    moves: data.prefs.showDemoData ? data.moves : data.moves.filter((x) => !x.isDemo),
    projects: data.prefs.showDemoData ? data.projects : data.projects.filter((x) => !x.isDemo),
    tasks: data.prefs.showDemoData ? data.tasks : data.tasks.filter((x) => !x.isDemo),
    demoCount,
    createProjectWithTasks: (p, newTasks) => {
      setData((d) => ({ ...d, projects: [p, ...d.projects], tasks: [...d.tasks, ...newTasks] }))
      void push('projects', 'upsert', toProjectRow(p)).then(async () => { for (const t of newTasks) await push('project_tasks', 'upsert', toTaskRow(t)) })
    },
    seedDemoData: async () => {
      if (dataRef.current.items.some((x) => x.isDemo) || dataRef.current.projects.some((x) => x.isDemo)) return
      const now = new Date().toISOString(), day = new Date().toISOString().slice(0, 10)
      const locations: Location[] = [
        { id: uid(), zone: 'Atelier démo', label: 'Établi', isDemo: true },
        { id: uid(), zone: 'Atelier démo', label: 'Étagère A', isDemo: true },
      ]
      const items: Item[] = [
        { id: uid(), name: 'Perceuse-visseuse (démo)', category: 'outils', condition: 'bon', quantity: 1, isConsumable: false, threshold: null, locationId: locations[0].id, notes: 'Objet fictif pour tester la fiche et les déplacements.', details: { marque: 'Atelier Exemple', reference: 'DEMO-18V' }, price: 89, boughtAt: null, unit: '', warranty: null, updatedAt: now, isDemo: true },
        { id: uid(), name: 'Vis à bois 5 × 50 mm (démo)', category: 'outils', condition: 'bon', quantity: 12, isConsumable: true, threshold: 20, locationId: locations[1].id, notes: 'Stock fictif bas pour essayer les alertes et matériaux.', details: { marque: 'Exemple' }, price: null, boughtAt: null, unit: 'pièces', warranty: null, updatedAt: now, isDemo: true },
        { id: uid(), name: 'Vélo de randonnée (démo)', category: 'velo', condition: 'moyen', quantity: 1, isConsumable: false, threshold: null, locationId: null, notes: 'Vélo fictif avec rappel d’entretien.', details: { taille: 'M', reference: 'BIKE-01' }, price: 240, boughtAt: null, unit: '', warranty: null, updatedAt: now, isDemo: true },
      ]
      const projects: Project[] = [{ id: uid(), title: 'Étagère de rangement (démo)', status: 'encours', notes: 'Projet fictif pour tester tâches, budget et progression.', budget: 75, targetDate: null, createdAt: now, updatedAt: now, isDemo: true }]
      const tasks: Task[] = [
        { id: uid(), projectId: projects[0].id, label: 'Mesurer le mur', done: true, qty: null, unit: '', itemId: null, createdAt: now, isDemo: true },
        { id: uid(), projectId: projects[0].id, label: 'Prévoir les vis à bois', done: false, qty: 24, unit: 'pièces', itemId: items[1].id, createdAt: now, isDemo: true },
        { id: uid(), projectId: projects[0].id, label: 'Fixer les supports', done: false, qty: null, unit: '', itemId: null, createdAt: now, isDemo: true },
      ]
      const logs: Log[] = [{ id: uid(), itemId: items[2].id, date: day, action: 'Révision à planifier (démo)', note: 'Vérifier freins et pneus avant la saison.', reminder: day, repeat: '6', isDemo: true }]
      const moves: Move[] = [{ id: uid(), itemId: items[0].id, toWho: 'Atelier voisin (démo)', since: day, returned: false, note: 'Déplacement fictif pour tester le suivi.', due: null, kind: 'pret', isDemo: true }]
      const sample: Data = { ...dataRef.current, locations: [...locations, ...dataRef.current.locations], items: [...items, ...dataRef.current.items], projects: [...projects, ...dataRef.current.projects], tasks: [...tasks, ...dataRef.current.tasks], logs: [...logs, ...dataRef.current.logs], moves: [...moves, ...dataRef.current.moves] }
      setData(sample)
      const c = supa(); const { data: { session } } = c ? await c.auth.getSession() : { data: { session: null } }
      if (c && session) {
        const batches: [string, Record<string, unknown>[]][] = [
          ['locations', locations.map((x) => ({ id: x.id, zone: x.zone, label: x.label, is_demo: true }))],
          ['items', items.map(toRow)], ['projects', projects.map(toProjectRow)], ['maintenance_logs', logs.map(toLogRow)],
          ['moves', moves.map(toMoveRow)], ['project_tasks', tasks.map(toTaskRow)],
        ]
        for (const [table, rows] of batches) {
          const { error } = await c.from(table).upsert(rows.map((r) => ({ ...r, user_id: session.user.id })))
          if (error) { setSyncError('Données visibles ici, mais leur enregistrement cloud a échoué. Réessayez après vérification de la base.'); return }
        }
      }
      showToast('Exemples fictifs ajoutés' + (cloud ? ' et synchronisés' : ' sur cet appareil'))
    },
    ready, authReady, needsPasswordReset, syncing, syncError, toast, showToast, userEmail, cloud,
    addItem: (i) => { setData((d) => ({ ...d, items: [i, ...d.items] })); push('items', 'upsert', toRow(i)) },
    updateItem: (id, patch) => {
      let next: Item | undefined
      setData((d) => { next = d.items.find((x) => x.id === id); const items = d.items.map((x) => x.id === id ? { ...x, ...patch, updatedAt: new Date().toISOString() } : x); return { ...d, items } })
      if (next) push('items', 'upsert', toRow({ ...next, ...patch } as Item))
    },
    removeItem: (id) => {
      const backup = data
      setData((d) => ({ ...d, items: d.items.filter((x) => x.id !== id), logs: d.logs.filter((l) => l.itemId !== id), moves: d.moves.filter((l) => l.itemId !== id) }))
      push('items', 'delete', undefined, id)
      showToast('Objet supprimé', () => setData(backup))
    },
    addLocation: (l) => { setData((d) => ({ ...d, locations: [...d.locations, l] })); push('locations', 'upsert', { id: l.id, zone: l.zone, label: l.label }) },
    removeLocation: (id) => { setData((d) => ({ ...d, locations: d.locations.filter((x) => x.id !== id) })); push('locations', 'delete', undefined, id) },
    addLog: (l) => { setData((d) => ({ ...d, logs: [l, ...d.logs] })); push('maintenance_logs', 'upsert', toLogRow(l)) },
    updateLog: (id, patch) => {
      let next: Log | undefined
      setData((d) => { next = d.logs.find((x) => x.id === id); const logs = d.logs.map((x) => x.id === id ? { ...x, ...patch } : x); return { ...d, logs } })
      if (next) { const m = { ...next, ...patch } as Log; push('maintenance_logs', 'upsert', toLogRow(m)) }
    },
    removeLog: (id) => { setData((d) => ({ ...d, logs: d.logs.filter((x) => x.id !== id) })); push('maintenance_logs', 'delete', undefined, id) },
    addMove: (m) => { setData((d) => ({ ...d, moves: [m, ...d.moves] })); push('moves', 'upsert', toMoveRow(m)) },
    toggleMoveReturned: (id) => {
      const l = data.moves.find((x) => x.id === id); if (!l) return
      const next = { ...l, returned: !l.returned }
      setData((d) => ({ ...d, moves: d.moves.map((x) => x.id === id ? next : x) }))
      push('moves', 'upsert', toMoveRow(next))
    },
    removeMove: (id) => { setData((d) => ({ ...d, moves: d.moves.filter((x) => x.id !== id) })); push('moves', 'delete', undefined, id) },
    addProject: (p) => { setData((d) => ({ ...d, projects: [p, ...d.projects] })); push('projects', 'upsert', toProjectRow(p)) },
    updateProject: (id, patch) => {
      let next: Project | undefined
      setData((d) => { next = d.projects.find((x) => x.id === id); const projects = d.projects.map((x) => x.id === id ? { ...x, ...patch, updatedAt: new Date().toISOString() } : x); return { ...d, projects } })
      if (next) push('projects', 'upsert', toProjectRow({ ...next, ...patch } as Project))
    },
    removeProject: (id) => {
      const backup = data
      setData((d) => ({ ...d, projects: d.projects.filter((x) => x.id !== id), tasks: d.tasks.filter((t) => t.projectId !== id) }))
      push('projects', 'delete', undefined, id)
      showToast('Projet supprimé', () => setData(backup))
    },
    addTask: (t) => { setData((d) => ({ ...d, tasks: [...d.tasks, t] })); push('project_tasks', 'upsert', toTaskRow(t)) },
    updateTask: (id, patch) => {
      let next: Task | undefined
      setData((d) => { next = d.tasks.find((x) => x.id === id); const tasks = d.tasks.map((x) => x.id === id ? { ...x, ...patch } : x); return { ...d, tasks } })
      if (next) push('project_tasks', 'upsert', toTaskRow({ ...next, ...patch } as Task))
    },
    toggleTask: (id) => {
      const t = data.tasks.find((x) => x.id === id); if (!t) return
      const next = { ...t, done: !t.done }
      setData((d) => ({ ...d, tasks: d.tasks.map((x) => x.id === id ? next : x) }))
      push('project_tasks', 'upsert', toTaskRow(next))
    },
    removeTask: (id) => { setData((d) => ({ ...d, tasks: d.tasks.filter((x) => x.id !== id) })); push('project_tasks', 'delete', undefined, id) },
    consumeTaskMaterial: (taskId) => {
      const t = data.tasks.find((x) => x.id === taskId)
      const item = t?.itemId ? data.items.find((x) => x.id === t.itemId) : undefined
      if (!t || !item || !item.isConsumable || item.quantity == null) return
      const need = t.qty ?? 1
      const nextQty = Math.max(0, item.quantity - need)
      setData((d) => ({ ...d, items: d.items.map((x) => x.id === item.id ? { ...x, quantity: nextQty, updatedAt: new Date().toISOString() } : x) }))
      push('items', 'upsert', toRow({ ...item, quantity: nextQty }))
      showToast(`Stock « ${item.name} » : ${nextQty}`)
    },
    updatePrefs: (patch) => setData((d) => ({ ...d, prefs: sanitizePrefs({ ...d.prefs, ...patch }) })),
    replaceAll: (d) => setData(migrate(d as unknown as Record<string, unknown>)),
    signIn: async (email, password) => {
      const c = supa(); if (!c) return 'La connexion est indisponible en mode local.'
      const { error } = await c.auth.signInWithPassword({ email: email.trim(), password })
      return error ? 'Adresse e-mail ou mot de passe incorrect.' : 'Connexion réussie.'
    },
    resetPassword: async (email) => {
      const c = supa(); if (!c) return 'La réinitialisation est indisponible en mode local.'
      const redirectTo = `${window.location.origin}${window.location.pathname}`
      const { error } = await c.auth.resetPasswordForEmail(email.trim(), { redirectTo })
      return error ? 'Impossible d’envoyer le lien. Vérifiez votre adresse.' : 'Si le compte existe, un lien de réinitialisation va arriver par e-mail.'
    },
    updatePassword: async (password) => {
      const c = supa(); if (!c) return 'La mise à jour est indisponible en mode local.'
      const { error } = await c.auth.updateUser({ password })
      if (error) return 'Impossible d’enregistrer le mot de passe. Le lien est peut-être expiré.'
      setNeedsPasswordReset(false)
      return 'Mot de passe mis à jour.'
    },
    changePassword: async (current, next) => {
      const c = supa(); if (!c) return 'La gestion du mot de passe est indisponible en mode local.'
      const { error } = await c.auth.updateUser({ password: next, current_password: current })
      if (error?.code === 'reauthentication_needed' || error?.message.toLowerCase().includes('current password')) return 'Le mot de passe actuel est incorrect.'
      return error ? 'Impossible de mettre à jour le mot de passe.' : 'Mot de passe mis à jour.'
    },
    signOut: async () => { await supa()?.auth.signOut(); localStorage.removeItem(KEY); setData(emptyData()); setUserEmail(null) },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [data, ready, authReady, needsPasswordReset, syncing, syncError, toast, userEmail, demoCount])

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}
