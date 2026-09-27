# Data Spain

Application personnelle pour visualiser le marché de la compraventa de logements en **Catalogne**, à la manière de DVF en France, mais à partir de **statistiques agrégées** : l'Espagne ne publie pas les prix de vente individuels.

> Datos agregados por zona — no son precios de venta individuales.

Architecture 100 % statique : un pipeline Node.js produit des fichiers JSON dans `public/data/`, lus par une application React.

## État d'avancement

L'app se concentre sur **Barcelone** : une carte 3D animée des 73 barris et 10 districtes.

| Étape | Contenu                                                                                                                        | État    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------ | ------- |
| 1     | Exploration des sources ([rapport](docs/01-exploration-sources.md))                                                            | ✅      |
| 2     | Pipeline de données (Catalogne + Barcelone), tests sur fichiers officiels                                                      | ✅      |
| 3–5   | Carte de Barcelone : barris/districtes, 3D, frise animée 2013 → 2026, fiche zone, classement, recherche, parcelles du Catastro | ✅      |
| 6     | Finitions : PWA, déploiement GitHub Pages, Action planifiée                                                                    | à venir |

### Ce que montre la carte

- **Indicateurs** : prix moyen au m² construit, prix moyen, nombre de ventes, variation sur un an ; logements tous types, anciens ou neufs (neuf libre).
- **Période** : 12 derniers mois (4 trimestres glissants publiés) ou un trimestre précis, de fin 2013 à aujourd'hui ; bouton ▶ pour voir l'évolution animée.
- **Couleurs** : 6 classes par quantiles (période affichée, ou toute la série pour comparer dans le temps) ; **hauteur 3D** proportionnelle à la valeur, sur une échelle commune à toutes les périodes.
- **Fiche d'une zone** : chiffres clés animés, rang parmi les barris, répartition ancien/neuf/protégé, comparaison districte / ville, courbes d'évolution.
- **Classement** des barris avec un filtre sur le nombre minimal de ventes.
- **Recherche** d'un barri ou d'une adresse (géocodeur de l'ICGC) ; à partir du zoom 16, **parcelles du Catastro** et, au clic, leurs données publiques (usage, surface, année) avec un lien vers la fiche officielle et le Valor de Referencia.
- Lien direct vers une zone : `#b31` (barri 31), `#d02` (districte 2).

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
- `barcelona/datos.json` : toutes les séries de Barcelone (ville, districtes, barris) dans un format compact ;
- `barcelona/barrios.geojson`, `barcelona/distritos.geojson` : limites simplifiées avec mapshaper ;
- `sources.json` : source, URL, licence, date de téléchargement, dernière période.

## Qualité

```bash
npm test               # tests unitaires (Vitest), avec des fixtures issues des fichiers officiels
npm run lint
npm run format:check
npm run typecheck
npm run test:e2e       # Playwright : ouvrir la carte, chercher un barri, ouvrir sa fiche
```

Si Chromium est déjà installé ailleurs, `PW_CHROMIUM=/chemin/vers/chromium npm run test:e2e`.

Les fixtures de `pipeline/test/fixtures/` se régénèrent avec `npx tsx pipeline/scripts/crear-fixtures.ts`.
