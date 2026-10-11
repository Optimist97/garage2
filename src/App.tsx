import React, { useMemo, useState } from 'react'
import { HashRouter, NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { StoreProvider, useStore } from './store'
import {
  CATEGORIES, CATEGORY_FIELDS, CONDITIONS, catLabel, compressPhoto, fmtDate, locationLabel,
  norm, today, uid, type Condition, type Item,
} from './lib'
import { CondBadge, Empty, Field, Modal, Skeleton, Toaster, btnGhost, btnPrimary, inputCls } from './components'

/* ================= Layout : sidebar PC / bottom nav mobile + FAB ================= */
function Layout({ children, onAdd }: { children: React.ReactNode; onAdd: () => void }) {
  const tabs = [
    { to: '/', label: 'Objets' },
    { to: '/alertes', label: 'Alertes' },
    { to: '/prets', label: 'Prêts' },
    { to: '/reglages', label: 'Réglages' },
  ]
  const link = ({ isActive }: { isActive: boolean }) =>
    `touch-target flex flex-1 sm:flex-none items-center justify-center sm:justify-start gap-2 rounded-xl px-3 text-sm font-medium ${isActive ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'hover:bg-neutral-200 dark:hover:bg-neutral-800'}`
  return (
    <div className="app-shell no-x mx-auto flex w-full max-w-6xl sm:gap-6">
      <aside className="hidden w-52 shrink-0 sm:block">
        <div className="sticky top-0 flex h-[100dvh] flex-col gap-4 p-4">
          <h1 className="px-2 text-xl font-bold">Garage 2</h1>
          <nav className="flex flex-col gap-1" aria-label="Navigation principale">
            {tabs.map((t) => <NavLink key={t.to} to={t.to} end={t.to === '/'} className={link}>{t.label}</NavLink>)}
          </nav>
          <button onClick={onAdd} className={`${btnPrimary} mt-2`}>+ Ajouter</button>
          <p className="mt-auto px-2 text-xs text-neutral-500">Un seul utilisateur.<br />Rapide, même d’une main.</p>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 bg-neutral-100/90 dark:bg-neutral-950/90 backdrop-blur px-4 pt-[env(safe-area-inset-top)] sm:hidden">
          <h1 className="py-3 text-lg font-bold">Garage 2</h1>
        </header>
        <main className="min-w-0 flex-1 px-4 pb-28 pt-2 sm:pb-10 sm:pt-6">{children}</main>
        <nav aria-label="Navigation principale" className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur sm:hidden pb-[env(safe-area-inset-bottom)]">
          <div className="flex gap-1 p-2">
            {tabs.map((t) => <NavLink key={t.to} to={t.to} end={t.to === '/'} className={link}>{t.label}</NavLink>)}
          </div>
        </nav>
        <button onClick={onAdd} aria-label="Ajout rapide"
          className="sm:hidden fixed bottom-24 right-4 z-40 touch-target h-14 w-14 rounded-full bg-amber-400 text-2xl font-bold text-neutral-900 shadow-lg active:bg-amber-500">+</button>
      </div>
    </div>
  )
}

/* ================= Page liste : recherche instantanée + filtres ================= */
function ItemsPage() {
  const { items, locations, ready } = useStore()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('toutes')
  const [cond, setCond] = useState('tous')
  const [loc, setLoc] = useState('tous')

  const filtered = useMemo(() => {
    const nq = norm(q.trim())
    return items.filter((i) => {
      if (cat !== 'toutes' && i.category !== cat) return false
      if (cond !== 'tous' && i.condition !== cond) return false
      if (loc !== 'tous' && (i.locationId ?? 'none') !== loc) return false
      if (!nq) return true
      const l = locations.find((x) => x.id === i.locationId)
      const hay = norm([i.name, i.notes, catLabel(i.category), i.condition, l ? locationLabel(l) : '', ...Object.values(i.details)].join(' '))
      return hay.includes(nq)
    })
  }, [items, locations, q, cat, cond, loc])

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
      <div className="sticky top-0 sm:static bg-neutral-100 dark:bg-neutral-950 py-2">
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
        </div>
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
                        {i.photo
                          ? <img src={i.photo} alt="" className="img-fixed h-16 w-16 shrink-0 rounded-xl" loading="lazy" />
                          : <div aria-hidden className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-neutral-200 dark:bg-neutral-800 text-lg font-bold">{i.name.slice(0, 1).toUpperCase()}</div>}
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold" title={i.name}>{i.name}</span>
                          </span>
                          <span className="mt-0.5 flex items-center gap-2 text-xs text-neutral-500">
                            <span className="truncate" title={locationLabel(l)}>Où : {locationLabel(l)}</span>
                            <CondBadge c={i.condition} />
                            {i.isConsumable && i.quantity != null && i.threshold != null && i.quantity <= i.threshold && (
                              <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 font-semibold text-white">À racheter</span>
                            )}
                          </span>
                        </span>
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
  const { items, locations, logs, loans, updateItem, removeItem, addLog, removeLog, addLoan, showToast } = useStore()
  const nav = useNavigate()
  const item = items.find((x) => x.id === id)
  const [confirmDel, setConfirmDel] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [loanOpen, setLoanOpen] = useState(false)
  if (!item) return <Empty title="Objet introuvable" hint="Il a peut-être été supprimé." action={<button className={btnGhost} onClick={() => nav('/')}>Retour</button>} />
  const loc = locations.find((x) => x.id === item.locationId)
  const itemLogs = logs.filter((l) => l.itemId === item.id)
  const activeLoan = loans.find((l) => l.itemId === item.id && !l.returned)

  return (
    <div className="mx-auto w-full max-w-2xl">
      <button onClick={() => nav(-1)} className={`${btnGhost} mb-3`}>← Retour</button>
      <article className="overflow-hidden rounded-2xl bg-white dark:bg-neutral-900 shadow-sm">
        {item.photo
          ? <img src={item.photo} alt={`Photo de ${item.name}`} className="img-fixed max-h-72 w-full" />
          : <div className="flex h-36 items-center justify-center bg-neutral-200 dark:bg-neutral-800 text-4xl font-bold">{item.name.slice(0, 1).toUpperCase()}</div>}
        <div className="space-y-3 p-4">
          <div className="flex items-start gap-2">
            <h2 className="min-w-0 flex-1 break-words text-xl font-bold" title={item.name}>{item.name}</h2>
            <CondBadge c={item.condition} />
          </div>
          <p className="text-sm text-neutral-500">{catLabel(item.category)} · Où : <strong className="text-neutral-800 dark:text-neutral-100">{locationLabel(loc)}</strong></p>
          {activeLoan && <p className="rounded-xl bg-amber-100 dark:bg-amber-900 px-3 py-2 text-sm">Prêté à <strong>{activeLoan.toWho}</strong> depuis le {fmtDate(activeLoan.since)}</p>}
          {item.isConsumable && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Quantité :</span>
              <button aria-label="Diminuer la quantité" className={`${btnGhost} px-3`} onClick={() => updateItem(item.id, { quantity: Math.max(0, (item.quantity ?? 1) - 1) })}>−</button>
              <strong className="min-w-8 text-center text-lg">{item.quantity ?? 0}</strong>
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
            <button className={btnGhost} onClick={() => setLoanOpen(true)}>Prêter</button>
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
                </li>))}</ul>}
          </section>
        </div>
      </article>

      {logOpen && <LogModal itemId={item.id} onClose={() => setLogOpen(false)} />}
      {loanOpen && <LoanModal itemId={item.id} onClose={() => setLoanOpen(false)} />}
      {confirmDel && (
        <Modal title="Supprimer cet objet ?" onClose={() => setConfirmDel(false)}>
          <p className="text-sm">« {item.name} » sera supprimé avec son journal et ses prêts.</p>
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
  return (
    <Modal title="Ajouter un entretien" onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!action.trim()) return; addLog({ id: uid(), itemId, date: today(), action: action.trim(), note: note.trim(), reminder: reminder || null }); showToast('Entretien enregistré'); onClose() }}>
        <Field label="Action *"><input required value={action} onChange={(e) => setAction(e.target.value)} placeholder="Ex. Vidange, affûtage…" className={inputCls} /></Field>
        <Field label="Note"><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={inputCls} /></Field>
        <Field label="Rappel (optionnel)"><input type="date" value={reminder} onChange={(e) => setReminder(e.target.value)} className={inputCls} /></Field>
        <button className={`${btnPrimary} w-full`} disabled={!action.trim()}>Enregistrer</button>
      </form>
    </Modal>
  )
}

