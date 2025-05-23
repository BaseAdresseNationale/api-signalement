# API Signalement

L'API de Signalement permet de centraliser les demandes de corrections sur les adresses présentent dans la BAN et de les mettre à disposition des communes et producteurs de données adresse.

## Documentation

A venir

## Pré-requis

- [Node.js](https://nodejs.org) 18+
- [yarn](https://www.yarnpkg.com)
- [PostgreSQL](https://www.postgresql.org/) 12+

## Utilisation

### Installation

Installation des dépendances Node.js

```
yarn
```

Créer les variables d'environnement

```bash
cp .env.sample .env
```

On pourra ensuite éditer les variables d'environnement dans le fichier `.env` si nécessaire.

### Initialisation de la DB

Afin d'initialiser la base de données, utiliser le flag SYNCHRONIZE_DB=true dans le fichier .env. Attention, une fois la base de données initialisée, il faut utiliser des migrations pour mettre à jour les schémas.

### Développement

```
$ yarn dev
```

### Production

Créer une version de production :

```
$ yarn build
```

Démarrer l'application (port 7000 par défaut) :

```
$ yarn start
```

### Test

Rapport des tests (jest) :

```
$ yarn test
```

### Linter

Rapport du linter (eslint) :

```
$ yarn lint
```

## Configuration

Cette application utilise des variables d'environnement pour sa configuration.
Elles peuvent être définies classiquement ou en créant un fichier `.env` sur la base du modèle `.env.sample`.

| Nom de la variable          | Description                      |
| --------------------------- | -------------------------------- |
| `POSTGRES_URL`              | URL de connexion à PostgreSQL    |
| `MES_ADRESSES_URL`          | URL de mes-adresses              |
| `MES_ADRESSES_API_URL`      | URL de mes-adresses-api          |
| `MES_ADRESSES_API_TOKEN`    | Token admin mes-adresses-api     |
| `API_DEPOT_URL`             | URL de l'API Dépôt               |
| `ADMIN_TOKEN`               | Token admin (à générer)          |
| `FRIENDLY_CAPTCHA_SITE_KEY` | Site key Friendy Captcha         |
| `FRIENDLY_CAPTCHA_SECRET`   | Secret Friendly Captcha          |
| `SMTP_URL`                  | URL de connexion au serveur SMTP |
| `SMTP_FROM`                 | Expéditeur SMTP                  |
| `PORT`                      | Port de l'api                    |
| `API_SIGNALEMENT_URL`       | Url de l'api                     |

## Licence

MIT
