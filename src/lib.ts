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

export interface Location { id: string; zone: string; label: string }
export interface Item {
  id: string; name: string; category: Category; photo?: string | null
  condition: Condition; quantity: number | null; isConsumable: boolean
  threshold: number | null; locationId: string | null
  notes: string; details: Record<string, string>
  updatedAt: string
}
export interface Log { id: string; itemId: string; date: string; action: string; note: string; reminder?: string | null }
export interface Loan { id: string; itemId: string; toWho: string; since: string; returned: boolean; note: string }

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

// ---- Photo : compression client avant upload ----
export async function compressPhoto(file: File, maxSide = 1280, quality = 0.78): Promise<string> {
  const bmp = await createImageBitmap(file)
  const ratio = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * ratio), h = Math.round(bmp.height * ratio)
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  return new Promise((res, rej) => {
    canvas.toBlob((b) => {
      if (!b) return rej(new Error('Compression impossible'))
      const r = new FileReader()
      r.onload = () => res(r.result as string)
      r.onerror = rej
      r.readAsDataURL(b)
    }, 'image/jpeg', quality)
  })
}
