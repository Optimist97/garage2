Warning: truncated output (original token count: 18503)
Total output lines: 1116

import React, { useMemo, useState } from 'react'
import { HashRouter, NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { StoreProvider, useStore } from './store'
import { PROJECT_TEMPLATES, type ProjectTemplate } from './projectTemplates'
import {
  ACCENTS, CATEGORIES, CATEGORY_FIELDS, CONDITIONS, CURRENCIES, HORIZONS, MOVE_KINDS, PROJECT_STATUS, REPEAT_OPTIONS, THEMES, addMonthsISO, catLabel, countAlerts, currencySymbol, fmtDate, fmtPrice, isLowStock, locationLabel,
  moveKindLabel, norm, plusDays, projectProgress, repeatLabel, statusLabel, today, uid, warrantyUntil, type Accent, type Condition, type Currency, type Item, type MoveKind, type Project, type ProjectStatus, type Theme,
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
function Layout({ children, onAdd }: { children: React.ReactNode; onAdd: () => void }) {
  const store = useStore()
  usePrefsEffect()
  const alertTotal = countAlerts(store, store.prefs.horizon).total
  const tabs = [
    { to: '/', label: 'Objets', badge: 0 },
    { to: '/projets', label: 'Projets', badge: 0 },
    { to: '/alertes', label: 'Alertes', badge: alertTotal },
    { to: '/deplaces', label: 'Déplacés', badge: 0 },
    { to: '/reglages', label: 'Réglages', badge: 0 },
  ]
  const link = ({ isActive }: { isActive: boolean }) =>
    `touch-target relative flex flex-1 sm:flex-none items-center justify-center sm:justify-start gap-1.5 rounded-xl px-1 sm:px-3 text-xs sm:text-sm font-medium ${isActive ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'hover:bg-neutral-200 dark:hover:bg-neutral-800'}`
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
          <button onClick={onAdd} className={`${btnPrimary} mt-2`}>+ Ajouter</button>
          <p className="mt-auto px-2 text-xs text-neutral-500">Un seul utilisateur.<br />Rapide, même d’une main.</p>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-neutral-100 dark:bg-neutral-950 px-4 pt-[env(safe-area-inset-top)] sm:hidden">
          <h1 className="py-3"><LogoLink /></h1>
        </header>
        <main className="min-w-0 flex-1 px-4 pb-28 pt-2 sm:pb-10 sm:pt-6">{children}</main>
        <nav aria-label="Navigation principale" className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur sm:hidden pb-[env(safe-area-inset-bottom)]">
          <div className="flex gap-1 p-2">
            {tabs.map((t) => <NavLink key={t.to} to={t.to} end={t.to === '/'} className={link}>{tabContent(t)}</NavLink>)}
          </div>
        </nav>
        <button onClick={onAdd} aria-label="Ajout rapide"
          className="sm:hidden fixed bottom-24 right-4 z-40 touch-target h-14 w-14 rounded-full bg-[var(--accent)] text-2xl font-bold text-[var(--accent-ink)] shadow-lg active:opacity-90">+</button>
      </div>
    </div>
  )
}

/* ================= Page liste : recherche instantanée + filtres ================= */
function ItemsPage() {
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
  const wUntil = warrantyUntil(item)
  const wExpired = wUntil != null && wUntil < today()

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
          {wUntil && (
            <p className={`text-xs ${wExpired ? 'font-semibold text-red-600 dark:text-red-400' : 'text-neutral-500'}`}>
              Garantie jusqu’au {fmtDate(wUntil)}{wExpired ? ' (expirée)' : ''}
            </p>
          )}
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
        <button className={`${btnPrimary} w-full`} disabled={!action.trim()}>Enregistrer</butto…8503 tokens truncated…unded-2xl bg-white dark:bg-neutral-900 p-3 text-sm shadow-sm">
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
    const blob = new Blob([JSON.stringify({ items: s.items, locations: s.locations, logs: s.logs, moves: s.moves, projects: s.projects, tasks: s.tasks, prefs: s.prefs }, null, 2)], { type: 'application/json' })
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
        s.replaceAll({ items: d.items, locations: d.locations ?? [], logs: d.logs ?? [], moves: d.moves ?? [], projects: d.projects ?? [], tasks: d.tasks ?? [], prefs: d.prefs ?? s.prefs })
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
            <p role="status" className={`text-xs ${s.syncError ? 'text-red-700 dark:text-red-300' : 'text-neutral-500'}`}>{s.syncError ?? (s.syncing ? 'Synchronisation en cours…' : 'Synchronisé')}</p>
          </div>
        ) : <p className="text-sm text-neutral-500">Connectez-vous depuis l’écran de connexion pour activer la synchronisation.</p>}
        {msg && <p role="status" className="mt-2 text-sm">{msg}</p>}
      </section>
    </div>
  )
}

/* ================= App ================= */
function Shell() {
  const store = useStore()
  const [addOpen, setAddOpen] = useState(false)
  if (store.cloud && store.needsPasswordReset) return <PasswordResetScreen />
  if (store.cloud && (!store.authReady || (store.userEmail && !store.ready))) {
    return <div className="grid min-h-screen place-items-center px-6"><div className="text-center"><Logo size="lg" /><p className="mt-4 text-sm text-neutral-500">{store.syncing ? 'Synchronisation de votre garage…' : 'Vérification de la session…'}</p></div></div>
  }
  if (store.cloud && !store.userEmail) return <LoginScreen />
  return (
    <Layout onAdd={() => setAddOpen(true)}>
      <Routes>
        <Route path="/" element={<ItemsPage />} />
        <Route path="/objet/:id" element={<ItemDetailPage />} />
        <Route path="/projets" element={<ProjectsPage />} />
        <Route path="/projet/:id" element={<ProjectDetailPage />} />
        <Route path="/alertes" element={<AlertsPage />} />
        <Route path="/deplaces" element={<MovesPage />} />
        <Route path="/reglages" element={<SettingsPage />} />
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
        <button type="button" className="mt-4 w-full rounded-lg py-2 text-sm font-medium text-neutral-600 underline decoration-neutral-300 underline-offset-4 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white" onClick={() => { setResetMode((v) => !v); setMsg('') }}>{resetMode ? 'Retour à la connexion' : 'Mot de passe oublié ?'}</button>
        {msg && <p role="status" className="mt-4 rounded-xl bg-neutral-100 px-3 py-2 text-sm dark:bg-neutral-800">{msg}</p>}
        <p className="mt-7 border-t border-neutral-200 pt-4 text-xs leading-5 text-neutral-500 dark:border-neutral-800">Les inscriptions sont réservées au propriétaire du garage. Votre mot de passe n’est jamais enregistré par l’application.</p>
      </section>
    </main>
  )
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