function LoanModal({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const { addLoan, showToast } = useStore()
  const [toWho, setToWho] = useState('')
  return (
    <Modal title="Prêter cet objet" onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!toWho.trim()) return; addLoan({ id: uid(), itemId, toWho: toWho.trim(), since: today(), returned: false, note: '' }); showToast('Prêt enregistré'); onClose() }}>
        <Field label="Prêté à *"><input required value={toWho} onChange={(e) => setToWho(e.target.value)} placeholder="Ex. Karim" className={inputCls} /></Field>
        <button className={`${btnPrimary} w-full`} disabled={!toWho.trim()}>Enregistrer</button>
      </form>
    </Modal>
  )
}

/* ================= Ajout rapide : nom + catégorie suffisent ================= */
export function QuickAddModal({ onClose, presetCat }: { onClose: () => void; presetCat?: string }) {
  const { addItem, locations, showToast } = useStore()
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [category, setCategory] = useState(presetCat ?? 'outils')
  const [photo, setPhoto] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [condition, setCondition] = useState<Condition>('bon')
  const [locationId, setLocationId] = useState('')
  const [qty, setQty] = useState('1')
  const [isConsumable, setIsConsumable] = useState(false)
  const [threshold, setThreshold] = useState('2')
  const [notes, setNotes] = useState('')
  const [details, setDetails] = useState<Record<string, string>>({})

  const fields = CATEGORY_FIELDS[category] ?? []

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    setBusy(true)
    try { setPhoto(await compressPhoto(f)) } catch { showToast('Photo illisible') }
    finally { setBusy(false) }
  }

  function save() {
    const id = uid()
    const item: Item = {
      id, name: name.trim(), category: category as Item['category'], photo,
      condition, quantity: isConsumable ? (parseInt(qty) || 0) : null,
      isConsumable, threshold: isConsumable ? (parseInt(threshold) || 0) : null,
      locationId: locationId || null, notes: notes.trim(),
      details: Object.fromEntries(Object.entries(details).filter(([, v]) => v.trim())),
      updatedAt: new Date().toISOString(),
    }
    addItem(item)
    showToast('Objet ajouté')
    onClose()
    nav(`/objet/${id}`)
  }

  return (
    <Modal title="Ajout rapide" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Nom *"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Clé Allen 5" className={inputCls} /></Field>
        <Field label="Catégorie *">
          <select value={category} onChange={(e) => { setCategory(e.target.value); setDetails({}) }} className={inputCls}>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Photo">
          <input type="file" accept="image/*" capture="environment" onChange={onPhoto} className="text-sm" aria-label="Prendre ou choisir une photo" />
          {busy && <p className="text-xs text-neutral-500">Compression…</p>}
          {photo && <img src={photo} alt="Aperçu" className="img-fixed mt-2 h-24 w-24 rounded-xl" />}
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
              <div className="grid grid-cols-2 gap-2">
                <Field label="Quantité"><input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} className={inputCls} /></Field>
                <Field label="Seuil d'alerte"><input inputMode="numeric" value={threshold} onChange={(e) => setThreshold(e.target.value)} className={inputCls} /></Field>
              </div>
            )}
            {fields.map((f) => (
              <Field key={f.key} label={f.label}>
                <input value={details[f.key] ?? ''} onChange={(e) => setDetails((d) => ({ ...d, [f.key]: e.target.value }))} placeholder={f.placeholder} className={inputCls} />
              </Field>
            ))}
            <Field label="Notes"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} /></Field>
          </div>
        </details>
        <button className={`${btnPrimary} w-full`} disabled={!name.trim()} onClick={save}>Ajouter</button>
      </div>
    </Modal>
  )
}

