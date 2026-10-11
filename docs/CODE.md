# Garage 2 — architecture et évolution

## Vue d’ensemble

Application personnelle d’inventaire de garage et de suivi DIY, en français et mobile-first. Stack : React 18, TypeScript strict, Vite 5, Tailwind 3, React Router 6 avec `HashRouter`, Supabase JS v2. Sans configuration Supabase, le mode local utilise `localStorage`; avec les variables de build Vite, la connexion Supabase Auth donne accès au garage synchronisé entre appareils.

## Flux des données

```text
App.tsx ──useStore()──> store.tsx ──> localStorage + Supabase Auth/PostgREST
                             ├── mapping des six tables et file des écritures hors ligne
                             ├── migrations/import local JSON
                             └── marquage/filtrage des données de démonstration
lib.ts : types, constantes, validation, dates, alertes et client Supabase
projectTemplates.ts : modèles statiques copiés en projets utilisateur normaux
components.tsx : primitives UI accessibles partagées
```

## Données et synchronisation

Les six ensembles synchronisés sont `locations`, `items`, `maintenance_logs`, `moves`, `projects`, `project_tasks`. Chaque ligne cloud inclut `user_id`; RLS autorise uniquement le compte connecté. La première connexion fusionne les lignes locales manquantes et préserve les valeurs cloud pour les mêmes UUID. Un marqueur par utilisateur évite qu’un vieux cache recrée plus tard des données supprimées. Les six tables sont incluses dans `supabase_realtime`; un événement autorisé lance un `pull()` groupé avec debounce. Le focus/retour de visibilité déclenche également une reprise. Les écritures échouées sont placées dans une file par compte et retentées à la prochaine synchronisation. Au changement de session, le store recharge les données cloud. Les préférences d’affichage, y compris la visibilité démo, restent propres à chaque appareil.

## Démonstration et modèles

Les exemples se chargent explicitement depuis Réglages. Ils incluent lieux, objets/consommables, un stock bas, rappel d’entretien, déplacement et projet avec tâches liées. Le champ SQL `is_demo` (TypeScript `isDemo`) les identifie. « Afficher » ne fait que filtrer le store présenté à l’interface; aucune ligne n’est supprimée. Pour remplacer ou réinitialiser un jeu, ajouter une action de suppression explicite et confirmée, avec cascade gérée par les clés étrangères.

La bibliothèque de 9 modèles est intégrée dans `src/projectTemplates.ts`, sans dépendance réseau. Chaque modèle fournit un titre, groupe, résumé, note de sécurité, budget indicatif et liste d’étapes. L’utiliser crée un projet et des tâches avec de nouveaux UUID dans les tables synchronisées habituelles. Les budgets de modèle sont des suggestions modifiables, pas des devis.

## Référence modules

- `src/lib.ts` : catégories, propriétés de fiche, `Item/Location/Log/Move/Project/Task`, alertes, préférences, formats, Supabase lazy.
- `src/store.tsx` : API métier unique, migration des anciennes données, état session, sync cloud, opérations CRUD et file de reprise réseau. Toute colonne ajoutée exige mapping dans les deux sens ici.
- `src/projectTemplates.ts` : données éditoriales de la bibliothèque.
- `src/App.tsx` : routes et interfaces; écran de connexion par mot de passe et récupération du mot de passe; réglages, démo et modèles.
- `src/components.tsx` / `src/index.css` : modales, primitives, focus, tailles tactiles et responsive.
- `supabase/schema.sql` : SQL réexécutable pour le schéma, migrations, contraintes, indexes, RLS/grants.
- `.github/workflows/deploy.yml` : construit `dist/`, ajoute le fallback Pages et déploie.

## Changer le schéma sans casser l’app

1. Modifier les types TS et définir des valeurs de migration sûres.
2. Modifier le mapping de lecture et d’écriture dans `src/store.tsx`.
3. Ajouter une migration idempotente dans `supabase/schema.sql`, avec contrainte et index utiles.
4. Si le nouveau champ change les permissions, revoir explicitement `GRANT`, RLS et tests d’accès anonyme/propriétaire.
5. `npm run build`, appliquer SQL, contrôler RLS/grants/FK/index, puis tester les opérations depuis deux appareils.

## Sécurité et déploiement

Le dépôt et le bundle GitHub Pages sont publics. Toute variable `VITE_*` est visible côté navigateur : seules l’URL du projet et la clé anon/publishable sont admissibles, jamais `service_role`, secret key, mot de passe ni fichier `.env`. Les tables refusent les requêtes anonymes et appliquent RLS `auth.uid() = user_id`; `authenticated` ne reçoit que `SELECT`, `INSERT`, `UPDATE`, `DELETE` (sans `TRUNCATE`, `TRIGGER` ni `REFERENCES`). Les liens inter-tables utilisent des FK composées sur `user_id`. Les anciens champs `photo_url` éventuels sont conservés en base comme historique inerte, mais ne sont plus lus ni écrits par l’application. La fonction photo et les contrôles de capture/import sont supprimés.

Configurer `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` comme GitHub Actions Secrets pour l’organisation/dépôt `Optimist97/garage2`, pas dans le code. Autoriser `https://optimist97.github.io/garage2/` dans Auth URL Configuration. Maintenir l’inscription publique désactivée; créer le compte propriétaire depuis le dashboard et saisir son mot de passe directement dans l’interface Supabase.

Contrôle de livraison : `npm run build`; rechercher les clés `service_role`/secret et données privées dans les fichiers et artefacts publics; vérifier le résultat GitHub Actions et Pages; connexion/connexion erronée/réinitialisation, CRUD, synchro second appareil et reprise réseau; comparer les données avant/après migration et vérifier RLS et intégrité relationnelle.
