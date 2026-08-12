# MonApp — contexte projet

## Objectif
Application portable (mobile, desktop, web) de suivi nutritionnel gamifié : inventaire de frigo, objectifs caloriques personnalisés, composition de repas automatique, base de recettes communautaire, reconnaissance de plats par photo (IA vision).

## Stack technique (décidée, à respecter)
- **Front-end** : React + TypeScript (Vite), react-router-dom. PWA (manifest + icônes) pour mobile/installation. Packaging desktop natif via **Tauri** (`app/src-tauri/`, voir section dédiée ci-dessous).
- **Back-end** : Node.js + TypeScript + Express
- **Base de données** : PostgreSQL via **Prisma** (`api/prisma/schema.prisma`)
- **IA** : reconnaissance de plats via l'API Anthropic (vision), appelée depuis le back-end (`api/src/visionClient.ts`) — dégradation propre si `ANTHROPIC_API_KEY` absente

## Structure du repo
```
monapp/
  api/    back-end Express + Prisma
  app/    front-end React (Vite) + app/src-tauri/ (packaging desktop)
  docker-compose.yml   Postgres local
```

## Démarrer le projet
```
docker compose up -d        # Postgres (si pas déjà lancé, voir `docker ps`)
cd api && npm run dev        # back-end sur http://localhost:3001
cd app && npm run dev        # front-end sur http://localhost:5173
```
Vérifier la connexion via le bandeau "✅ Back-end connecté" dans l'app, ou `GET /api/health`.

Pour la version desktop (fenêtre native via Tauri, réutilise les mêmes back-end/front-end déjà lancés ci-dessus) :
```
cd app && npm run desktop:dev     # ouvre une fenêtre native pointant sur la devUrl Vite
cd app && npm run desktop:build   # construit un exécutable installable (non testé, voir section dédiée)
```