/* ================= Alertes : à racheter + rappels ================= */
function AlertsPage() {
  const { items, logs, locations } = useStore()
  const nav = useNavigate()
  const toBuy = items.filter((i) => i.isConsumable && i.quantity != null && i.threshold != null && i.quantity <= i.threshold)
  const soon = logs.filter((l) => l.reminder && l.reminder <= new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10)).sort((a, b) => (a.reminder ?? '').localeCompare(b.reminder ?? ''))
  const itemOf = (id: string) => items.find((x) => x.id === id)
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <section aria-label="À racheter">
        <h2 className="mb-2 font-bold">À racheter ({toBuy.length})</h2>
        {toBuy.length === 0 ? <Empty title="Rien à racheter" hint="Les consommables sous leur seuil apparaîtront ici." /> : (
          <ul className="space-y-2">{toBuy.map((i) => (
            <li key={i.id}><button onClick={() => nav(`/objet/${i.id}`)} className={`${btnGhost} w-full !justify-between flex items-center gap-2 text-left`}>
              <span className="truncate font-medium" title={i.name}>{i.name}</span>
              <span className="shrink-0 text-sm">Stock : {i.quantity} / seuil {i.threshold}</span>
            </button></li>))}</ul>)}
      </section>
      <section aria-label="Rappels d'entretien">
        <h2 className="mb-2 font-bold">Rappels ({soon.length})</h2>
        {soon.length === 0 ? <Empty title="Aucun rappel" hint="Ajoutez un rappel depuis la fiche d’un objet." /> : (
          <ul className="space-y-2">{soon.map((l) => (
            <li key={l.id} className="rounded-2xl bg-white dark:bg-neutral-900 p-3 text-sm shadow-sm">
              <div className="flex gap-2"><strong className="truncate flex-1">{l.action} — {itemOf(l.itemId)?.name ?? 'Objet supprimé'}</strong>
                <span className="shrink-0 text-amber-700 dark:text-amber-300">{fmtDate(l.reminder)}</span></div>
              <p className="text-xs text-neutral-500">Où : {locationLabel(locations.find((x) => x.id === itemOf(l.itemId)?.locationId))}</p>
            </li>))}</ul>)}
      </section>
    </div>
  )
}

