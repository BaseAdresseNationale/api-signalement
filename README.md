# API Signalement

Api de signalement pour le system Base adresse locale

## Documentation

A venir

## Pré-requis

- [Node.js](https://nodejs.org) 18+
- [yarn](https://www.yarnpkg.com)
- [MongoDB](https://www.mongodb.com) 4+

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

### Développement

Lancer l'application (worker + api) :

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

| Nom de la variable | Description                          |
| ------------------ | ------------------------------------ |
| `MONGODB_URL`      | Paramètre de connexion à MongoDB     |
| `MONGODB_DBNAME`   | Nom de la base de données à utiliser |
| `PORT`             | Port de l'api                        |

## Licence

MIT