## État actuel
Fonctionnalités en place et vérifiées de bout en bout :
- **Auth** : inscription/connexion par session (token opaque, cookie httpOnly)
- **Frigo** : CRUD complet, scan code-barres (OpenFoodFacts), péremption, tri
- **Profil nutrition** : onboarding, calcul BMR/TDEE, 4 modes d'objectif (Libre / Chill / Rester en forme / Élite avec morphologie)
- **Suivi de consommation** : "manger un article", barres de progression journalières, historique par jour (`HistoryPage`)
- **Composeur de repas** : algorithme de budget par macro (calories/protéines/lipides/glucides converge à 5 % près de l'objectif en fin de journée), deux sources — frigo (`mealBuilder.ts`) ou recette adaptée (`recipeMatcher.ts`)
- **Recettes communautaires** : base publique partagée entre comptes, likes, tri/filtres, ingrédients "libres" (quantité ajustable par le composeur) vs. socle fixe
- **Planning hebdomadaire** (`weekPlanner.ts` + `routes/weekPlan.ts`) : 21 repas (J+1 à J+7) composés à partir des recettes, revue swipe accepter/refuser, apprentissage des goûts (affinité par recette), variété imposée, priorité aux ingrédients du frigo qui périment bientôt (respecte créneau/catégorie), liste de courses agrégée avec soustraction du stock actuel, échange d'un repas par bannissement d'ingrédient (session uniquement, ne touche jamais l'apprentissage des goûts)
- **Accueil** : vue du jour (repas mangés/proposés/vides par créneau), widget "Autonomie frigo" (jours couverts par le stock actuel), gamification (points, niveaux, badges, séries), séparation "fonctions définitives" / "fonctions en test"
- **Page Courses** : liste de courses de la semaine + repas que le planning n'a pas réussi à composer automatiquement (lien vers le composeur manuel)
- **Reconnaissance de plats par photo** : upload + appel Claude vision, macros éditables avant journalisation
- **PWA** : installable sur mobile (manifest, icônes, meta tags), scroll verrouillé vertical-only
- **Design system** : tokens CSS (couleurs, radius, ombres, typo), dark mode, composants Card/Button/Skeleton/Toast génériques, bottom tab bar, transitions de page

## Packaging desktop (Tauri)
- `app/src-tauri/` : projet Rust généré par `tauri init`, config dans `tauri.conf.json` (`devUrl` → Vite, `frontendDist` → `../dist`). Aucune commande Tauri custom pour l'instant : la fenêtre affiche juste le front, tout passe par les mêmes appels API `fetch` que le navigateur.
- **`app/src/api.ts`** : `API_BASE_URL` bascule sur `http://localhost:3001` en absolu quand `__TAURI_INTERNALS__` est détecté dans `window` (dev et build) — la fenêtre Tauri ne bénéficie jamais du proxy Vite (`/api` → `:3001`, voir `vite.config.ts`), qui n'existe que pour le navigateur.
- **CORS** (`api/src/index.ts`) : `CORS_ORIGIN` accepte une liste séparée par des virgules. `tauri dev` charge `http://localhost:5173`, déjà autorisé par défaut. **`tauri build`** (app packagée) charge le front depuis `http://tauri.localhost` (confirmé en pratique sur Windows, sans port) — il faut l'ajouter à `CORS_ORIGIN` dans `api/.env` : `CORS_ORIGIN=http://localhost:5173,http://tauri.localhost` (voir `.env.example`). Sans ça, les requêtes atteignent bien le serveur (visible côté back-end) mais sont bloquées côté navigateur, silencieusement, avant même d'arriver au JS.
- **Prérequis machine** : toolchain Rust (installée via `rustup`, dans le profil utilisateur, pas besoin d'admin) + Visual Studio C++ Build Tools sur Windows (nécessite les droits admin, à installer manuellement — [vs_BuildTools.exe](https://aka.ms/vs/17/release/vs_BuildTools.exe), workload "Développement Desktop en C++"). Sans les Build Tools, `cargo`/`tauri` ne peuvent rien compiler.
- **`tauri dev` et `tauri build` vérifiés tous les deux** : build release ~1 min, génère `app/src-tauri/target/release/bundle/msi/MonApp_0.1.0_x64_en-US.msi` et `.../nsis/MonApp_0.1.0_x64-setup.exe` (installeurs), plus l'exécutable brut `app/src-tauri/target/release/app.exe` (utilisable direct, sans installation). Vérifié via requêtes réellement reçues par le back-end (log temporaire) + en-tête `Access-Control-Allow-Origin` confirmé après ajout de `http://tauri.localhost` à `CORS_ORIGIN`.

## Conventions
- TypeScript strict partout ; commentaires et messages de commit en français
- Duplication délibérée de certains modules front/back (`nutritionCalculator.ts`, `unitConversion.ts`) pour partager la même logique de calcul sans dépendance croisée — à garder synchronisés à la main. Le reste (ex. matching de recettes) reste côté serveur uniquement.
- Séparation quantité affichée / quantité de référence (`displayQuantity`/`displayUnit` vs. grammes réels) sur `FridgeItem` et `RecipeIngredient` : évite qu'une unité comme "pièce" soit confondue avec des grammes dans les calculs de macros.

## Workflow git établi
Une branche par fonctionnalité : implémenter → vérifier dans le navigateur avec un compte de test jetable (créé puis supprimé après coup) → commit → `git merge --no-ff` dans `main` → push branche + `main`. Après un merge, toujours vider `app/node_modules/.vite` et redémarrer le serveur front avant de vérifier (sinon Vite sert du code périmé).

## Pièges Windows connus
- `tsx watch` verrouille le moteur Prisma : tuer le processus avant `prisma migrate dev` (sinon `EPERM`)
- Après un `git checkout`/merge, le cache Vite peut servir une version périmée du code — toujours le vider (voir workflow ci-dessus)
- Docker Desktop peut s'arrêter silencieusement entre deux sessions de travail — `docker ps` échoue avec une erreur de pipe, relancer `Docker Desktop.exe` et attendre qu'il soit prêt avant de continuer

## Prochaines étapes possibles
1. Terminer et vérifier le packaging desktop Tauri (`tauri dev`/`tauri build`) une fois les Build Tools installés
2. Packaging mobile natif (Capacitor) — la PWA couvre déjà l'usage mobile courant, à évaluer si un vrai besoin apparaît