/* ================= Prêts ================= */
function LoansPage() {
  const { loans, items, addLoan, toggleLoanReturned, removeLoan, showToast } = useStore()
  const [open, setOpen] = useState(false)
  const [itemId, setItemId] = useState('')
  const [toWho, setToWho] = useState('')
  const active = loans.filter((l) => !l.returned)
  const done = loans.filter((l) => l.returned)
  const nameOf = (id: string) => items.find((x) => x.id === id)?.name ?? 'Objet supprimé'
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">En cours ({active.length})</h2>
        <button className={btnPrimary} onClick={() => setOpen(true)}>+ Prêter</button>
      </div>
      {active.length === 0 ? <Empty title="Aucun prêt en cours" hint="Prêtez un outil depuis sa fiche ou ici." /> : (
        <ul className="space-y-2">{active.map((l) => (
          <li key={l.id} className="flex items-center gap-2 rounded-2xl bg-white dark:bg-neutral-900 p-3 text-sm shadow-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold" title={nameOf(l.itemId)}>{nameOf(l.itemId)}</p>
              <p className="text-xs text-neutral-500">À {l.toWho} · depuis le {fmtDate(l.since)}</p>
            </div>
            <button className={`${btnGhost} px-3`} onClick={() => { toggleLoanReturned(l.id); showToast('Prêt rendu — Annuler ?', () => toggleLoanReturned(l.id)) }}>Rendu</button>
            <button aria-label="Supprimer le prêt" className="touch-target rounded px-2 text-lg" onClick={() => removeLoan(l.id)}>×</button>
          </li>))}</ul>)}
      {done.length > 0 && (
        <section aria-label="Historique"><h2 className="mb-2 font-bold">Rendus ({done.length})</h2>
          <ul className="space-y-1">{done.map((l) => (
            <li key={l.id} className="truncate rounded-xl bg-neutral-100 dark:bg-neutral-800 px-3 py-2 text-xs text-neutral-500">{nameOf(l.itemId)} → {l.toWho} ({fmtDate(l.since)})</li>))}</ul>
        </section>)}
      {open && (
        <Modal title="Nouveau prêt" onClose={() => setOpen(false)}>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!itemId || !toWho.trim()) return; addLoan({ id: uid(), itemId, toWho: toWho.trim(), since: today(), returned: false, note: '' }); showToast('Prêt enregistré'); setOpen(false) }}>
            <Field label="Objet *">
              <select value={itemId} onChange={(e) => setItemId(e.target.value)} className={inputCls} required>
                <option value="">— Choisir —</option>
                {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </Field>
            <Field label="Prêté à *"><input required value={toWho} onChange={(e) => setToWho(e.target.value)} placeholder="Ex. Karim" className={inputCls} /></Field>
            <button className={`${btnPrimary} w-full`} disabled={!itemId || !toWho.trim()}>Enregistrer</button>
          </form>
        </Modal>)}
    </div>
  )
}

