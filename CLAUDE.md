# MonApp — contexte projet

## Objectif
Application portable sur tout type d'appareils (mobile, desktop, web) intégrant de l'IA pour :
- la reconnaissance de plats à partir de photos
- l'analyse des habitudes et préférences utilisateur

## Stack technique (décidée, à respecter)
- **Front-end** : React + TypeScript (Vite). Packagera ensuite avec **Capacitor** (mobile iOS/Android) et **Tauri** (desktop). Le même code sert aussi de PWA pour le web.
- **Back-end** : Node.js + TypeScript + Express
- **Base de données** : PostgreSQL, via **Prisma** comme ORM (schéma dans `api/prisma/schema.prisma`)
- **IA** : reconnaissance de plats via appel à un modèle de vision depuis le back-end (pas de modèle hébergé nous-mêmes pour l'instant)

## Structure du repo
```
monapp/
  api/    back-end Express + Prisma
  app/    front-end React (Vite)
  docker-compose.yml   Postgres local
```

## État actuel
- Squelette back + front en place, connexion vérifiée via route `/api/health`
- Modèles Prisma de base : `User`, `MealEntry` (avec `dishName`, `aiRawResult`)
- Pas encore fait : Capacitor/Tauri, upload de photo + appel IA vision, authentification, écrans réels

## Conventions
- Tout le code en TypeScript strict
- Commentaires et messages de commit en français
- Un seul langage (TS) sur front et back pour rester cohérent

## Prochaines étapes prioritaires
1. Route d'upload de photo + intégration modèle de vision (reconnaissance de plats)
2. Écrans : saisie de repas, historique, stats d'habitudes
3. Authentification utilisateur
4. Packaging Capacitor (mobile) et Tauri (desktop)
