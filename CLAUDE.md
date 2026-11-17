# CLAUDE.md

API de signalement : centralise les demandes de correction d'adresses (créées par les usagers via mes-signalements ou par des sources partenaires) et les met à disposition des communes (via mes-adresses) et des producteurs de données. Gère aussi les alertes, les sources/clients, les paramètres par commune et l'authentification ProConnect.

## Commandes

```bash
yarn                          # install (yarn uniquement)
cp .env.sample .env
yarn dev                      # API en watch
yarn build && yarn start
yarn lint                     # eslint --fix
yarn test                     # jest sur src/**/*.spec.ts (tests dans src/tests/, testcontainers → Docker requis)
yarn test src/tests/signalement.spec.ts   # un seul fichier
yarn typeorm:migration:run    # datasource : src/config/typeorm.ts
yarn typeorm:migration:revert
yarn generate:openapi:mes-adresses-api   # régénère src/openapi/mes-adresses-api (mes-adresses-api doit tourner en local)
```

Node 24 (`engines`).

## Architecture

NestJS + TypeORM/Postgres.

- `src/modules/signalement/` : cœur métier (entité, service, DTO, schémas JSON de validation des changements proposés).
- `src/modules/alert/` : alertes (signalements sans proposition de correction).
- `src/modules/source/`, `client/` : qui crée des signalements (sources publiques/privées, tokens client).
- `src/modules/setting/` : paramètres par commune (signalements activés/désactivés), avec cache rafraîchi chaque heure.
- `src/modules/report/`, `stats/`, `tiles/` : consultation, statistiques, tuiles vectorielles.
- `src/modules/proconnect/` : connexion des agents ; `task/` : crons (`@Cron`) de notifications et nettoyage.
- `src/modules/mes-adresses-api/`, `api-depot/`, `bal-admin/`, `datagouv/` : clients externes. `src/openapi/mes-adresses-api/` est **généré — ne pas éditer**.
- `src/migrations/` : migrations TypeORM (dans `src/`, contrairement aux autres repos).
- `src/email-templates/` : mails envoyés aux communes et usagers.

## Points d'attention

- `synchronize: false` (le flag `SYNCHRONIZE_DB=true` ne sert qu'à initialiser une base vide) → toute modif d'entité nécessite une migration dans `src/migrations/`.
- Contrat consommé par mes-adresses et mes-signalements via leurs clients OpenAPI générés : un changement de DTO/route doit être répercuté là-bas (`generate:openapi:signalement`).
