import React, { useMemo, useState } from 'react'
import { HashRouter, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { StoreProvider, useStore } from './store'
import { PROJECT_TEMPLATES, type ProjectTemplate } from './projectTemplates'
import type { CatalogItem } from './itemCatalog'
import {
  ACCENTS, CATEGORIES, CATEGORY_FIELDS, CONDITIONS, CURRENCIES, HORIZONS, MOVE_KINDS, PROJECT_STATUS, REPEAT_OPTIONS, THEMES, addMonthsISO, catLabel, countAlerts, currencySymbol, fmtDate, fmtPrice, isLowStock, locationLabel,
  moveKindLabel, norm, plusDays, projectProgress, repeatLabel, statusLabel, today, uid, type Accent, type Condition, type Currency, type Item, type MoveKind, type Project, type ProjectStatus, type Theme, type QuickNote, type Log,
} from './lib'
import { Chevron, CondBadge, Empty, Field, Logo, Modal, Progress, SectionTitle, Skeleton, StatusBadge, Toaster, btnGhost, btnPrimary, inputCls } from './components'

/* ================= Layout : sidebar PC / bottom nav mobile + FAB ================= */
function LogoLink() {
  return <a href="#/" aria-label="Accueil garage2."><Logo /></a>
}
/* Applique thème + accent (Réglages > Personnalisation) */
function usePrefsEffect() {
  const { prefs } = useStore()
  React.useEffect(() => {
    const root = document.documentElement
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = prefs.theme === 'sombre' || (prefs.theme === 'auto' && mq.matches)
      root.classList.toggle('dark', dark)
      root.style.colorScheme = dark ? 'dark' : 'light'
    }
    apply()
    root.dataset.accent = prefs.accent
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [prefs])
}
function Layout({ children }: { children: React.ReactNode }) {
  const store = useStore()
  usePrefsEffect()
  const alertTotal = countAlerts(store, store.prefs.horizon).total
  const tabs = [
    { to: '/', label: 'Accueil', badge: 0 },
    { to: '/objets', label: 'Objets', badge: 0 },
    { to: '/projets', label: 'Projets', badge: 0 },
    { to: '/notes', label: 'Notes', badge: 0 },
    { to: '/alertes', label: 'Alertes', badge: alertTotal },
    { to: '/deplaces', label: 'Déplacés', badge: 0 },
    { to: '/reglages', label: 'Réglages', badge: 0 },
  ]
  const link = ({ isActive }: { isActive: boolean }) =>
    `touch-target relative flex flex-none min-w-[4.5rem] items-center justify-center sm:justify-start gap-1.5 rounded-xl px-2 sm:px-3 text-xs sm:text-sm font-medium ${isActive ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'hover:bg-neutral-200 dark:hover:bg-neutral-800'}`
  const tabContent = (t: (typeof tabs)[number]) => (
    <>
      {t.label}
      {t.badge > 0 && (
        <span aria-label={`${t.badge} alertes`} className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">{t.badge > 9 ? '9+' : t.badge}</span>
      )}
    </>
  )
  return (
    <div className="app-shell no-x mx-auto flex w-full max-w-6xl sm:gap-6">
      <aside className="hidden w-52 shrink-0 sm:block">
        <div className="sticky top-0 flex h-[100dvh] flex-col gap-4 p-4">
          <h1 className="px-2"><Logo size="lg" /></h1>
          <nav className="flex flex-col gap-1" aria-label="Navigation principale">
            {tabs.map((t) => <NavLink key={t.to} to={t.to} end={t.to === '/'} className={link}>{tabContent(t)}</NavLink>)}
          </nav>
          <p className="mt-auto px-2 text-xs text-neutral-500">Un seul utilisateur.<br />Rapide, même d’une main.</p>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-neutral-100 dark:bg-neutral-950 px-4 pt-[env(safe-area-inset-top)] sm:hidden">
          <h1 className="py-3"><LogoLink /></h1>
        </header>
        <main className="min-w-0 flex-1 px-4 pb-28 pt-2 sm:pb-10 sm:pt-6">{children}</main>
        <nav aria-label="Navigation principale" className="fixed inset-x-0 bottom-0 z-40 overflow-x-auto border-t border-neutral-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95 sm:hidden">
          <div className="flex w-max min-w-full gap-1 p-2">
            {tabs.map((t) => <NavLink key={t.to} to={t.to} end={t.to === '/'} className={link}>{tabContent(t)}</NavLink>)}
          </div>
        </nav>
      </div>
    </div>
  )
}

/* ================= Page liste : recherche instantanée + filtres ================= */
function ItemsPage({ onAdd }: { onAdd: () => void }) {
  const { items, locations, moves, ready } = useStore()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('toutes')
  const [cond, setCond] = useState('tous')
  const [loc, setLoc] = useState('tous')
  const [sort, setSort] = useState<'recents' | 'nom'>('recents')

  const toBuyCount = items.filter(isLowStock).length
  const loanCount = moves.filter((l) => !l.returned).length

  const filtered = useMemo(() => {
    const nq = norm(q.trim())
    const list = items.filter((i) => {
      if (cat !== 'toutes' && i.category !== cat) return false
      if (cond !== 'tous' && i.condition !== cond) return false
      if (loc !== 'tous' && (i.locationId ?? 'none') !== loc) return false
      if (!nq) return true
      const l = locations.find((x) => x.id === i.locationId)
      const hay = norm([i.name, i.notes, catLabel(i.category), i.condition, l ? locationLabel(l) : '', ...Object.values(i.details)].join(' '))
      return hay.includes(nq)
    })
    return [...list].sort((a, b) => sort === 'nom'
      ? a.name.localeCompare(b.name, 'fr')
      : b.updatedAt.localeCompare(a.updatedAt))
  }, [items, locations, q, cat, cond, loc, sort])

  // Groupes par catégorie
  const groups = useMemo(() => {
    const m = new Map<string, Item[]>()
    for (const i of filtered) {
      const k = i.category
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(i)
    }
    return [...m.entries()].sort((a, b) => catLabel(a[0]).localeCompare(catLabel(b[0]), 'fr'))
  }, [filtered])

  if (!ready) return <Skeleton />

  return (
    <div>
      <h2 className="sr-only">Objets du garage</h2>
      <div className="sticky top-0 z-10 sm:static bg-neutral-100 dark:bg-neutral-950 py-2">
        <div className="mb-2 flex justify-end"><button onClick={onAdd} className={btnPrimary}>+ Ajouter un objet</button></div>
        <label className="block">
          <span className="sr-only">Rechercher un objet</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher… (nom, lieu, réf)" autoComplete="off"
            className={`${inputCls} py-2`} />
        </label>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          <select aria-label="Filtrer par catégorie" value={cat} onChange={(e) => setCat(e.target.value)} className={`${inputCls} w-auto shrink-0`}>
            <option value="toutes">Toutes catégories</option>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <select aria-label="Filtrer par état" value={cond} onChange={(e) => setCond(e.target.value)} className={`${inputCls} w-auto shrink-0`}>
            <option value="tous">Tous états</option>
            {CONDITIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <select aria-label="Filtrer par emplacement" value={loc} onChange={(e) => setLoc(e.target.value)} className={`${inputCls} w-auto shrink-0`}>
            <option value="tous">Tous lieux</option>
            <option value="none">Sans emplacement</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{locationLabel(l)}</option>)}
          </select>
          <select aria-label="Trier la liste" value={sort} onChange={(e) => setSort(e.target.value as 'recents' | 'nom')} className={`${inputCls} w-auto shrink-0`}>
            <option value="recents">Récents</option>
            <option value="nom">Nom A→Z</option>
          </select>
        </div>
        {(toBuyCount > 0 || loanCount > 0) && (
          <div className="mt-2 flex gap-2 text-xs">
            <span className="rounded-full bg-neutral-200 dark:bg-neutral-800 px-2 py-1">{filtered.length} objet{filtered.length > 1 ? 's' : ''}</span>
            {toBuyCount > 0 && <button onClick={() => nav('/alertes')} className="rounded-full bg-red-600 px-2 py-1 font-semibold text-white">{toBuyCount} à racheter</button>}
            {loanCount > 0 && <button onClick={() => nav('/deplaces')} className="rounded-full bg-[var(--accent)] px-2 py-1 font-semibold text-[var(--accent-ink)]">{loanCount} déplacé{loanCount > 1 ? 's' : ''}</button>}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-4">
          <Empty title={items.length === 0 ? 'Garage vide' : 'Aucun résultat'} hint={items.length === 0 ? 'Ajoutez votre premier objet en 10 secondes.' : 'Essayez un autre mot ou réinitialisez les filtres.'}
            action={<button className={btnPrimary} onClick={() => { setQ(''); setCat('toutes'); setCond('tous'); setLoc('tous') }}>Réinitialiser</button>} />
        </div>
      ) : (
        <div className="mt-2 space-y-5">
          {groups.map(([c, list]) => (
            <section key={c} aria-label={catLabel(c)}>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-neutral-500">{catLabel(c)} · {list.length}</h2>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((i) => {
                  const l = locations.find((x) => x.id === i.locationId)
                  return (
                    <li key={i.id}>
            <button onClick={() => nav(`/objet/${i.id}`)}
                        className="touch-target flex w-full items-center gap-3 rounded-2xl bg-white dark:bg-neutral-900 p-2 text-left shadow-sm active:scale-[0.99]">
                        <div aria-hidden className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-neutral-200 dark:bg-neutral-800 text-lg font-bold">{i.name.slice(0, 1).toUpperCase()}</div>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold" title={i.name}>{i.name}</span>
                          </span>
                          <span className="mt-0.5 flex items-center gap-2 text-xs text-neutral-500">
                            <span className="truncate" title={locationLabel(l)}>Où : {locationLabel(l)}</span>
                            <CondBadge c={i.condition} />
                            {isLowStock(i) && (
                              <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 font-semibold text-white">À racheter</span>
                            )}
                          </span>
                        </span>
                        <Chevron />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

/* ================= Fiche objet ================= */
function ItemDetailPage() {
  const { id } = useParams()
  const { items, locations, logs, moves, prefs, updateItem, removeItem, addLog, removeLog, addMove, addItem, showToast } = useStore()
  const nav = useNavigate()
  const item = items.find((x) => x.id === id)
  const [confirmDel, setConfirmDel] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [toProjectOpen, setToProjectOpen] = useState(false)
  if (!item) return <Empty title="Objet introuvable" hint="Il a peut-être été supprimé." action={<button className={btnGhost} onClick={() => nav('/')}>Retour</button>} />
  const loc = locations.find((x) => x.id === item.locationId)
  const itemLogs = logs.filter((l) => l.itemId === item.id)
  const activeMove = moves.find((l) => l.itemId === item.id && !l.returned)
  const bought = [item.boughtAt ? `acheté le ${fmtDate(item.boughtAt)}` : '', item.price != null ? fmtPrice(item.price, prefs.currency) : ''].filter(Boolean).join(' · ')
  const moveText = (m: (typeof moves)[number]) =>
    m.kind === 'pret' ? <>Prêté à <strong>{m.toWho}</strong></>
    : m.kind === 'reparation' ? <>En réparation chez <strong>{m.toWho}</strong></>
    : <>Déplacé : <strong>{m.toWho}</strong></>

  return (
    <div className="mx-auto w-full max-w-2xl">
      <button onClick={() => nav(-1)} className={`${btnGhost} mb-3`}>← Retour</button>
      <article className="overflow-hidden rounded-2xl bg-white dark:bg-neutral-900 shadow-sm">
        <div className="flex h-36 items-center justify-center bg-neutral-200 dark:bg-neutral-800 text-4xl font-bold">{item.name.slice(0, 1).toUpperCase()}</div>
        <div className="space-y-3 p-4">
          <div className="flex items-start gap-2">
            <h2 className="min-w-0 flex-1 break-words text-xl font-bold" title={item.name}>{item.name}</h2>
            <CondBadge c={item.condition} />
          </div>
          <p className="text-sm text-neutral-500">{catLabel(item.category)} · Où : <strong className="text-neutral-800 dark:text-neutral-100">{locationLabel(loc)}</strong></p>
          {bought && <p className="text-xs text-neutral-500">{bought}</p>}
          {activeMove && <p className="rounded-xl bg-amber-100 dark:bg-amber-900 px-3 py-2 text-sm">{moveText(activeMove)} depuis le {fmtDate(activeMove.since)}{activeMove.due ? ` · retour le ${fmtDate(activeMove.due)}` : ''}</p>}
          {item.isConsumable && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Quantité :</span>
              <button aria-label="Diminuer la quantité" className={`${btnGhost} px-3`} onClick={() => updateItem(item.id, { quantity: Math.max(0, (item.quantity ?? 1) - 1) })}>−</button>
              <strong className="min-w-8 text-center text-lg">{item.quantity ?? 0}{item.unit ? ` ${item.unit}` : ''}</strong>
              <button aria-label="Augmenter la quantité" className={`${btnGhost} px-3`} onClick={() => updateItem(item.id, { quantity: (item.quantity ?? 0) + 1 })}>+</button>
              <span className="text-xs text-neutral-500">Seuil : {item.threshold ?? '—'}</span>
            </div>
          )}
          {item.notes && <p className="whitespace-pre-wrap break-words text-sm">{item.notes}</p>}
          {Object.keys(item.details).length > 0 && (
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(item.details).filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="rounded-xl bg-neutral-100 dark:bg-neutral-800 px-3 py-2">
                  <dt className="text-xs text-neutral-500">{k}</dt><dd className="truncate font-medium" title={v}>{v}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <button className={btnGhost} onClick={() => setLogOpen(true)}>+ Entretien</button>
            <button className={btnGhost} onClick={() => setMoveOpen(true)}>Déplacer</button>
            <button className={btnGhost} onClick={() => setToProjectOpen(true)}>+ Projet</button>
            <button className={btnGhost} onClick={() => {
              const copy: Item = { ...item, id: uid(), name: `${item.name} (copie)`, updatedAt: new Date().toISOString() }
              addItem(copy); showToast('Objet dupliqué'); nav(`/objet/${copy.id}`)
            }}>Dupliquer</button>
            <button className={btnGhost} onClick={() => setConfirmDel(true)}>Supprimer</button>
          </div>
          <section aria-label="Journal d'entretien">
            <h3 className="mb-1 mt-3 font-semibold">Entretien ({itemLogs.length})</h3>
            {itemLogs.length === 0
              ? <p className="text-sm text-neutral-500">Aucune intervention notée.</p>
              : <ul className="space-y-2">{itemLogs.map((l) => (
                <li key={l.id} className="rounded-xl bg-neutral-100 dark:bg-neutral-800 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <strong className="truncate flex-1">{l.action}</strong>
                    <span className="shrink-0 text-xs text-neutral-500">{fmtDate(l.date)}</span>
                    <button aria-label="Supprimer cette entrée" className="shrink-0 rounded px-2 text-lg leading-none" onClick={() => removeLog(l.id)}>×</button>
                  </div>
                  {l.note && <p className="break-words text-neutral-600 dark:text-neutral-300">{l.note}</p>}
                  {l.reminder && <p className="text-xs text-amber-700 dark:text-amber-300">Rappel : {fmtDate(l.reminder)}</p>}
                  {l.repeat && <p className="text-xs text-neutral-500">Se répète : {repeatLabel(l.repeat).toLowerCase()}</p>}
                </li>))}</ul>}
          </section>
        </div>
      </article>

      {logOpen && <LogModal itemId={item.id} onClose={() => setLogOpen(false)} />}
      {moveOpen && <MoveModal itemId={item.id} onClose={() => setMoveOpen(false)} />}
      {toProjectOpen && <ItemToProjectModal itemId={item.id} onClose={() => setToProjectOpen(false)} />}
      {confirmDel && (
        <Modal title="Supprimer cet objet ?" onClose={() => setConfirmDel(false)}>
          <p className="text-sm">« {item.name} » sera supprimé avec son journal et ses déplacements.</p>
          <div className="mt-4 flex gap-2">
            <button className={btnGhost} onClick={() => setConfirmDel(false)}>Garder</button>
            <button className="touch-target rounded-xl bg-red-600 px-4 font-semibold text-white" onClick={() => { removeItem(item.id); showToast('Objet supprimé'); nav('/') }}>Supprimer</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function LogModal({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const { addLog, showToast } = useStore()
  const [action, setAction] = useState('')
  const [note, setNote] = useState('')
  const [reminder, setReminder] = useState('')
  const [repeat, setRepeat] = useState('')
  return (
    <Modal title="Ajouter un entretien" onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!action.trim()) return; addLog({ id: uid(), itemId, date: today(), action: action.trim(), note: note.trim(), reminder: reminder || null, repeat }); showToast('Entretien enregistré'); onClose() }}>
        <Field label="Action *"><input required value={action} onChange={(e) => setAction(e.target.value)} placeholder="Ex. Vidange, affûtage…" className={inputCls} /></Field>
        <Field label="Note"><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Rappel (optionnel)"><input type="date" value={reminder} onChange={(e) => setReminder(e.target.value)} className={inputCls} /></Field>
          <Field label="Récurrence">
            <select value={repeat} onChange={(e) => setRepeat(e.target.value)} className={inputCls}>
              {REPEAT_OPTIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </Field>
        </div>
        <button className={`${btnPrimary} w-full`} disabled={!action.trim()}>Enregistrer</button>
      </form>
    </Modal>
  )
}

function MoveModal({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const { addMove, showToast } = useStore()
  const [toWho, setToWho] = useState('')
  const [due, setDue] = useState('')
  const [kind, setKind] = useState<MoveKind>('pret')
  const destLabel = kind === 'pret' ? 'Prêté à *' : kind === 'reparation' ? 'Réparateur *' : 'Où *'
  const destPh = kind === 'pret' ? 'Ex. Karim' : kind === 'reparation' ? 'Ex. Atelier vélo du centre' : 'Ex. Coffre voiture, cave…'
  return (
    <Modal title="Déplacer cet objet" onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!toWho.trim()) return; addMove({ id: uid(), itemId, toWho: toWho.trim(), since: today(), returned: false, note: '', due: due || null, kind }); showToast('Déplacement enregistré'); onClose() }}>
        <Field label="Motif *">
          <select value={kind} onChange={(e) => setKind(e.target.value as MoveKind)} className={inputCls}>
            {MOVE_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
        </Field>
        <Field label={destLabel}><input required value={toWho} onChange={(e) => setToWho(e.target.value)} placeholder={destPh} className={inputCls} /></Field>
        <Field label="Retour prévu (optionnel)"><input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputCls} /></Field>
        <button className={`${btnPrimary} w-full`} disabled={!toWho.trim()}>Enregistrer</button>
      </form>
    </Modal>
  )
}

/* Lier un objet à un projet (tâche matériau) */
function ItemToProjectModal({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const { items, projects, addTask, showToast } = useStore()
  const nav = useNavigate()
  const [projectId, setProjectId] = useState(projects.find((p) => p.status !== 'termine')?.id ?? '')
  const [qty, setQty] = useState('1')
  const item = items.find((x) => x.id === itemId)
  if (!item) return null
  return (
    <Modal title="Utiliser dans un projet" onClose={onClose}>
      {projects.length === 0 ? (
        <Empty title="Aucun projet" hint="Créez d’abord un projet depuis l’onglet Projets." />
      ) : (
        <form className="space-y-3" onSubmit={(e) => {
          e.preventDefault(); if (!projectId) return
          addTask({ id: uid(), projectId, label: item.name, done: false, qty: parseInt(qty) || 1, unit: '', itemId, createdAt: new Date().toISOString() })
          showToast('Matériau ajouté au projet'); onClose(); nav(`/projet/${projectId}`)
        }}>
          <Field label="Projet *">
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputCls} required>
              <option value="">— Choisir —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title} ({statusLabel(p.status)})</option>)}
            </select>
          </Field>
          <Field label="Quantité"><input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} className={inputCls} /></Field>
          <button className={`${btnPrimary} w-full`} disabled={!projectId}>Ajouter</button>
        </form>
      )}
    </Modal>
  )
}

/* ================= Ajout rapide : nom + catégorie suffisent ================= */
export function QuickAddModal({ onClose, presetCat }: { onClose: () => void; presetCat?: string }) {
  const { addItem, locations, prefs, showToast } = useStore()
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [category, setCategory] = useState(presetCat ?? prefs.defaultCategory)
  const [condition, setCondition] = useState<Condition>('bon')
  const [locationId, setLocationId] = useState('')
  const [qty, setQty] = useState('1')
  const [isConsumable, setIsConsumable] = useState(false)
  const [threshold, setThreshold] = useState('2')
  const [notes, setNotes] = useState('')
  const [details, setDetails] = useState<Record<string, string>>({})
  const [price, setPrice] = useState('')
  const [boughtAt, setBoughtAt] = useState('')
  const [unit, setUnit] = useState('')
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([])
  const [catalogQuery, setCatalogQuery] = useState('')
  const [catalogCategory, setCatalogCategory] = useState('toutes')

  const fields = CATEGORY_FIELDS[category] ?? []

  function save() {
    const id = uid()
    const item: Item = {
      id, name: name.trim(), category: category as Item['category'],
      condition, quantity: isConsumable ? (parseInt(qty) || 0) : null,
      isConsumable, threshold: isConsumable ? (parseInt(threshold) || 0) : null,
      locationId: locationId || null, notes: notes.trim(),
      details: Object.fromEntries(Object.entries(details).filter(([, v]) => v.trim())),
      price: price.trim() ? parseFloat(price.replace(',', '.')) || null : null,
      boughtAt: boughtAt || null,
      unit: isConsumable ? unit.trim() : '',
      updatedAt: new Date().toISOString(),
    }
    addItem(item)
    showToast('Objet ajouté')
    onClose()
    nav(`/objet/${id}`)
  }

  if (catalogOpen) {
    const matches = catalogItems.filter((entry) => (catalogCategory === 'toutes' || entry.category === catalogCategory) && norm(entry.name).includes(norm(catalogQuery))).slice(0, 100)
    return <Modal title="Banque d’objets usuels" onClose={() => setCatalogOpen(false)}>
      <div className="space-y-3">
        <input autoFocus value={catalogQuery} onChange={(e) => setCatalogQuery(e.target.value)} placeholder="Rechercher un objet…" className={inputCls} />
        <select value={catalogCategory} onChange={(e) => setCatalogCategory(e.target.value)} className={inputCls}>
          <option value="toutes">Toutes les catégories</option>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <p className="text-xs text-neutral-500">{matches.length} suggestions. Choisissez un objet pour préremplir sa fiche.</p>
        <div className="max-h-[48dvh] overflow-y-auto rounded-xl border border-neutral-200 dark:border-neutral-700">
          {matches.map((entry) => <button key={`${entry.category}-${entry.name}`} onClick={() => { setName(entry.name); setCategory(entry.category); setIsConsumable(Boolean(entry.consumable)); setUnit(entry.unit ?? ''); setCatalogOpen(false) }} className="flex min-h-11 w-full items-center justify-between gap-2 border-b border-neutral-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-neutral-100 dark:border-neutral-800 dark:hover:bg-neutral-800"><span>{entry.name}</span><span className="text-xs text-neutral-500">{CATEGORIES.find((c) => c.id === entry.category)?.label}</span></button>)}
          {!catalogItems.length && <p className="p-4 text-sm text-neutral-500">Chargement de la banque…</p>}
          {catalogItems.length > 0 && !matches.length && <p className="p-4 text-sm text-neutral-500">Aucun résultat. Vous pouvez saisir un nom librement.</p>}
        </div>
        <button className={btnGhost} onClick={() => setCatalogOpen(false)}>Retour à la fiche</button>
      </div>
    </Modal>
  }

  return (
    <Modal title="Ajout rapide" onClose={onClose}>
      <div className="space-y-3">
        <button type="button" className={`${btnGhost} w-full`} onClick={() => { setCatalogOpen(true); if (!catalogItems.length) void import('./itemCatalog').then((module) => setCatalogItems(module.ITEM_CATALOG)) }}>Parcourir la banque d’objets usuels</button>
        <Field label="Nom *"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Clé Allen 5" className={inputCls} /></Field>
        <Field label="Catégorie *">
          <select value={category} onChange={(e) => { setCategory(e.target.value); setDetails({}) }} className={inputCls}>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </Field>
        <details className="rounded-xl bg-neutral-100 dark:bg-neutral-800 px-3 py-2">
          <summary className="touch-target cursor-pointer font-medium">Options (état, lieu, stock…)</summary>
          <div className="space-y-3 py-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="État">
                <select value={condition} onChange={(e) => setCondition(e.target.value as Condition)} className={inputCls}>
                  {CONDITIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Emplacement">
                <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{locationLabel(l)}</option>)}
                </select>
              </Field>
            </div>
            <label className="flex touch-target items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={isConsumable} onChange={(e) => setIsConsumable(e.target.checked)} className="h-5 w-5" /> Consommable (gère un stock)
            </label>
            {isConsumable && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Quantité"><input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} className={inputCls} /></Field>
                  <Field label="Unité"><input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="L, pcs…" className={inputCls} /></Field>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Seuil d'alerte"><input inputMode="numeric" value={threshold} onChange={(e) => setThreshold(e.target.value)} className={inputCls} /></Field>
                </div>
              </>
            )}
            {fields.map((f) => (
              <Field key={f.key} label={f.label}>
                <input value={details[f.key] ?? ''} onChange={(e) => setDetails((d) => ({ ...d, [f.key]: e.target.value }))} placeholder={f.placeholder} className={inputCls} />
              </Field>
            ))}
            <div className="grid grid-cols-2 gap-2">
              <Field label={`Prix (${currencySymbol(prefs.currency)})`}><input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Ex. 24,90" className={inputCls} /></Field>
              <Field label="Acheté le"><input type="date" value={boughtAt} onChange={(e) => setBoughtAt(e.target.value)} className={inputCls} /></Field>
            </div>
            <Field label="Notes"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} /></Field>
          </div>
        </details>
        <button className={`${btnPrimary} w-full`} disabled={!name.trim()} onClick={save}>Ajouter</button>
      </div>
    </Modal>
  )
}

/* ================= Tableau de bord ================= */
function DashboardPage() {
  const s = useStore()
  const nav = useNavigate()
  const alerts = countAlerts(s, s.prefs.horizon)
  const activeProjects = s.projects.filter((p) => p.status === 'encours').length
  const lowStock = s.items.filter(isLowStock).length
  const totalValue = s.items.reduce((sum, item) => sum + (item.price ?? 0) * (item.quantity ?? 1), 0)
  if (!s.ready) return <Skeleton />
  return <div className="mx-auto w-full max-w-4xl space-y-5">
    <header><p className="text-sm font-medium text-[var(--accent)]">Garage 2 · votre atelier, en un coup d’œil</p><h2 className="mt-1 text-2xl font-bold">Bonjour, prêt à bricoler ?</h2></header>
    <section className="grid overflow-hidden rounded-3xl bg-gradient-to-br from-amber-100 via-orange-50 to-sky-100 dark:from-amber-950/70 dark:via-neutral-900 dark:to-sky-950/70 md:grid-cols-[1fr_0.9fr]" aria-label="Illustration de l’atelier">
      <div className="flex flex-col justify-center p-6 md:p-8"><span className="text-sm font-semibold text-amber-900 dark:text-amber-200">Tout votre atelier, au même endroit</span><h3 className="mt-2 text-2xl font-bold">Des idées aux projets terminés.</h3><p className="mt-2 max-w-md text-sm text-neutral-700 dark:text-neutral-300">Retrouvez vos objets, suivez les petits entretiens et gardez vos prochaines idées sous la main.</p><div className="mt-4 flex flex-wrap gap-2"><button className={btnPrimary} onClick={() => nav('/objets')}>Voir mes objets</button><button className={btnGhost} onClick={() => nav('/projets')}>Ouvrir mes projets</button></div></div>
      <div className="min-h-48 p-4 md:p-6"><svg viewBox="0 0 420 260" role="img" aria-label="Illustration chaleureuse d’un garage avec établi et outils" className="h-full min-h-48 w-full" xmlns="http://www.w3.org/2000/svg"><rect x="28" y="32" width="364" height="198" rx="18" fill="currentColor" opacity=".08"/><path d="M52 112 210 44l158 68v104H52z" fill="#f8fafc" stroke="#475569" strokeWidth="6" strokeLinejoin="round"/><path d="M40 114 210 38l170 76" fill="none" stroke="#d97706" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/><path d="M77 123h266v87H77z" fill="#e2e8f0" stroke="#475569" strokeWidth="5"/><path d="M91 146h103v63H91zm128 0h102v63H219z" fill="#bfdbfe" stroke="#64748b" strokeWidth="4"/><path d="M61 211h292" stroke="#475569" strokeWidth="8" strokeLinecap="round"/><path d="M95 211v21m222-21v21" stroke="#475569" strokeWidth="8" strokeLinecap="round"/><path d="m121 94 16-15 29 29-16 16zm133 9 17-17 30 29-17 17z" fill="#f59e0b" stroke="#92400e" strokeWidth="4"/><path d="M145 145v36m-10-18h20m116-18v36m-10-18h20" stroke="#0369a1" strokeWidth="6" strokeLinecap="round"/><circle cx="349" cy="75" r="19" fill="#fde68a"/><path d="M349 59v32m-16-16h32" stroke="#b45309" strokeWidth="4" strokeLinecap="round"/><path d="M74 201c-15 1-22-9-18-21 2-8 12-10 19-4 8-7 20-3 20 7 0 10-8 17-21 18z" fill="#16a34a"/><path d="M48 221h322" stroke="#94a3b8" strokeWidth="4" strokeDasharray="10 10"/></svg></div>
    </section>
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Résumé du garage">{[
      { value: String(s.items.length), label: 'Objets suivis', icon: '🧰', to: '/objets' },
      { value: String(activeProjects), label: 'Projets en cours', icon: '🛠️', to: '/projets' },
      { value: String(alerts.total), label: 'Alertes à suivre', icon: '🔔', to: '/alertes' },
      { value: totalValue ? `~${fmtPrice(Math.round(totalValue), s.prefs.currency)}` : '—', label: 'Valeur estimée', icon: '📦', to: '/objets' },
    ].map((card) => <button key={card.label} onClick={() => nav(card.to)} className="rounded-2xl bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 dark:bg-neutral-900"><span className="text-xl" aria-hidden>{card.icon}</span><span className="mt-2 block text-xl font-bold">{card.value}</span><span className="text-xs text-neutral-500">{card.label}</span></button>)}</section>
    <section className="grid gap-3 sm:grid-cols-2"><button onClick={() => nav('/alertes')} className="rounded-2xl bg-white p-4 text-left shadow-sm dark:bg-neutral-900"><span className="font-semibold">À surveiller</span><p className="mt-1 text-sm text-neutral-500">{lowStock ? `${lowStock} stock${lowStock > 1 ? 's' : ''} sous le seuil` : alerts.total ? `${alerts.total} point${alerts.total > 1 ? 's' : ''} à consulter` : 'Tout est en ordre pour le moment.'}</p><span className="mt-3 inline-block text-sm font-semibold text-[var(--accent)]">Voir les alertes →</span></button><button onClick={() => nav('/notes')} className="rounded-2xl bg-white p-4 text-left shadow-sm dark:bg-neutral-900"><span className="font-semibold">Notes rapides</span><p className="mt-1 text-sm text-neutral-500">{s.quickNotes.length ? `${s.quickNotes.length} note${s.quickNotes.length > 1 ? 's' : ''} enregistrée${s.quickNotes.length > 1 ? 's' : ''}` : 'Gardez une mesure ou une idée à portée de main.'}</p><span className="mt-3 inline-block text-sm font-semibold text-[var(--accent)]">Ouvrir les notes →</span></button></section>
  </div>
}

/* ================= Notes rapides synchronisées ================= */
function NotesPage() {
  const { quickNotes, addQuickNote, updateQuickNote, removeQuickNote, ready } = useStore()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  if (!ready) return <Skeleton />

  const save = (event: React.FormEvent) => {
    event.preventDefault()
    const text = body.trim()
    if (!text) return
    const now = new Date().toISOString()
    addQuickNote({ id: uid(), title: title.trim(), body: text, createdAt: now, updatedAt: now })
    setTitle(''); setBody('')
  }
  const notes = [...quickNotes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return <div className="mx-auto w-full max-w-2xl space-y-4">
    <header><h2 className="text-xl font-bold">Notes rapides</h2><p className="mt-1 text-sm text-neutral-500">Idées, mesures et rappels partagés entre vos appareils.</p></header>
    <form onSubmit={save} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm dark:bg-neutral-900">
      <label className="block"><span className="mb-1 block text-sm font-medium">Titre <span className="text-neutral-500">(facultatif)</span></span><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Ex. Mesures de l’étagère" className={inputCls} /></label>
      <label className="block"><span className="mb-1 block text-sm font-medium">Note</span><textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={10000} required rows={4} placeholder="Saisissez une note…" className={inputCls} /></label>
      <div className="flex items-center justify-between gap-2"><span className="text-xs text-neutral-500">{body.length}/10 000</span><button className={btnPrimary} disabled={!body.trim()}>Enregistrer</button></div>
    </form>
    {!notes.length ? <Empty title="Aucune note pour le moment" hint="Ajoutez une note rapide ci-dessus. Elle sera synchronisée avec Supabase." /> : <ul className="space-y-3">{notes.map((note: QuickNote) => <li key={note.id} className="rounded-2xl bg-white p-4 shadow-sm dark:bg-neutral-900">
      {editingId === note.id ? <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!editBody.trim()) return; updateQuickNote(note.id, { title: editTitle.trim(), body: editBody.trim() }); setEditingId(null) }}>
        <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} maxLength={120} placeholder="Titre (facultatif)" className={inputCls} />
        <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} maxLength={10000} required rows={4} className={inputCls} />
        <div className="flex justify-end gap-2"><button type="button" className={btnGhost} onClick={() => setEditingId(null)}>Annuler</button><button className={btnPrimary}>Enregistrer</button></div>
      </form> : <>
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-semibold">{note.title || 'Note sans titre'}</h3><p className="mt-1 whitespace-pre-wrap break-words text-sm">{note.body}</p><time className="mt-3 block text-xs text-neutral-500" dateTime={note.updatedAt}>Modifiée le {fmtDate(note.updatedAt)}</time></div><div className="flex shrink-0 gap-1"><button className={btnGhost} onClick={() => { setEditingId(note.id); setEditTitle(note.title); setEditBody(note.body) }}>Modifier</button><button className={btnGhost} aria-label="Supprimer la note" onClick={() => removeQuickNote(note.id)}>Supprimer</button></div></div>
      </>}
    </li>)}</ul>}
  </div>
}

