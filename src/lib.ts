// Types, constantes, utils, client Supabase, compression image.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type Category =
  | 'electro' | 'velo' | 'scooter' | 'nettoyage' | 'peinture'
  | 'sup' | 'kite' | 'voile' | 'meubles' | 'outils'

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'electro', label: 'Électronique' },
  { id: 'velo', label: 'Vélo + pièces' },
  { id: 'scooter', label: 'Scooter élec.' },
  { id: 'nettoyage', label: 'Nettoyage' },
  { id: 'peinture', label: 'Peinture' },
  { id: 'sup', label: 'Stand up paddle' },
  { id: 'kite', label: 'Kitesurf' },
  { id: 'voile', label: 'Voile' },
  { id: 'meubles', label: 'Meubles stockés' },
  { id: 'outils', label: 'Outils' },
]

export const catLabel = (c: string) => CATEGORIES.find((x) => x.id === c)?.label ?? c

export type Condition = 'neuf' | 'bon' | 'moyen' | 'hs'
export const CONDITIONS: { id: Condition; label: string }[] = [
  { id: 'neuf', label: 'Neuf' },
  { id: 'bon', label: 'Bon' },
  { id: 'moyen', label: 'Moyen' },
  { id: 'hs', label: 'Hors service' },
]

// Champs spécifiques par catégorie (stockés dans items.details JSON)
export const CATEGORY_FIELDS: Record<string, { key: string; label: string; placeholder?: string }[]> = {
  peinture: [
    { key: 'refCouleur', label: 'Réf. couleur', placeholder: 'Ex. RAL 9010' },
    { key: 'marque', label: 'Marque' },
    { key: 'finition', label: 'Finition', placeholder: 'Mate / satinée…' },
  ],
  kite: [
    { key: 'taille', label: 'Taille', placeholder: 'Ex. 9 m²' },
    { key: 'type', label: 'Type', placeholder: 'Aile / barre / planche' },
  ],
  velo: [
    { key: 'taille', label: 'Taille / dimension' },
    { key: 'reference', label: 'Référence pièce' },
  ],
  scooter: [
    { key: 'batterie', label: 'Batterie', placeholder: 'Ex. 48V 15Ah' },
    { key: 'reference', label: 'Référence' },
  ],
  sup: [
    { key: 'longueur', label: 'Longueur', placeholder: 'Ex. 10’6' },
    { key: 'volume', label: 'Volume', placeholder: 'Ex. 180 L' },
  ],
  voile: [
    { key: 'longueur', label: 'Longueur / surface' },
    { key: 'greement', label: 'Gréement' },
  ],
  electro: [
    { key: 'reference', label: 'Référence' },
    { key: 'alimentation', label: 'Alimentation', placeholder: 'Ex. 230V / piles AA' },
  ],
  nettoyage: [{ key: 'contenance', label: 'Contenance', placeholder: 'Ex. 5 L' }],
  meubles: [
    { key: 'dimensions', label: 'Dimensions' },
    { key: 'materiau', label: 'Matériau' },
  ],
  outils: [
    { key: 'marque', label: 'Marque' },
    { key: 'reference', label: 'Référence' },
  ],
}

export interface Location { id: string; zone: string; label: string; isDemo?: boolean }
export interface Item {
  id: string; name: string; category: Category
  condition: Condition; quantity: number | null; isConsumable: boolean
  threshold: number | null; locationId: string | null
  notes: string; details: Record<string, string>
  price: number | null; boughtAt: string | null
  unit: string
  updatedAt: string; isDemo?: boolean
}
export interface Log { id: string; itemId: string; date: string; action: string; note: string; reminder?: string | null; repeat: string; isDemo?: boolean }
// Objet déplacé : prêté à quelqu'un, rangé ailleurs (cave, voiture, résidence…), ou en réparation.
export type MoveKind = 'pret' | 'ailleurs' | 'reparation'
export const MOVE_KINDS: { id: MoveKind; label: string }[] = [
  { id: 'pret', label: 'Prêté' },
  { id: 'ailleurs', label: 'Ailleurs' },
  { id: 'reparation', label: 'En réparation' },
]
export const moveKindLabel = (k: string) => MOVE_KINDS.find((x) => x.id === k)?.label ?? k
export interface Move { id: string; itemId: string; toWho: string; since: string; returned: boolean; note: string; due: string | null; kind: MoveKind; isDemo?: boolean }

