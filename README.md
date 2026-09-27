# Data Spain

Application personnelle pour visualiser le marché de la compraventa de logements en **Catalogne**, à la manière de DVF en France, mais à partir de **statistiques agrégées** : l'Espagne ne publie pas les prix de vente individuels.

> Datos agregados por zona — no son precios de venta individuales.

Architecture 100 % statique : un pipeline Node.js produit des fichiers JSON dans `public/data/`, lus par une application React.

## État d'avancement

| Étape | Contenu                                                             | État    |
| ----- | ------------------------------------------------------------------- | ------- |
| 1     | Exploration des sources ([rapport](docs/01-exploration-sources.md)) | ✅      |
| 2     | Prototype sur Girona : pipeline, données, fiche commune             | ✅      |
| 3     | Toute la Catalogne, carte choroplèthe, sélecteurs                   | à venir |
| 4     | Couche cadastrale et infos parcelle                                 | à venir |
| 5     | Barcelone par barri, comparateur, classements                       | à venir |
| 6     | Finitions, PWA, page méthodologie, Action planifiée, déploiement    | à venir |

## Sources

| Source                                                               | Contenu                                                                                                                                                                                                                                | Utilisation                  |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Secretaria d'Habitatge (Generalitat), à partir des **Registradores** | Nombre de compraventas, surface moyenne, prix moyen, prix moyen €/m² construit ; neuf libre / neuf protégé / ancien ; communes (> 5 000 hab. jusqu'en 2024, > 2 000 depuis 2025), comarques, provinces, Catalogne ; 2013 → aujourd'hui | Source principale            |
| Ministerio de Vivienda (MIVAU), à partir des **notaires**            | Nombre de transactions de logements (total, neuf, seconde main) pour les 947 communes ; 2004 → aujourd'hui                                                                                                                             | Volumes, indicateur distinct |
| Idescat                                                              | Codes et noms officiels des communes et comarques                                                                                                                                                                                      | Référentiel                  |

Détails, limites et licences : [docs/01-exploration-sources.md](docs/01-exploration-sources.md).

Règles appliquées :

- aucune donnée inventée, interpolée ou extrapolée : une valeur absente reste absente (« sin datos suficientes ») ;
- secret statistique : pas de prix en dessous de 3 ventes ;
- chaque chiffre affiché indique sa source et sa période ;
- les deux mesures des volumes (registre / notaires) ne sont jamais mélangées ;
- les « 4 trimestres glissants » sont ceux publiés par la Generalitat (moyenne des prix au m² de chaque vente), jamais recalculés.

## Développement local

Prérequis : Node.js 22.

```bash
npm install
npm run dev          # application sur http://localhost:5173
```

## Pipeline de données

```bash
npm run pipeline                           # commune pilote (Girona)
npm run pipeline -- --municipios=17079,08019
npm run pipeline -- --todos                # toutes les communes
```

Le pipeline :

1. découvre les tableaux publiés sur le site de la Secretaria d'Habitatge (2013 → aujourd'hui, XLS puis XLSX) ;
2. lit chaque feuille à partir de ses en-têtes et de son titre « Període », et échoue bruyamment si le format change ;
3. apparie les communes du MIVAU (identifiées par leur nom) avec les codes INE de l'Idescat ;
4. valide chaque fichier produit avec Zod (`shared/schema.ts`) et l'écrit dans `public/data/`.

Les téléchargements sont mis en cache dans `pipeline/.cache/` (non versionné).

Fichiers produits :

- `municipios.json` : les 947 communes (code INE, nom, comarque, province) ;
- `historico/municipio/<INE>.json` : séries trimestrielles et sur 4 trimestres (registre + notaires) ;
- `historico/comarca/<id>.json`, `historico/provincia/<id>.json`, `historico/catalunya.json` : séries de comparaison ;
- `sources.json` : source, URL, licence, date de téléchargement, dernière période.

## Qualité

```bash
npm test               # tests unitaires (Vitest), avec des fixtures issues des fichiers officiels
npm run lint
npm run format:check
npm run typecheck
```

Les fixtures de `pipeline/test/fixtures/` se régénèrent avec `npx tsx pipeline/scripts/crear-fixtures.ts`.