/* ================= Projets DIY : liste ================= */
function ProjectsPage() {
  const { projects, tasks, ready } = useStore()
  const nav = useNavigate()
  const [filter, setFilter] = useState('tous')
  const [open, setOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [template, setTemplate] = useState<ProjectTemplate | undefined>()

  const filtered = projects.filter((p) => filter === 'tous' || p.status === filter)
  const active = projects.filter((p) => p.status === 'encours').length
  if (!ready) return <Skeleton />

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-bold">Projets {active > 0 && <span className="text-sm font-normal text-neutral-500">({active} en cours)</span>}</h2>
        <div className="flex gap-2"><button className={btnGhost} onClick={() => setTemplatesOpen(true)}>Modèles</button><button className={btnPrimary} onClick={() => { setTemplate(undefined); setOpen(true) }}>+ Projet</button></div>
      </div>
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrer par statut">
        {[{ id: 'tous', label: 'Tous' }, ...PROJECT_STATUS].map((s) => (
          <button key={s.id} onClick={() => setFilter(s.id)}
            className={`touch-target shrink-0 rounded-full px-3 text-sm font-medium ${filter === s.id ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-neutral-200 dark:bg-neutral-800'}`}>{s.label}</button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <Empty title={projects.length === 0 ? 'Aucun projet' : 'Aucun projet ici'} hint="Créez un projet ou partez d’un modèle avec une liste d’étapes prête à adapter." action={projects.length === 0 ? <div className="flex justify-center gap-2"><button className={btnGhost} onClick={() => setTemplatesOpen(true)}>Voir les modèles</button><button className={btnPrimary} onClick={() => { setTemplate(undefined); setOpen(true) }}>Créer mon projet</button></div> : undefined} />
      ) : (
        <ul className="space-y-2">
          {filtered.map((p) => {
            const pt = tasks.filter((t) => t.projectId === p.id)
            const pct = projectProgress(pt)
            return (
              <li key={p.id}>
                <button onClick={() => nav(`/projet/${p.id}`)} className="w-full rounded-2xl bg-white dark:bg-neutral-900 p-3 text-left shadow-sm active:scale-[0.99]">
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-semibold" title={p.title}>{p.title}</span>
                    <StatusBadge s={p.status} label={statusLabel(p.status)} />
                  </span>
                  <span className="mt-2 flex items-center gap-2">
                    <span className="flex-1"><Progress pct={pct} /></span>
                    <span className="shrink-0 text-xs text-neutral-500">{pt.filter((t) => t.done).length}/{pt.length}{p.targetDate ? ` · ${fmtDate(p.targetDate)}` : ''}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {open && <ProjectModal template={template} onClose={() => setOpen(false)} />}
      {templatesOpen && <TemplateBank onClose={() => setTemplatesOpen(false)} onSelect={(t) => { setTemplatesOpen(false); setTemplate(t); setOpen(true) }} />}
    </div>
  )
}

/* Modale création / édition de projet */
function ProjectModal({ onClose, project, template }: { onClose: () => void; project?: Project; template?: ProjectTemplate }) {
  const { addProject, updateProject, createProjectWithTasks, prefs, showToast } = useStore()
  const nav = useNavigate()
  const [title, setTitle] = useState(project?.title ?? template?.title ?? '')
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? prefs.defaultProjectStatus)
  const [notes, setNotes] = useState(project?.notes ?? template?.notes ?? '')
  const [budget, setBudget] = useState(project?.budget != null ? String(project.budget) : template?.budget != null ? String(template.budget) : '')
  const [targetDate, setTargetDate] = useState(project?.targetDate ?? '')
  return (
    <Modal title={project ? 'Modifier le projet' : 'Nouveau projet'} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Titre *"><input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Repeindre les volets" className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Statut">
            <select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)} className={inputCls}>
              {PROJECT_STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Échéance"><input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className={inputCls} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label={`Budget estimé (${currencySymbol(prefs.currency)})`}><input inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="Ex. 120" className={inputCls} /></Field>
        </div>
        <Field label="Notes"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Étapes, mesures, idées…" className={inputCls} /></Field>
        <button className={`${btnPrimary} w-full`} disabled={!title.trim()} onClick={() => {
          if (project) { updateProject(project.id, { title: title.trim(), status, notes: notes.trim(), budget: budget.trim() ? parseFloat(budget.replace(',', '.')) || null : null, targetDate: targetDate || null }) ; showToast('Projet mis à jour') }
          else { const id = uid(); const now = new Date().toISOString(); const p = { id, title: title.trim(), status, notes: notes.trim(), budget: budget.trim() ? parseFloat(budget.replace(',', '.')) || null : null, targetDate: targetDate || null, createdAt: now, updatedAt: now }; if (template) createProjectWithTasks(p, template.tasks.map((t) => ({ id: uid(), projectId: id, label: t.label, done: false, qty: t.qty ?? null, unit: t.unit ?? '', itemId: null, createdAt: now }))); else addProject(p); showToast(template ? `Projet créé avec ${template.tasks.length} étapes` : 'Projet créé'); onClose(); nav(`/projet/${id}`); return }
          onClose()
        }}>{project ? 'Enregistrer' : 'Créer'}</button>
      </div>
    </Modal>
  )
}

function TemplateBank({ onClose, onSelect }: { onClose: () => void; onSelect: (template: ProjectTemplate) => void }) {
  const { prefs } = useStore()
  const groups = [...new Set(PROJECT_TEMPLATES.map((t) => t.group))]
  const [group, setGroup] = useState('Tous')
  const templates = PROJECT_TEMPLATES.filter((t) => group === 'Tous' || t.group === group)
  return <Modal title="Bibliothèque de projets" onClose={onClose}>
    <p className="mb-3 text-sm text-neutral-500">Choisissez une base ; le projet et ses étapes seront enregistrés dans votre garage et modifiables ensuite.</p>
    <div className="mb-3 flex gap-2 overflow-x-auto pb-1">{['Tous', ...groups].map((g) => <button key={g} className={`${btnGhost} shrink-0 ${group === g ? 'ring-2 ring-[var(--accent)]' : ''}`} onClick={() => setGroup(g)}>{g}</button>)}</div>
    <ul className="space-y-2">{templates.map((t) => <li key={t.id} className="rounded-2xl bg-neutral-100 p-3 dark:bg-neutral-800">
      <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t.group}</span><h3 className="font-semibold">{t.title}</h3><p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{t.summary}</p><p className="mt-2 text-xs text-neutral-500">{t.tasks.length} étapes{t.budget != null ? ` · Budget indicatif ${fmtPrice(t.budget, prefs.currency)}` : ''}</p></div><button className={btnPrimary} onClick={() => onSelect(t)}>Utiliser</button></div>
    </li>)}</ul>
  </Modal>
}

/* ================= Projet DIY : fiche + tâches ================= */
function ProjectDetailPage() {
  const { id } = useParams()
  const { projects, tasks, items, prefs, addProject, addTask, toggleTask, removeTask, removeProject, consumeTaskMaterial, showToast } = useStore()
  const nav = useNavigate()
  const p = projects.find((x) => x.id === id)
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [label, setLabel] = useState('')
  const [qty, setQty] = useState('')
  const [unit, setUnit] = useState('')
  const [linkItem, setLinkItem] = useState('')
  if (!p) return <Empty title="Projet introuvable" hint="Il a peut-être été supprimé." action={<button className={btnGhost} onClick={() => nav('/projets')}>Retour</button>} />
  const pt = tasks.filter((t) => t.projectId === p.id)
  const done = pt.filter((t) => t.done)
  const todo = pt.filter((t) => !t.done)
  const pct = projectProgress(pt)
  const itemOf = (itemId: string | null) => itemId ? items.find((x) => x.id === itemId) : undefined

  const taskRow = (t: (typeof pt)[number]) => {
    const linked = itemOf(t.itemId)
    const low = linked?.isConsumable && linked.quantity != null && linked.threshold != null && linked.quantity <= (linked.threshold + (t.qty ?? 0))
    return (
      <li key={t.id} className="flex items-center gap-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 px-2 py-1.5">
        <button role="checkbox" aria-checked={t.done} aria-label={t.done ? `Rouvrir : ${t.label}` : `Terminer : ${t.label}`}
          onClick={() => toggleTask(t.id)}
          className={`touch-target flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 text-base ${t.done ? 'border-green-600 bg-green-600 text-white' : 'border-neutral-400 dark:border-neutral-500'}`}>{t.done ? '✓' : ''}</button>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm font-medium ${t.done ? 'line-through text-neutral-500' : ''}`} title={t.label}>{t.label}</p>
          <p className="truncate text-xs text-neutral-500">
            {[t.qty != null ? `×${t.qty}${t.unit ? ' ' + t.unit : ''}` : '', linked ? `stock : ${linked.quantity ?? '—'}` : ''].filter(Boolean).join(' · ') || '—'}
            {linked && <> · <button className="underline" onClick={() => nav(`/objet/${linked.id}`)}>{linked.name}</button></>}
          </p>
        </div>
        {linked?.isConsumable && !t.done && (
          <button className={`${btnGhost} shrink-0 px-2 py-1 text-xs`} title="Déduire du stock" onClick={() => consumeTaskMaterial(t.id)}>Retirer du stock</button>
        )}
        {low && !t.done && <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">Stock bas</span>}
        <button aria-label={`Supprimer : ${t.label}`} className="shrink-0 rounded px-2 text-lg leading-none" onClick={() => removeTask(t.id)}>×</button>
      </li>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <button onClick={() => nav('/projets')} className={`${btnGhost} mb-3`}>← Projets</button>
      <article className="overflow-hidden rounded-2xl bg-white dark:bg-neutral-900 shadow-sm">
        <div className="space-y-3 p-4">
          <div className="flex items-start gap-2">
            <h2 className="min-w-0 flex-1 break-words text-xl font-bold" title={p.title}>{p.title}</h2>
            <StatusBadge s={p.status} label={statusLabel(p.status)} />
          </div>
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <span className="flex-1"><Progress pct={pct} /></span>
            <span className="shrink-0">{done.length}/{pt.length}{p.budget != null ? ` · ~${fmtPrice(p.budget, prefs.currency)}` : ''}{p.targetDate ? ` · ${fmtDate(p.targetDate)}` : ''}</span>
          </div>
          {p.notes && <p className="whitespace-pre-wrap break-words text-sm">{p.notes}</p>}
          <div className="flex flex-wrap gap-2">
            <button className={btnGhost} onClick={() => setEditOpen(true)}>Modifier</button>
            <button className={btnGhost} onClick={() => {
              const id = uid(); const now = new Date().toISOString()
              addProject({ ...p, id, title: `${p.title} (copie)`, status: 'idee', createdAt: now, updatedAt: now })
              pt.forEach((x) => addTask({ ...x, id: uid(), projectId: id, done: false, createdAt: now }))
              showToast('Projet dupliqué'); nav(`/projet/${id}`)
            }}>Dupliquer</button>
            <button className={btnGhost} onClick={() => setConfirmDel(true)}>Supprimer</button>
          </div>
          <section aria-label="Tâches et matériaux">
            <h3 className="mb-2 mt-2 font-semibold">À faire ({todo.length})</h3>
            {todo.length === 0 && done.length === 0
              ? <p className="text-sm text-neutral-500">Ajoutez la première étape ou le premier matériau ci-dessous.</p>
              : <ul className="space-y-1.5">{todo.map(taskRow)}</ul>}
            {done.length > 0 && (
              <><h3 className="mb-2 mt-4 font-semibold">Terminé ({done.length})</h3>
              <ul className="space-y-1.5">{done.map(taskRow)}</ul></>
            )}
            <form className="mt-3 space-y-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 p-3" onSubmit={(e) => {
              e.preventDefault(); if (!label.trim()) return
              addTask({ id: uid(), projectId: p.id, label: label.trim(), done: false, qty: qty.trim() ? parseInt(qty) || null : null, unit: unit.trim(), itemId: linkItem || null, createdAt: new Date().toISOString() })
              setLabel(''); setQty(''); setUnit(''); setLinkItem(''); showToast('Tâche ajoutée')
            }}>
              <Field label="Nouvelle étape / matériau *"><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. Poncer le plateau, acheter lasure…" className={inputCls} /></Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Qté"><input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="2" className={inputCls} /></Field>
                <Field label="Unité"><input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="L, kg…" className={inputCls} /></Field>
                <Field label="Objet du garage">
                  <select value={linkItem} onChange={(e) => setLinkItem(e.target.value)} className={inputCls} aria-label="Lier à un objet du garage">
                    <option value="">—</option>
                    {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </Field>
              </div>
              <button className={`${btnPrimary} w-full`} disabled={!label.trim()}>Ajouter</button>
            </form>
          </section>
        </div>
      </article>
      {editOpen && <ProjectModal project={p} onClose={() => setEditOpen(false)} />}
      {confirmDel && (
        <Modal title="Supprimer ce projet ?" onClose={() => setConfirmDel(false)}>
          <p className="text-sm">« {p.title} » et ses {pt.length} tâche{pt.length > 1 ? 's' : ''} seront supprimés. Le stock du garage est conservé.</p>
          <div className="mt-4 flex gap-2">
            <button className={btnGhost} onClick={() => setConfirmDel(false)}>Garder</button>
            <button className="touch-target rounded-xl bg-red-600 px-4 font-semibold text-white" onClick={() => { removeProject(p.id); nav('/projets') }}>Supprimer</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

/* ================= Alertes : à racheter + rappels ================= */
function AlertsPage() {
  const { items, logs, locations, moves, tasks, projects, prefs, addLog, updateLog, removeLog, updateItem, showToast } = useStore()
  const nav = useNavigate()
  const [alertEditor, setAlertEditor] = useState<Log | null>(null)
  const [creatingAlert, setCreatingAlert] = useState(false)
  const [stockEditor, setStockEditor] = useState<Item | null>(null)
  const t = today()
  const horizon = prefs.horizon
  const itemOf = (id: string) => items.find((x) => x.id === id)

  // Courses : consommables sous seuil + matériaux de projets actifs non couverts
  interface Course { key: string; name: string; detail: string; need: string; go: string }
  const courses: Course[] = [
    ...items.filter(isLowStock).map((i) => ({
      key: 's-' + i.id, name: i.name,
      detail: `Stock : ${i.quantity ?? 0}${i.unit ? ' ' + i.unit : ''} / seuil ${i.threshold}`,
      need: `~${Math.max(1, (i.threshold ?? 0) - (i.quantity ?? 0) + 1)}${i.unit ? ' ' + i.unit : ''}`,
      go: `/objet/${i.id}`,
    })),
    ...tasks.filter((x) => {
      if (x.done || !x.itemId) return false
      const it = itemOf(x.itemId)
      if (!it) return true
      if (projects.find((p) => p.id === x.projectId)?.status === 'termine') return false
      return it.isConsumable && it.quantity != null && it.quantity < (x.qty ?? 1)
    }).map((x) => {
      const it = x.itemId ? itemOf(x.itemId) : undefined
      const proj = projects.find((p) => p.id === x.projectId)
      const miss = Math.max(1, (x.qty ?? 1) - (it?.quantity ?? 0))
      return {
        key: 'p-' + x.id, name: `${x.label}${x.qty != null ? ` ×${x.qty}` : ''}`,
        detail: `${proj?.title ?? 'Projet'} · stock ${it?.quantity ?? 0}`,
        need: `manque ~${miss}`, go: `/projet/${x.projectId}`,
      }
    }),
  ]
  const soon = logs
    .filter((l) => l.reminder && l.reminder <= plusDays(horizon))
    .sort((a, b) => (a.reminder ?? '').localeCompare(b.reminder ?? ''))
  const redo = logs
    .filter((l) => l.repeat && addMonthsISO(l.date, parseInt(l.repeat) || 0) <= plusDays(horizon))
    .sort((a, b) => addMonthsISO(a.date, parseInt(a.repeat) || 0).localeCompare(addMonthsISO(b.date, parseInt(b.repeat) || 0)))
  const dueOf = (l: (typeof redo)[number]) => addMonthsISO(l.date, parseInt(l.repeat) || 0)
  const lateMoves = moves
    .filter((l) => !l.returned && l.due != null && l.due < t)
    .sort((a, b) => (a.due ?? '').localeCompare(b.due ?? ''))

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <header className="flex items-center justify-between gap-2"><div><h2 className="text-xl font-bold">Alertes</h2><p className="text-sm text-neutral-500">Gérez ici vos rappels et seuils de stock.</p></div><button className={btnPrimary} onClick={() => setCreatingAlert(true)}>+ Ajouter une alerte</button></header>
      <section aria-label="Courses">
        <SectionTitle aside={courses.length > 0 ? `${courses.length} article${courses.length > 1 ? 's' : ''}` : undefined}>Courses ({courses.length})</SectionTitle>
        {courses.length === 0 ? <Empty title="Rien à acheter" hint="Consommables sous leur seuil et matériaux manquants apparaîtront ici." /> : (
          <ul className="space-y-2">{courses.map((c) => (
            <li key={c.key} className="flex items-center gap-2 rounded-2xl bg-white p-3 text-sm shadow-sm dark:bg-neutral-900"><button onClick={() => nav(c.go)} className="flex min-w-0 flex-1 items-center gap-2 text-left active:scale-[0.99]">
              <span className="min-w-0 flex-1"><span className="block truncate font-medium" title={c.name}>{c.name}</span>
                <span className="block truncate text-xs text-neutral-500">{c.detail}</span></span>
              <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">{c.need}</span>
              <Chevron />
            </button>{c.key.startsWith('s-') && itemOf(c.key.slice(2)) && <><button className={btnGhost} onClick={() => setStockEditor(itemOf(c.key.slice(2))!)}>Modifier</button><button className={btnGhost} aria-label={`Retirer l’alerte de stock pour ${c.name}`} onClick={() => { const item = itemOf(c.key.slice(2)); if (item) { updateItem(item.id, { threshold: null }); showToast('Alerte de stock retirée') } }}>Retirer</button></>}</li>))}</ul>)}
      </section>
      <section aria-label="Rappels d'entretien">
        <SectionTitle>Rappels ({soon.length})</SectionTitle>
        {soon.length === 0 ? <Empty title="Aucun rappel" hint="Ajoutez un rappel depuis la fiche d’un objet." /> : (
          <ul className="space-y-2">{soon.map((l) => (
            <li key={l.id} className="rounded-2xl bg-white p-3 text-sm shadow-sm dark:bg-neutral-900">
              <div className="flex gap-2"><strong className="truncate flex-1">{l.action} — {itemOf(l.itemId)?.name ?? 'Objet supprimé'}</strong>
                <span className={`shrink-0 font-semibold ${l.reminder! < t ? 'text-red-600 dark:text-red-400' : 'text-amber-700 dark:text-amber-300'}`}>{fmtDate(l.reminder)}</span></div>
              <p className="text-xs text-neutral-500">Où : {locationLabel(locations.find((x) => x.id === itemOf(l.itemId)?.locationId))}</p>
              <div className="mt-2 flex justify-end gap-2"><button className={btnGhost} onClick={() => setAlertEditor(l)}>Modifier</button><button className={btnGhost} onClick={() => removeLog(l.id)}>Retirer</button></div>
            </li>))}</ul>)}
      </section>
      <section aria-label="Entretiens à refaire">
        <SectionTitle>À réviser ({redo.length})</SectionTitle>
        {redo.length === 0 ? <Empty title="Rien à réviser" hint="Les entretiens récurrents échus apparaîtront ici." /> : (
          <ul className="space-y-2">{redo.map((l) => (
            <li key={l.id} className="flex items-center gap-2 rounded-2xl bg-white dark:bg-neutral-900 p-3 text-sm shadow-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium" title={`${l.action} — ${itemOf(l.itemId)?.name ?? ''}`}>{l.action} — {itemOf(l.itemId)?.name ?? 'Objet supprimé'}</p>
                <p className="text-xs text-neutral-500">{repeatLabel(l.repeat)} · dû le {fmtDate(dueOf(l))} · dernier le {fmtDate(l.date)}</p>
              </div>
              <button className={`${btnGhost} shrink-0 px-3 text-xs`} onClick={() => {
                updateLog(l.id, { repeat: '' })
                addLog({ id: uid(), itemId: l.itemId, date: today(), action: l.action, note: '', reminder: null, repeat: l.repeat })
                showToast('Entretien marqué refait')
              }}>Refait ✓</button>
              <button aria-label={`Modifier l’alerte ${l.action}`} className={`${btnGhost} px-2 text-xs`} onClick={() => setAlertEditor(l)}>✎</button>
              <button aria-label={`Retirer l’alerte ${l.action}`} className={`${btnGhost} px-2 text-xs`} onClick={() => removeLog(l.id)}>×</button>
            </li>))}</ul>)}
      </section>
      {creatingAlert && <AlertEditorModal items={items} onClose={() => setCreatingAlert(false)} onSave={(entry) => { addLog(entry); showToast('Alerte ajoutée'); setCreatingAlert(false) }} />}
      {alertEditor && <AlertEditorModal key={alertEditor.id} items={items} value={alertEditor} onClose={() => setAlertEditor(null)} onSave={(entry) => { updateLog(entry.id, entry); showToast('Alerte modifiée'); setAlertEditor(null) }} />}
      {stockEditor && <StockAlertModal key={stockEditor.id} item={stockEditor} onClose={() => setStockEditor(null)} onSave={(patch) => { updateItem(stockEditor.id, patch); showToast('Alerte de stock mise à jour'); setStockEditor(null) }} />}
      <section aria-label="Objets à récupérer">
        <SectionTitle>À récupérer ({lateMoves.length})</SectionTitle>
        {lateMoves.length === 0 ? <Empty title="Aucun retard" hint="Les objets déplacés dont la date de retour est passée apparaîtront ici." /> : (
          <ul className="space-y-2">{lateMoves.map((l) => (
            <li key={l.id}><button onClick={() => nav('/deplaces')} className="flex w-full items-center gap-2 rounded-2xl bg-white dark:bg-neutral-900 p-3 text-left text-sm shadow-sm">
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">{items.find((x) => x.id === l.itemId)?.name ?? 'Objet supprimé'}</span>
                <span className="block truncate text-xs text-neutral-500">{moveKindLabel(l.kind)} · {l.toWho} · dû le {fmtDate(l.due)}</span></span>
              <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">En retard</span>
              <Chevron />
            </button></li>))}</ul>)}
      </section>
    </div>
  )
}

function AlertEditorModal({ items, value, onClose, onSave }: { items: Item[]; value?: Log; onClose: () => void; onSave: (entry: Log) => void }) {
  const [itemId, setItemId] = useState(value?.itemId ?? items[0]?.id ?? '')
  const [action, setAction] = useState(value?.action ?? '')
  const [note, setNote] = useState(value?.note ?? '')
  const [date, setDate] = useState(value?.date ?? today())
  const [reminder, setReminder] = useState(value?.reminder ?? today())
  const [repeat, setRepeat] = useState(value?.repeat ?? '')
  return <Modal title={value ? 'Modifier une alerte' : 'Nouvelle alerte'} onClose={onClose}>
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!itemId || !action.trim()) return; onSave({ id: value?.id ?? uid(), itemId, action: action.trim(), note: note.trim(), date, reminder: reminder || null, repeat }) }}>
      <Field label="Objet *"><select required value={itemId} onChange={(e) => setItemId(e.target.value)} className={inputCls}><option value="">Choisir un objet</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></Field>
      <Field label="Rappel *"><input required maxLength={160} value={action} onChange={(e) => setAction(e.target.value)} placeholder="Ex. Graisser la chaîne" className={inputCls} /></Field>
      <div className="grid grid-cols-2 gap-2"><Field label="Date du dernier entretien"><input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></Field><Field label="M’avertir le"><input type="date" value={reminder ?? ''} onChange={(e) => setReminder(e.target.value)} className={inputCls} /></Field></div>
      <Field label="Récurrence"><select value={repeat} onChange={(e) => setRepeat(e.target.value)} className={inputCls}>{REPEAT_OPTIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></Field>
      <Field label="Détails (facultatif)"><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000} className={inputCls} /></Field>
      <button className={`${btnPrimary} w-full`} disabled={!itemId || !action.trim()}>{value ? 'Enregistrer les modifications' : 'Ajouter le rappel'}</button>
    </form>
  </Modal>
}

function StockAlertModal({ item, onClose, onSave }: { item: Item; onClose: () => void; onSave: (patch: Partial<Item>) => void }) {
  const [quantity, setQuantity] = useState(String(item.quantity ?? 0))
  const [threshold, setThreshold] = useState(String(item.threshold ?? 0))
  return <Modal title="Alerte de stock" onClose={onClose}>
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); const q = Number(quantity); const limit = Number(threshold); if (!Number.isFinite(q) || !Number.isFinite(limit) || q < 0 || limit < 0) return; onSave({ quantity: Math.floor(q), threshold: Math.floor(limit) }) }}>
      <p className="text-sm text-neutral-500">{item.name}</p>
      <Field label={`Stock actuel${item.unit ? ` (${item.unit})` : ''}`}><input type="number" inputMode="numeric" min="0" step="1" required value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputCls} /></Field>
      <Field label="M’alerter quand le stock atteint"><input type="number" inputMode="numeric" min="0" step="1" required value={threshold} onChange={(e) => setThreshold(e.target.value)} className={inputCls} /></Field>
      <button className={`${btnPrimary} w-full`}>Enregistrer</button>
      <button type="button" className={`${btnGhost} w-full`} onClick={() => onSave({ threshold: null })}>Désactiver cette alerte</button>
    </form>
  </Modal>
}

/* ================= Objets déplacés (prêtés, ailleurs, en réparation) ================= */
function MovesPage() {
  const { moves, items, addMove, toggleMoveReturned, removeMove, showToast } = useStore()
  const [open, setOpen] = useState(false)
  const [itemId, setItemId] = useState('')
  const [toWho, setToWho] = useState('')
  const [due, setDue] = useState('')
  const [kind, setKind] = useState<MoveKind>('pret')
  const active = moves.filter((l) => !l.returned)
  const done = moves.filter((l) => l.returned)
  const nameOf = (id: string) => items.find((x) => x.id === id)?.name ?? 'Objet supprimé'
  const isLate = (l: (typeof moves)[number]) => !l.returned && l.due != null && l.due < today()
  const reset = () => { setOpen(false); setItemId(''); setToWho(''); setDue(''); setKind('pret') }
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">Hors place ({active.length})</h2>
        <button className={btnPrimary} onClick={() => setOpen(true)}>+ Déplacer</button>
      </div>
      {active.length === 0 ? <Empty title="Tout est à sa place" hint="Signalez ici un objet prêté, rangé ailleurs ou en réparation." /> : (
        <ul className="space-y-2">{active.map((l) => (
          <li key={l.id} className="flex items-center gap-2 rounded-2xl bg-white dark:bg-neutral-900 p-3 text-sm shadow-sm">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-semibold" title={nameOf(l.itemId)}>{nameOf(l.itemId)}</span>
                <StatusBadge s={l.kind} label={moveKindLabel(l.kind)} />
                {isLate(l) && <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">En retard</span>}
              </p>
              <p className="text-xs text-neutral-500">→ {l.toWho} · depuis le {fmtDate(l.since)}{l.due ? ` · retour le ${fmtDate(l.due)}` : ''}</p>
            </div>
            <button className={`${btnGhost} px-3`} onClick={() => { toggleMoveReturned(l.id); showToast('Objet revenu — Annuler ?', () => toggleMoveReturned(l.id)) }}>Revenu</button>
            <button aria-label="Supprimer ce déplacement" className="touch-target rounded px-2 text-lg" onClick={() => removeMove(l.id)}>×</button>
          </li>))}</ul>)}
      {done.length > 0 && (
        <section aria-label="Historique"><h2 className="mb-2 font-bold">Revenus ({done.length})</h2>
          <ul className="space-y-1">{done.map((l) => (
            <li key={l.id} className="truncate rounded-xl bg-neutral-100 dark:bg-neutral-800 px-3 py-2 text-xs text-neutral-500">{nameOf(l.itemId)} → {l.toWho} ({fmtDate(l.since)})</li>))}</ul>
        </section>)}
      {open && (
        <Modal title="Déplacer un objet" onClose={() => setOpen(false)}>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!itemId || !toWho.trim()) return; addMove({ id: uid(), itemId, toWho: toWho.trim(), since: today(), returned: false, note: '', due: due || null, kind }); showToast('Déplacement enregistré'); reset() }}>
            <Field label="Objet *">
              <select value={itemId} onChange={(e) => setItemId(e.target.value)} className={inputCls} required>
                <option value="">— Choisir —</option>
                {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </Field>
            <Field label="Motif *">
              <select value={kind} onChange={(e) => setKind(e.target.value as MoveKind)} className={inputCls}>
                {MOVE_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
              </select>
            </Field>
            <Field label={kind === 'pret' ? 'Prêté à *' : kind === 'reparation' ? 'Réparateur *' : 'Où *'}>
              <input required value={toWho} onChange={(e) => setToWho(e.target.value)} placeholder={kind === 'ailleurs' ? 'Ex. Coffre voiture, cave…' : 'Ex. Karim'} className={inputCls} />
            </Field>
            <Field label="Retour prévu (optionnel)"><input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputCls} /></Field>
            <button className={`${btnPrimary} w-full`} disabled={!itemId || !toWho.trim()}>Enregistrer</button>
          </form>
        </Modal>)}
    </div>
  )
}

/* ================= Réglages : lieux, sauvegarde, compte ================= */
function SettingsPage() {
  const s = useStore()
  const nav = useNavigate()
  const [zone, setZone] = useState('')
  const [label, setLabel] = useState('')
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  const alerts = countAlerts(s, s.prefs.horizon)
  const activeProjects = s.projects.filter((p) => p.status === 'encours').length
  const value = s.items.reduce((sum, i) => sum + (i.price != null ? i.price * (i.quantity ?? 1) : 0), 0)

  function exportJSON() {
    const blob = new Blob([JSON.stringify({ items: s.items, locations: s.locations, logs: s.logs, moves: s.moves, projects: s.projects, tasks: s.tasks, quickNotes: s.quickNotes, prefs: s.prefs }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = `garage2-${today()}.json`; a.click()
    URL.revokeObjectURL(a.href)
    s.showToast('Sauvegarde exportée')
  }
  function importJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    const r = new FileReader()
    r.onload = () => {
      try {
        const d = JSON.parse(String(r.result))
        if (!Array.isArray(d.items)) throw new Error('bad')
        s.replaceAll({ items: d.items, locations: d.locations ?? [], logs: d.logs ?? [], moves: d.moves ?? [], projects: d.projects ?? [], tasks: d.tasks ?? [], quickNotes: d.quickNotes ?? [], prefs: d.prefs ?? s.prefs })
        s.showToast('Import réussi')
      } catch { s.showToast('Fichier invalide') }
    }
    r.readAsText(f)
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <section aria-label="Mon garage" className="rounded-2xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 p-4 shadow-sm">
        <h2 className="mb-3 font-bold">Mon garage</h2>
        <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          {[
            { v: String(s.items.length), l: 'objets', go: '/' },
            { v: String(activeProjects), l: 'projets en cours', go: '/projets' },
            { v: value > 0 ? `~${fmtPrice(Math.round(value), s.prefs.currency)}` : '—', l: 'valeur estimée', go: undefined },
            { v: String(alerts.total), l: 'points à suivre', go: '/alertes' },
          ].map((c) => (
            <button key={c.l} disabled={!c.go} onClick={() => c.go && nav(c.go)} className="rounded-xl bg-white/10 dark:bg-neutral-900/10 px-2 py-3 disabled:cursor-default">
              <span className="block text-xl font-bold">{c.v}</span>
              <span className="block text-xs opacity-80">{c.l}</span>
            </button>
          ))}
        </div>
      </section>
      <section aria-label="Personnalisation" className="rounded-2xl bg-white dark:bg-neutral-900 p-4 shadow-sm">
        <h2 className="mb-3 font-bold">Personnalisation</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Thème">
            <select value={s.prefs.theme} onChange={(e) => s.updatePrefs({ theme: e.target.value as Theme })} className={inputCls}>
              {THEMES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          </Field>
          <Field label="Couleur d’accent">
            <select value={s.prefs.accent} onChange={(e) => s.updatePrefs({ accent: e.target.value as Accent })} className={inputCls}>
              {ACCENTS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          </Field>
          <Field label="Devise">
            <select value={s.prefs.currency} onChange={(e) => s.updatePrefs({ currency: e.target.value as Currency })} className={inputCls}>
              {CURRENCIES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          </Field>
          <Field label="Horizon des alertes">
            <select value={s.prefs.horizon} onChange={(e) => s.updatePrefs({ horizon: Number(e.target.value) })} className={inputCls}>
              {HORIZONS.map((h) => <option key={h} value={h}>{h} jours</option>)}
            </select>
          </Field>
          <Field label="Catégorie par défaut (ajout)">
            <select value={s.prefs.defaultCategory} onChange={(e) => s.updatePrefs({ defaultCategory: e.target.value as Item['category'] })} className={inputCls}>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Statut par défaut (projets)">
            <select value={s.prefs.defaultProjectStatus} onChange={(e) => s.updatePrefs({ defaultProjectStatus: e.target.value as Project['status'] })} className={inputCls}>
              {PROJECT_STATUS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          </Field>
        </div>
        <p className="mt-2 text-xs text-neutral-500">Appliqué aussitôt, sur cet appareil. Inclus dans l’export JSON.</p>
      </section>
      <section aria-label="Données de démonstration" className="rounded-2xl bg-white p-4 shadow-sm dark:bg-neutral-900">
        <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><h2 className="font-bold">Données fictives</h2><p className="mt-1 text-sm text-neutral-500">Exemples d’objets, stock bas, rappels, déplacement et projet avec tâches. Ils sont enregistrés comme données de démonstration{ s.cloud ? ' dans Supabase et partagés sur vos appareils' : ' sur cet appareil'}.</p></div>
          <label className="flex shrink-0 items-center gap-2 text-sm"><input type="checkbox" checked={s.prefs.showDemoData} onChange={(e) => s.updatePrefs({ showDemoData: e.target.checked })} className="h-5 w-5 accent-[var(--accent)]" />Afficher</label>
        </div>
        <p className="mt-2 text-xs text-neutral-500">{s.demoCount ? `${s.demoCount} élément(s) fictif(s) présent(s).` : 'Aucun exemple chargé.'} Le masquage ne supprime rien et la préférence reste propre à cet appareil.</p>
        {!s.demoCount && <button className={`${btnPrimary} mt-3`} disabled={s.syncing} onClick={() => void s.seedDemoData()}>{s.syncing ? 'Synchronisation…' : 'Charger les exemples'}</button>}
        {s.demoCount > 0 && !s.prefs.showDemoData && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100">Les exemples restent dans le stockage et dans les alertes des appareils où ils sont affichés. Réactivez « Afficher » pour les revoir ici.</p>}
      </section>
      <section aria-label="Emplacements" className="rounded-2xl bg-white dark:bg-neutral-900 p-4 shadow-sm">
        <h2 className="mb-2 font-bold">Emplacements (zone › bac)</h2>
        <ul className="mb-3 space-y-1">
          {s.locations.map((l) => (
            <li key={l.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate" title={locationLabel(l)}>{locationLabel(l)}</span>
              <span className="text-xs text-neutral-500">{s.items.filter((i) => i.locationId === l.id).length} obj.</span>
              <button aria-label={`Supprimer ${locationLabel(l)}`} className="touch-target rounded px-2 text-lg" onClick={() => s.removeLocation(l.id)}>×</button>
            </li>))}
        </ul>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!zone.trim()) return; s.addLocation({ id: uid(), zone: zone.trim(), label: label.trim() }); setZone(''); setLabel('') }}>
          <input value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Zone * (Établi)" required className={inputCls} aria-label="Zone" />
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Bac / étagère" className={inputCls} aria-label="Bac ou étagère" />
          <button className={`${btnGhost} shrink-0`} disabled={!zone.trim()}>+</button>
        </form>
      </section>

      <section aria-label="Sauvegarde" className="rounded-2xl bg-white dark:bg-neutral-900 p-4 shadow-sm">
        <h2 className="mb-2 font-bold">Sauvegarde</h2>
        <div className="flex flex-wrap gap-2">
          <button className={btnGhost} onClick={exportJSON}>Exporter JSON</button>
          <label className={`${btnGhost} cursor-pointer`}>Importer JSON<input type="file" accept="application/json" className="hidden" onChange={importJSON} /></label>
        </div>
        <p className="mt-2 text-xs text-neutral-500">Pensez à exporter avant de changer de téléphone.</p>
      </section>

      <section aria-label="Compte" className="rounded-2xl bg-white dark:bg-neutral-900 p-4 shadow-sm">
        <h2 className="mb-2 font-bold">Compte & synchronisation</h2>
        {!s.cloud ? (
          <p className="text-sm text-neutral-500">Mode local (cet appareil uniquement). Pour synchroniser : créez le projet Supabase, renseignez <code>VITE_SUPABASE_URL</code> et <code>VITE_SUPABASE_ANON_KEY</code>, redéployez.</p>
        ) : s.userEmail ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm"><span className="min-w-0 flex-1 truncate">Connecté : {s.userEmail}</span>
              <button className={btnGhost} onClick={() => s.signOut()}>Déconnexion</button></div>
            <p className="text-xs text-neutral-500">Les changements sont partagés avec vos autres appareils connectés au même compte.</p>
            <PasswordManager />
            <p role="status" className={`text-xs ${s.syncError ? 'text-red-700 dark:text-red-300' : 'text-neutral-500'}`}>{s.syncError ?? (s.syncing ? 'Synchronisation en cours…' : 'Synchronisé')}</p>
          </div>
        ) : <p className="text-sm text-neutral-500">Connectez-vous depuis la page de connexion pour activer la synchronisation.</p>}
        {msg && <p role="status" className="mt-2 text-sm">{msg}</p>}
      </section>
    </div>
  )
}

/* ================= App ================= */
function Shell() {
  const store = useStore()
  const location = useLocation()
  const [addOpen, setAddOpen] = useState(false)
  if (store.cloud && store.needsPasswordReset) return <PasswordResetScreen />
  if (store.cloud && (!store.authReady || (store.userEmail && !store.ready))) {
    return <div className="grid min-h-screen place-items-center px-6"><div className="text-center"><Logo size="lg" /><p className="mt-4 text-sm text-neutral-500">{store.syncing ? 'Synchronisation de votre garage…' : 'Vérification de la session…'}</p></div></div>
  }
  if (store.cloud && !store.userEmail) return location.pathname === '/connexion' ? <LoginScreen /> : <Navigate to="/connexion" replace state={{ from: location.pathname + location.search }} />
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/objets" element={<ItemsPage onAdd={() => setAddOpen(true)} />} />
        <Route path="/objet/:id" element={<ItemDetailPage />} />
        <Route path="/projets" element={<ProjectsPage />} />
        <Route path="/projet/:id" element={<ProjectDetailPage />} />
        <Route path="/notes" element={<NotesPage />} />
        <Route path="/alertes" element={<AlertsPage />} />
        <Route path="/deplaces" element={<MovesPage />} />
        <Route path="/reglages" element={<SettingsPage />} />
        <Route path="/connexion" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Empty title="Page introuvable" hint="Retournez à la liste." action={<a className={btnPrimary} href="#/">Objets</a>} />} />
      </Routes>
      {addOpen && <QuickAddModal onClose={() => setAddOpen(false)} />}
      <Toaster />
    </Layout>
  )
}

function LoginScreen() {
  const s = useStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMsg(resetMode ? await s.resetPassword(email) : await s.signIn(email, password))
    setBusy(false)
  }
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-100 via-neutral-100 to-neutral-100 px-4 py-10 dark:from-neutral-800 dark:via-neutral-950 dark:to-neutral-950">
      <section className="w-full max-w-md rounded-3xl border border-white/70 bg-white/90 p-6 shadow-xl shadow-neutral-900/5 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/90 sm:p-8">
        <div className="mb-7 flex items-center justify-between"><Logo size="lg" /><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">Synchronisation sécurisée</span></div>
        <p className="text-sm font-semibold uppercase tracking-[.16em] text-[var(--accent-hover)]">Espace personnel</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{resetMode ? 'Réinitialiser l’accès' : 'Bon retour à l’atelier'}</h1>
        <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">{resetMode ? 'Recevez un lien sécurisé pour choisir un nouveau mot de passe.' : 'Connectez-vous pour retrouver votre inventaire et vos projets sur tous vos appareils.'}</p>
        <form className="mt-7 space-y-4" onSubmit={submit}>
          <Field label="Adresse e-mail"><input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.fr" className={inputCls} /></Field>
          {!resetMode && <Field label="Mot de passe"><div className="relative"><input type={showPassword ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputCls} pr-20`} /><button type="button" className="absolute inset-y-0 right-2 my-1 rounded-lg px-2 text-xs font-semibold text-neutral-600 dark:text-neutral-300" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>{showPassword ? 'Masquer' : 'Afficher'}</button></div></Field>}
          <button className={`${btnPrimary} w-full`} disabled={busy || !email || (!resetMode && !password)}>{busy ? 'Veuillez patienter…' : resetMode ? 'Envoyer le lien' : 'Se connecter'}</button>
        </form>
        <button type="button" className="mt-4 w-full rounded-lg py-2 text-sm font-medium text-neutral-600 underline decoration-neutral-300 underline-offset-4 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white" onClick={() => { setResetMode((v) => !v); setMsg('') }}>{resetMode ? 'Retour à la connexion' : 'Recevoir un lien par e-mail'}</button>
        {msg && <p role="status" className="mt-4 rounded-xl bg-neutral-100 px-3 py-2 text-sm dark:bg-neutral-800">{msg}</p>}
        <p className="mt-7 border-t border-neutral-200 pt-4 text-xs leading-5 text-neutral-500 dark:border-neutral-800">Les inscriptions sont réservées au propriétaire du garage. Votre mot de passe n’est jamais enregistré par l’application.</p>
      </section>
    </main>
  )
}

function PasswordManager() {
  const s = useStore()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [resetSent, setResetSent] = useState(false)
  async function change(e: React.FormEvent) {
    e.preventDefault()
    if (next !== confirm) { setMsg('Les deux nouveaux mots de passe ne correspondent pas.'); return }
    setBusy(true)
    setMsg(await s.changePassword(current, next))
    setBusy(false)
    setCurrent(''); setNext(''); setConfirm('')
  }
  async function sendReset() {
    if (!s.userEmail) return
    setBusy(true)
    setMsg(await s.resetPassword(s.userEmail))
    setBusy(false)
    setResetSent(true)
  }
  return <div className="space-y-3 border-t border-neutral-200 pt-3 dark:border-neutral-800">
    <h3 className="font-semibold">Gestion du mot de passe</h3>
    <form className="space-y-3" onSubmit={change}>
      <Field label="Mot de passe actuel"><input type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} className={inputCls} /></Field>
      <Field label="Nouveau mot de passe"><input type="password" autoComplete="new-password" minLength={10} required value={next} onChange={(e) => setNext(e.target.value)} className={inputCls} /></Field>
      <Field label="Confirmer le nouveau mot de passe"><input type="password" autoComplete="new-password" minLength={10} required value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} /></Field>
      <button className={btnPrimary} disabled={busy || next.length < 10 || confirm.length < 10}>{busy ? 'Veuillez patienter…' : 'Modifier le mot de passe'}</button>
    </form>
    <button type="button" className={btnGhost} disabled={busy || resetSent} onClick={() => void sendReset()}>{resetSent ? 'Lien envoyé' : 'Envoyer un lien de réinitialisation'}</button>
    {msg && <p role="status" className="text-sm">{msg}</p>}
  </div>
}

function PasswordResetScreen() {
  const s = useStore()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { setMsg('Les deux mots de passe ne correspondent pas.'); return }
    setBusy(true)
    setMsg(await s.updatePassword(password))
    setBusy(false)
  }
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-neutral-100 px-4 py-10 dark:bg-neutral-950">
      <section className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-800 dark:bg-neutral-900 sm:p-8">
        <Logo size="lg" /><h1 className="mt-6 text-2xl font-bold">Choisir un nouveau mot de passe</h1>
        <p className="mt-2 text-sm text-neutral-500">Utilisez au moins 10 caractères. Ce mot de passe n’est pas stocké par Garage 2.</p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <Field label="Nouveau mot de passe"><input type="password" autoComplete="new-password" minLength={10} required value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} /></Field>
          <Field label="Confirmer le mot de passe"><input type="password" autoComplete="new-password" minLength={10} required value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} /></Field>
          <button className={`${btnPrimary} w-full`} disabled={busy || password.length < 10 || confirm.length < 10}>{busy ? 'Enregistrement…' : 'Enregistrer le mot de passe'}</button>
        </form>
        {msg && <p role="status" className="mt-4 rounded-xl bg-neutral-100 px-3 py-2 text-sm dark:bg-neutral-800">{msg}</p>}
      </section>
    </main>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <HashRouter><Shell /></HashRouter>
    </StoreProvider>
  )
}
