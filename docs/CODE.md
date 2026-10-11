# Garage 2 — Documentation standardisée du code

> Convention : chaque module est décrit avec le même gabarit
> **Rôle / Dépendances / Exports / Notes**.
> Source de vérité : le code. Ce doc ne duplique pas les implémentations.

## Vue d'ensemble

- **Produit** : inventaire personnel mono-utilisateur pour un garage de bricoleur (FR).
- **Stack** : React 18 + TypeScript strict + Vite 5 + Tailwind 3 (`darkMode: media`) + react-router-dom 6 (`HashRouter`) + `@supabase/supabase-js` 2.
- **Stratégie données** : localStorage = source de vérité immédiate ; Supabase = sync bonus quand `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` sont définies, sinon mode local intégral.
- **Build vérifié** : `npm run build` → `tsc --noEmit && vite build`, sortie `dist/` statique (~460 Ko).

## Flux de données

```
UI (App.tsx) → useStore() (store.tsx) → setData + localStorage + push() Supabase
                                                ↘ toast Annuler (restaure snapshot)
lib.ts = types + constantes + utils purs + client Supabase lazy + compressPhoto()
components.tsx = primitives UI partagées (Modal, Toaster, Field, Empty, Skeleton…)
```

## Modules

### `src/main.tsx` (13 l.)
- **Rôle** : point d'entrée. Monte `<App/>` (StrictMode), importe `index.css`, enregistre `sw.js` **en prod uniquement**.
- **Dépendances** : `react`, `react-dom/client`, `./App`, `./index.css`.
- **Exports** : aucun (effet de bord uniquement).
- **Notes** : `import.meta.env.PROD` évite d'enregistrer le SW en dev.

### `src/lib.ts` (127 l.)
- **Rôle** : socle typé + constantes métier + utils purs + accès Supabase + image.
- **Dépendances** : `@supabase/supabase-js` (types + `createClient`).
- **Exports** :
  - Types : `Category` (10 valeurs), `Condition` (`neuf|bon|moyen|hs`), interfaces `Location{id,zone,label}`, `Item{id,name,category,photo?,condition,quantity?,isConsumable,threshold?,locationId?,notes,details,updatedAt}`, `Log{id,itemId,date,action,note,reminder?}`, `Loan{id,itemId,toWho,since,returned,note}`.
  - Constantes : `CATEGORIES[10]`, `CONDITIONS[4]`, `CATEGORY_FIELDS` (champs spécifiques/catégorie stockés dans `Item.details`), `SUPA_URL`, `SUPA_ANON`, `useSupabase: boolean`.
  - Fonctions : `catLabel(c)`, `locationLabel(l)` (`"zone › label"`), `uid()`, `today()` (AAAA-MM-JJ), `fmtDate(d)` (fr-FR, `—` si vide), `norm(s)` (minuscules + sans accents, pour la recherche), `supa()` (singleton lazy, `null` si non configuré), `compressPhoto(file, maxSide=1280, quality=0.78): Promise<dataURL>` (via `createImageBitmap` + canvas JPEG).
- **Notes** : aucun état React ici. `details: Record<string,string>` = extensibilité sans migration SQL.

### `src/store.tsx` (128 l.)
- **Rôle** : unique store global (Contexte React). Persistance locale + sync cloud + toasts.
- **Dépendances** : `react`, `./lib` (types, `supa`, `useSupabase`, `uid`).
- **Exports** : `Toast{id,msg,actionLabel?,onAction?}`, `useStore(): Store`, `StoreProvider`.
- **API `Store`** : `items, locations, logs, loans, ready, userEmail, cloud, toast` + `showToast(msg, undo?)`, `addItem/updateItem/removeItem`, `addLocation/removeLocation`, `addLog/removeLog`, `addLoan/toggleLoanReturned/removeLoan`, `replaceAll(d)` (import JSON), `signIn(email): Promise<msg>`, `signOut()`.
- **Internes** : `KEY='garage2-data-v1'`, `seed()` (3 lieux + 2 objets démo), `load()` (merge seed + localStorage, try/catch), `pull()` (hydrate depuis Supabase si session), `toItem/toRow` (mapping camelCase ↔ snake_case), `push(table, 'upsert'|'delete', …)` (silencieux en échec : le local reste la vérité).
- **Notes** : `removeItem` supprime en cascade logs/prêts liés + propose Annuler (snapshot `backup`). `updateItem` re-tamponne `updatedAt`.

### `src/components.tsx` (130 l.)
- **Rôle** : primitives UI partagées, responsive + accessibles.
- **Dépendances** : `react`, `./store` (`Toaster` lit `toast`).
- **Exports** :
  - `Modal{title,onClose,children}` : bottom-sheet mobile / dialogue centré PC (`sm:`), `max-h-[88dvh]` + scroll interne, ferme par bouton × / clic overlay / `Échap` / swipe-bas (>110px), focus-trap + retour focus, `body.overflow=hidden`, `role=dialog aria-modal`.
  - `Toaster()` : toast bas-centré (au-dessus bottom-nav), auto-hide 4,5 s, bouton Annuler si `onAction`.
  - `Field{label,children}`, `Empty{title,hint,action?}`, `Skeleton()` (3 placeholders), `CondBadge{c}` (couleur/état, dark-mode inclus).
  - Constantes : `inputCls`, `btnPrimary` (ambre), `btnGhost` (neutre).
