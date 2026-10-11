# Garage 2 — guide de reprise agent

Application personnelle en français pour inventaire de garage et projets DIY. Interface mobile-first (à partir de 360 px), React 18, TypeScript strict, Vite 5, Tailwind 3 (`darkMode: class`), React Router 6 (`HashRouter`), Supabase JS v2.

## Commandes et configuration

- `npm ci`, `npm run dev`, `npm run build`, `npm run preview`.
- Sans variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`, l’application fonctionne en local avec `localStorage` (`garage2-data-v1`).
- Avec ces variables, l’page dédiée `#/connexion` utilise Supabase Auth mot de passe sur `#/connexion` avec réinitialisation e-mail; Réglages permet de modifier le mot de passe (vérification de l’ancien) ou de demander un lien de récupération. Aucun formulaire d’inscription publique. Les données cloud sont isolées par `auth.uid()` et RLS.
- Le dépôt public GitHub Pages ne doit contenir que le client Supabase public (anon/publishable). Jamais de `service_role`, clé secrète, mot de passe, fichier `.env` ou export utilisateur. `.gitignore` protège `.env*` sauf `.env.example`.

## Carte du code

- `src/main.tsx` : mount React, CSS, Service Worker en production.
- `src/lib.ts` : types métier, 10 catégories, champs spécifiques dans `Item.details` JSON, dates/alertes, préférences, client Supabase lazy.
- `src/store.tsx` : store global et seul point d’accès aux données (`useStore()`), migrations localStorage/import, CRUD, correspondance camelCase ↔ colonnes SQL, authentification, synchronisation cloud Realtime + reprise au focus, file locale des écritures hors ligne, jeux de démonstration.
- `src/projectTemplates.ts` : banque statique de modèles FR (aménagement, rénovation, entretien, loisirs nautiques, réparation). Un modèle crée un projet et ses étapes dans les tables utilisateur ordinaires ; les modèles n’ont pas de données distantes séparées.
- `src/App.tsx` : navigation et écrans inventaire, objet, alertes, déplacements, projets, détails de projet, bibliothèque de modèles, réglages, connexion/mot de passe oublié.
- `src/components.tsx` : primitives accessibles partagées (Modal, Field, Empty, Skeleton, badges, toasts, boutons).
- `src/index.css` : styles responsive, safe areas, taille tactiles, focus visible, motion réduit.
- `supabase/schema.sql` : schéma/migration réexécutable, clés étrangères composées par propriétaire, contraintes, index, privilèges et politiques RLS.
- `.github/workflows/deploy.yml` : build avec secrets d’action puis publication Pages; `HashRouter` et copie de `index.html` en `404.html`.

## Comportements à préserver

1. Toutes les données visibles et toutes mutations passent par `useStore`; toute conversion DB reste dans `store.tsx`.
2. Supabase est la source partagée après connexion. À la première connexion, les lignes locales manquantes sont fusionnées avec le cloud (cloud prioritaire en cas d’identifiant commun); le marqueur `garage2-data-v1-cloud-linked-<uid>` empêche de ressusciter ensuite des suppressions depuis un ancien cache.
3. Écritures échouées mises en attente sous `garage2-data-v1-pending-<uid>` et retentées au retour d’une session/réseau. Préserver une erreur visible plutôt que prétendre que la sync a réussi.
4. `isDemo` / `is_demo` est un marqueur de données fictives présent sur les six tables. « Afficher » est une préférence propre à l’appareil : masquer filtre les données en mémoire/UI, sans suppression du cloud. Ne pas confondre avec suppression d’exemples.
5. Le bouton de démonstration ajoute un lot relationnel cohérent (lieux → objets → journal/déplacement/projet → tâches) et ne le duplique pas. Les exemples cloud sont liés au compte authentifié et filtrés par RLS.
6. Les modèles restent du contenu statique dans `src/projectTemplates.ts`; modifier le type/présentation dans cette source, pas le schéma. À la sélection, copier champs et étapes dans des UUID nouveaux.
7. Un champ métier neuf doit avoir des valeurs sûres dans `migrate()`, une conversion DB explicite et une migration SQL idempotente si colonne nécessaire.
8. UI française, dark mode, contrôles tactiles, modale unique, confirmation avant suppression destructive, toast d’annulation quand pertinent.
9. N’ajouter aucune clé `service_role`/secret au bundle ou à GitHub Pages. Les clés `VITE_*` sont exposées au navigateur et sécurisées par Auth/RLS.

## Tables et sécurité

Tables `locations`, `items`, `maintenance_logs`, `moves` (ancien nom `loans` migré), `projects`, `project_tasks`. Chaque table a `user_id`; politiques CRUD `authenticated` imposent `auth.uid() = user_id`, et les FK composées interdisent de relier les lignes appartenant à différents comptes. Les rôles `anon` et `public` n’ont aucun privilège de table; `authenticated` a seulement `SELECT`, `INSERT`, `UPDATE`, `DELETE` (jamais `TRUNCATE`, `TRIGGER` ou `REFERENCES`), sous RLS. La capture/import de photos a été retirée ; les anciennes colonnes `photo_url` sont conservées comme champs historiques inertes pour compatibilité, jamais affichées ni réécrites par le client.

Après toute évolution DB, exécuter `supabase/schema.sql` dans SQL Editor puis vérifier la présence des six tables, RLS active, politique propriétaire, FK/index et grants. Ne jamais mettre de mot de passe utilisateur dans le dépôt ou demander de le coller dans le chat.

## Déploiement et vérification

Dépôt public : `Optimist97/garage2`; site : `https://optimist97.github.io/garage2/`; Pages par GitHub Actions. La workflow requiert les secrets de dépôt `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, utilisés uniquement pendant le build public. Supabase Auth URL Configuration doit autoriser l’origine Pages et les inscriptions doivent rester désactivées pour le mode utilisateur unique. Vérifier le rapport Actions, chargement mobile/desktop, connexion, CRUD, synchronisation sur un second appareil, mode hors ligne, restauration de mot de passe, export/import, et l’absence de clé secrète dans le JS construit.

Historique de cette reprise : ajout d’un écran Auth mot de passe, synchro au chargement/retour d’onglet et file hors-ligne, schéma RLS renforcé et contraintes par propriétaire, marqueur des exemples démo + masquage local, banque de 9 modèles de projet, `.gitignore` étendu. Les données fictives sont distinctement marquées et ne contiennent pas de renseignements personnels.