// Intervalles d'entretien récurrent (en mois, '' = ponctuel)
export const REPEAT_OPTIONS: { id: string; label: string }[] = [
  { id: '', label: 'Ponctuel' },
  { id: '1', label: 'Mensuel' },
  { id: '3', label: 'Trimestriel' },
  { id: '6', label: 'Semestriel' },
  { id: '12', label: 'Annuel' },
]
export const repeatLabel = (r: string) => REPEAT_OPTIONS.find((x) => x.id === r)?.label ?? ''
export const COND_LABELS: Record<string, string> = { neuf: 'Neuf', bon: 'Bon', moyen: 'Moyen', hs: 'Hors service' }
export const condLabel = (c: string) => COND_LABELS[c] ?? c

// ---- Dates ISO AAAA-MM-JJ (comparables en string) ----
export const plusDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)
export function addMonthsISO(date10: string, months: number): string {
  const [y, m, d] = date10.split('-').map(Number)
  const dt = new Date(y, m - 1 + months, d)
  return dt.toISOString().slice(0, 10)
}
export const isLowStock = (i: Item) =>
  i.isConsumable && i.quantity != null && i.threshold != null && i.quantity <= i.threshold

// ---- Compteurs d'alertes partagés (badge onglet + page Alertes) ----
export interface AlertCounts { courses: number; reminders: number; redo: number; lateMoves: number; total: number }
export function countAlerts(
  d: { items: Item[]; logs: Log[]; moves: Move[]; tasks: Task[]; projects: Project[] },
  horizon = 14,
): AlertCounts {
  const t = today()
  const inH = plusDays(horizon)
  const itemOf = (id: string | null) => (id ? d.items.find((x) => x.id === id) : undefined)
  const courses =
    d.items.filter(isLowStock).length +
    d.tasks.filter((x) => {
      if (x.done || !x.itemId) return false
      const it = itemOf(x.itemId)
      if (!it) return true
      if (d.projects.find((p) => p.id === x.projectId)?.status === 'termine') return false
      return it.isConsumable && it.quantity != null && it.quantity < (x.qty ?? 1)
    }).length
  const reminders = d.logs.filter((l) => l.reminder && l.reminder <= inH).length
  const redo = d.logs.filter((l) => l.repeat && addMonthsISO(l.date, parseInt(l.repeat) || 0) <= inH).length
  const lateMoves = d.moves.filter((l) => !l.returned && l.due && l.due < t).length
  return { courses, reminders, redo, lateMoves, total: courses + reminders + redo + lateMoves }
}