- **Notes** : une seule modale à la fois (états booléens dans `App.tsx`). Classes `.touch-target` (≥44px) et `.img-fixed` (ratio 4:3) définies dans `index.css`.

### `src/App.tsx` (542 l.)
- **Rôle** : routage + toutes les pages + modales métier.
- **Dépendances** : `react-router-dom`, `./store`, `./lib`, `./components`.
- **Exports** : `QuickAddModal` (nommé, réutilisable), `default App` (`StoreProvider` + `HashRouter` + `Shell`).
- **Composants internes** :
  - `Layout{children,onAdd}` : sidebar PC (`sm:`, nav + « + Ajouter ») / header + bottom-nav + FAB mobile. Routes : `/` liste, `/objet/:id` fiche, `/alertes`, `/prets`, `/reglages`, `*` 404.
  - `ItemsPage` : recherche instantanée (`norm()` sur nom+notes+catégorie+lieu+détails), filtres catégorie/état/lieu, groupement par catégorie trié fr, cartes (photo ou initiale, lieu, badge, pastille « À racheter »), `Skeleton` si `!ready`, `Empty` + reset sinon.
  - `ItemDetailPage` : photo, quantité −/+ (consommables), détails, bandeau prêt actif, journal (CRUD), prêt, suppression **confirmée** (seule modale destructive).
  - `LogModal` : action* + note + rappel date → `addLog`. `LoanModal` : prêté à* → `addLoan`.
  - `QuickAddModal` : nom* + catégorie* + photo suffisent ; reste dans `<details>` repliable (état, lieu, consommable→quantité/seuil, champs `CATEGORY_FIELDS[cat]`, notes) → `addItem` + navigue vers la fiche.
  - `AlertsPage` : « À racheter » (`quantity ≤ threshold`) + « Rappels » (`reminder ≤ J+14`).
  - `LoansPage` : en cours (bouton Rendu annulable) + historique rendus + création (objet* + à qui*).
  - `SettingsPage` : CRUD lieux `zone › label` (+ compteur objets), export JSON (download `garage2-AAAA-MM-JJ.json`), import JSON (validé : `items` tableau requis), compte magic-link ou mode local expliqué.
- **Notes** : tous les selects/inputs ont `aria-label`, textes longs en `truncate` + `title`, formulaires avec `required` + boutons `disabled` tant qu'invalides.

### `src/index.css` (29 l.)
- **Rôle** : directives Tailwind + fondations UX mobiles.
- **Contenu** : thème neutre + dark auto, `.app-shell` (`100dvh` + safe-area), `.touch-target` 44px, `.img-fixed` 4:3, `.no-x`, `.truncate-2`, animations `sheet-up`/`fade-in` désactivées sous `prefers-reduced-motion`, `font-size:16px` sur champs (anti-zoom iOS), `:focus-visible` bleu.

### `src/vite-env.d.ts` — `/// <reference types="vite/client" />` (typage `import.meta.env`).

## Config & infra

| Fichier | Rôle |
|---|---|
| `index.html` | `lang=fr`, `viewport-fit=cover`, `theme-color`, manifest + icône, `#root` |
| `vite.config.ts` | `react()`, `base: './'` (Pages-safe, tout sous-chemin) |
| `tailwind.config.js` | `content: index+src`, `darkMode: 'media'` (sombre auto) |
| `supabase/schema.sql` (99 l.) | 4 tables (`locations`, `items`+`details jsonb`, `maintenance_logs`, `loans`), index, trigger `updated_at`, RLS `own_all` (`auth.uid()=user_id`), bucket privé `photos` + politique dossier=`user_id` |
| `.github/workflows/deploy.yml` (45 l.) | `npm ci` → build (secrets `VITE_SUPABASE_URL/ANON_KEY`) → `cp dist/index.html dist/404.html` → `upload-pages` → `deploy-pages` |
| `public/manifest.webmanifest` | PWA installable (`standalone`, `./`) |
| `public/sw.js` (16 l.) | Cache app-shell, network-first → fallback cache/`index.html`, purge vieilles versions |
| `public/404.html` | Secours (écrasé par le workflow) ; inutile avec `HashRouter` mais inoffensif |
| `public/icon.svg` | Icône « G2 » |
| `.env.example` | 2 vars optionnelles (vide = mode local) |

## Conventions de modification

1. **État** : tout passe par `useStore()` ; ne pas créer de second store. Mapping DB ↔ app via `toItem/toRow` dans `store.tsx`.
2. **Champs catégorie** : ajouter une entrée à `CATEGORY_FIELDS` dans `lib.ts` — aucun SQL ni migration requis (`details` JSONB).
3. **UI** : réutiliser `Modal/Field/Empty/btnPrimary/btnGhost/inputCls` ; tactiles ≥44px ; FR ; dark via classes `dark:` ; vérifier 360px + PC.
4. **Modales** : une seule à la fois, destructive ⇒ confirmation + toast Annuler.
5. **Secrets** : `VITE_*` uniquement, jamais `service_role` côté front.