/* ================= Réglages : lieux, sauvegarde, compte ================= */
function SettingsPage() {
  const s = useStore()
  const [zone, setZone] = useState('')
  const [label, setLabel] = useState('')
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')

  function exportJSON() {
    const blob = new Blob([JSON.stringify({ items: s.items, locations: s.locations, logs: s.logs, loans: s.loans }, null, 2)], { type: 'application/json' })
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
        s.replaceAll({ items: d.items, locations: d.locations ?? [], logs: d.logs ?? [], loans: d.loans ?? [] })
        s.showToast('Import réussi')
      } catch { s.showToast('Fichier invalide') }
    }
    r.readAsText(f)
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
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
          <div className="flex items-center gap-2 text-sm"><span className="flex-1 truncate">Connecté : {s.userEmail}</span>
            <button className={btnGhost} onClick={() => s.signOut()}>Déconnexion</button></div>
        ) : (
          <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); setMsg(await s.signIn(email)) }}>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="votre@email.fr" className={inputCls} aria-label="E-mail" />
            <button className={btnPrimary} disabled={!email}>Recevoir le lien</button>
          </form>)}
        {msg && <p role="status" className="mt-2 text-sm">{msg}</p>}
      </section>
    </div>
  )
}

/* ================= App ================= */
function Shell() {
  const [addOpen, setAddOpen] = useState(false)
  return (
    <Layout onAdd={() => setAddOpen(true)}>
      <Routes>
        <Route path="/" element={<ItemsPage />} />
        <Route path="/objet/:id" element={<ItemDetailPage />} />
        <Route path="/alertes" element={<AlertsPage />} />
        <Route path="/prets" element={<LoansPage />} />
        <Route path="/reglages" element={<SettingsPage />} />
        <Route path="*" element={<Empty title="Page introuvable" hint="Retournez à la liste." action={<a className={btnPrimary} href="#/">Objets</a>} />} />
      </Routes>
      {addOpen && <QuickAddModal onClose={() => setAddOpen(false)} />}
      <Toaster />
    </Layout>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <HashRouter><Shell /></HashRouter>
    </StoreProvider>
  )
}