// ---- Préférences (personnalisation, par appareil, incluses dans l'export) ----
export type Theme = 'auto' | 'clair' | 'sombre'
export type Accent = 'ambre' | 'bleu' | 'vert'
export type Currency = 'EUR' | 'USD' | 'CHF' | 'GBP'
export interface Prefs {
  theme: Theme; accent: Accent; currency: Currency; horizon: number
  defaultCategory: Category; defaultProjectStatus: ProjectStatus; showDemoData: boolean
}
export const DEFAULT_PREFS: Prefs = {
  theme: 'auto', accent: 'ambre', currency: 'EUR', horizon: 14,
  defaultCategory: 'outils', defaultProjectStatus: 'encours', showDemoData: true,
}
export const THEMES: { id: Theme; label: string }[] = [
  { id: 'auto', label: 'Automatique' },
  { id: 'clair', label: 'Clair' },
  { id: 'sombre', label: 'Sombre' },
]
export const ACCENTS: { id: Accent; label: string }[] = [
  { id: 'ambre', label: 'Ambre' },
  { id: 'bleu', label: 'Bleu' },
  { id: 'vert', label: 'Vert' },
]
export const CURRENCIES: { id: Currency; label: string; symbol: string }[] = [
  { id: 'EUR', label: 'Euro (€)', symbol: '€' },
  { id: 'USD', label: 'Dollar ($)', symbol: '$' },
  { id: 'CHF', label: 'Franc (CHF)', symbol: 'CHF' },
  { id: 'GBP', label: 'Livre (£)', symbol: '£' },
]
export const HORIZONS = [7, 14, 30]
export const currencySymbol = (c: string) => CURRENCIES.find((x) => x.id === c)?.symbol ?? '€'
export function fmtPrice(n: number, cur: string): string {
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: cur, maximumFractionDigits: n % 1 === 0 ? 0 : 2 }).format(n)
  } catch { return `${n} ${currencySymbol(cur)}` }
}
export function sanitizePrefs(raw: unknown): Prefs {
  const p = (raw ?? {}) as Partial<Prefs>
  const one = <T extends string>(v: unknown, list: readonly T[], fb: T): T =>
    (typeof v === 'string' && (list as readonly string[]).includes(v) ? v as T : fb)
  return {
    theme: one(p.theme, ['auto', 'clair', 'sombre'] as const, 'auto'),
    accent: one(p.accent, ['ambre', 'bleu', 'vert'] as const, 'ambre'),
    currency: one(p.currency, ['EUR', 'USD', 'CHF', 'GBP'] as const, 'EUR'),
    horizon: HORIZONS.includes(Number(p.horizon)) ? Number(p.horizon) : 14,
    defaultCategory: one(p.defaultCategory, CATEGORIES.map((c) => c.id), 'outils' as Category) as Category,
    defaultProjectStatus: one(p.defaultProjectStatus, PROJECT_STATUS.map((s) => s.id), 'encours' as ProjectStatus) as ProjectStatus,
    showDemoData: p.showDemoData !== false,
  }
}

// ---- Projets DIY ----
export type ProjectStatus = 'idee' | 'encours' | 'pause' | 'termine'
export const PROJECT_STATUS: { id: ProjectStatus; label: string }[] = [
  { id: 'idee', label: 'Idée' },
  { id: 'encours', label: 'En cours' },
  { id: 'pause', label: 'En pause' },
  { id: 'termine', label: 'Terminé' },
]
export const statusLabel = (s: string) => PROJECT_STATUS.find((x) => x.id === s)?.label ?? s
export interface Project {
  id: string; title: string; status: ProjectStatus
  notes: string
  budget: number | null; targetDate: string | null
  createdAt: string; updatedAt: string; isDemo?: boolean
}
export interface Task {
  id: string; projectId: string; label: string; done: boolean
  qty: number | null; unit: string; itemId: string | null
  createdAt: string; isDemo?: boolean
}
export interface QuickNote {
  id: string; title: string; body: string; createdAt: string; updatedAt: string
}
export const projectProgress = (tasks: Task[]) =>
  tasks.length === 0 ? 0 : Math.round((tasks.filter((t) => t.done).length / tasks.length) * 100)

// Supabase uses UUID primary/foreign keys; IDs created in the browser must match.
export const uid = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}
export const today = () => new Date().toISOString().slice(0, 10)
export const fmtDate = (d?: string | null) => {
  if (!d) return '—'
  try { return new Date(d + (d.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('fr-FR') } catch { return d }
}
export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

export function locationLabel(l: Location | undefined): string {
  if (!l) return 'Sans emplacement'
  return l.zone + (l.label ? ' › ' + l.label : '')
}

// ---- Supabase (optionnel : mode local si env absentes) ----
export const SUPA_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
export const SUPA_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const useSupabase = Boolean(SUPA_URL && SUPA_ANON)
let client: SupabaseClient | null = null
export function supa(): SupabaseClient | null {
  if (!useSupabase) return null
  if (!client) client = createClient(SUPA_URL!, SUPA_ANON!)
  return client
}

