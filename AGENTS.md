# AGENTS.md — Garage 2 (contexte agent, tokens min.)

Inventaire garage mono-user (FR), mobile-first. React18+TS strict+Vite5+Tailwind3+RR6 HashRouter+Supabase(opt).
Sans Supabase → mode local 100% (localStorage). Détails : `docs/CODE.md`.

## Commandes
`npm ci|dev|run build`(tsc+vite→`dist/`) | `preview` | Secrets front: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (vides=local).

## Carte (rôle:1 ligne)
- `src/main.tsx`: mount+css+SW(prod seul).
- `src/lib.ts`: types `Item/Location/Log/Loan`, `CATEGORIES`(10), `CONDITIONS`(4), `CATEGORY_FIELDS`→`Item.details` JSON (extensible sans SQL), `uid/today/fmtDate/norm/locationLabel`, `supa()` lazy/null, `compressPhoto()`→dataURL JPEG 1280/0.78.
- `src/store.tsx`: store unique `useStore()`; clé `garage2-data-v1`; CRUD items/lieux/logs/prêts; delete-item cascade+toast Annuler; `replaceAll`=import; `signIn`(magic link)/`signOut`; sync Supabase best-effort (`toItem/toRow`, local=vérité).
- `src/components.tsx`: `Modal` sheet-mobile/dialog-PC 88dvh, ferme ×/overlay/Échap/swipe, focus-trap, `role=dialog`; `Toaster`+Annuler; `Field/Empty/Skeleton/CondBadge`; `inputCls/btnPrimary(ambre)/btnGhost`.
- `src/App.tsx`: `Layout` sidebar-PC/bottom-nav+FAB-mobile; routes `/`(recherche instantanée `norm()`+filtres cat/état/lieu, groupes triés), `/objet/:id`(qté±, journal+rappel, prêt, delete confirmée), `QuickAddModal`(nom+cat. requis, reste en `<details>`), `/alertes`(stock≤seuil, rappels≤J+14), `/prets`(Rendu annulable), `/reglages`(lieux `zone›label`, export/import JSON, compte).
- `src/index.css`: 100dvh+safe-area, touch≥44px, img 4:3, réduit-motion, champs 16px, focus-visible.
- `supabase/schema.sql`: tables `locations/items(details jsonb)/maintenance_logs/loans`, RLS `own_all (auth.uid()=user_id)`, bucket privé `photos` (dossier=user_id). À coller dans SQL Editor.
- `.github/workflows/deploy.yml`: ci→build(secrets)→`cp dist/index.html dist/404.html`→Pages. `vite.config.ts: base:'./'`.
- `public/`: manifest+PWA `sw.js`(app-shell, network-first), `404.html`(secours), `icon.svg`.

## Déployer (condensé)
1. Supabase: New project(EU) → SQL Editor: coller `supabase/schema.sql` → Storage: bucket privé `photos` → Auth: Email Magic Link ON → URL config: ajouter `https://<user>.github.io/garage2/` → copier URL+anon key.
2. GitHub: dépôt `garage2`, push `main`; Pages→Source “GitHub Actions”; Secrets Actions: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; push → `https://<user>.github.io/garage2/`.

## Règles modif
État via `useStore()` only; map DB dans `store.tsx`; nouveau champ catégorie = 1 entrée `CATEGORY_FIELDS` (pas de SQL); UI: primitifs `components.tsx`, FR, `dark:`, 360px+PC, 1 modale à la fois, destructeur⇒confirm+Annuler; jamais `service_role` au front.
