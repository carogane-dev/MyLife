# MonApp — mise en place initiale

Structure du projet :

```
monapp/
  api/            back-end Node.js + TypeScript + Express + Prisma
  app/            front-end React + TypeScript (Vite)
  docker-compose.yml   base Postgres locale
```

Prérequis : Node.js 20+, Docker installé et lancé.

## 1. Démarrer la base de données

```bash
cd monapp
docker compose up -d
```

## 2. Configurer et démarrer le back-end

```bash
cd api
cp .env.example .env
npm install
npm run prisma:migrate    # crée les tables dans Postgres (première fois, demande un nom, ex: init)
npm run dev
```

Le back-end tourne sur http://localhost:3001. Teste avec :

```bash
curl http://localhost:3001/api/health
curl http://localhost:3001/api/health/db
```

## 3. Démarrer le front-end

Dans un autre terminal :

```bash
cd app
npm install
npm run dev
```

Ouvre l'URL affichée (http://localhost:5173). Tu dois voir "✅ Connecté au back-end".

## Prochaines étapes (une fois que tout tourne)

1. Ajouter Capacitor (mobile) et Tauri (desktop) par-dessus le front React existant.
2. Brancher une vraie route d'upload de photo + appel à un modèle de vision pour la reconnaissance de plats.
3. Construire les premiers écrans (saisie de repas, historique, stats d'habitudes).
4. Authentification utilisateur (aujourd'hui le modèle `User` existe en base mais rien ne l'utilise encore).

Dis-moi dès que les 3 étapes du dessus tournent chez toi (ou le blocage que tu rencontres), et on enchaîne.
