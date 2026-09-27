# Étape 1 — Exploration des sources (Data Spain)

> Statut : **vérifié par appels réels le 27/09/2026** (téléchargement et lecture des fichiers, test des en-têtes CORS).
> Décisions validées : logements uniquement, neuf/ancien distingués ; statistique du registre comme source principale, plus les volumes de ventes ; pas de *valor tasado* en v1 ; période par défaut = 4 trimestres glissants, avec choix d'un trimestre précis.

## Tableau récapitulatif

| # | Source | Accès vérifié | Format | Contenu | Granularité | Historique | Licence | Limites |
|---|---|---|---|---|---|---|---|---|
| 1 | **Secretaria d'Habitatge (Generalitat)**, « Compravendes d'habitatges registrades i el preu de venda » | ✅ HTTP 200, fichiers téléchargeables directement | XLSX (depuis 2019), XLS (2013–2018). Un fichier par année, une feuille par période | Par type (**neuf libre**, neuf protégé, **ancien**, total) : nombre de ventes, surface moyenne (m² construits), prix total moyen, **prix moyen €/m² construit** (depuis 2026 aussi min et max) | **Communes** : plus de 5 000 hab. jusqu'en 2024 (environ 210), **plus de 2 000 hab. depuis 2025** (357 au 2T26). **Comarques, àmbits, provinces (« demarcacions »), Catalogne** (fichiers TERR). **Barcelone par districte et barri** (fichiers BCN) | Trimestriel **depuis 2013** ; **4 trimestres glissants publiés depuis 2019** (`acum_1any`) ; avant 2019, trimestre et cumul annuel. Dernière période : **2T 2026** | Données publiques de la Generalitat (réutilisation libre avec citation ; mention exacte à reprendre de l'avis légal) | Source : Colegio de **Registradores** (date d'**inscription** au registre). **Prix non publié en dessous de 3 ventes** (`n.d.`, ou `0` dans les anciens fichiers). Le prix « neuf » ne porte que sur le neuf libre. La mise en page change selon les années (colonnes, noms de fichiers), d'où un parseur par époque validé avec Zod. |
| 2 | **Ministerio de Vivienda (MIVAU)**, « Transacciones inmobiliarias », tableaux par commune (Boletín Online, `apps.fomento.gob.es/BoletinOnline2/sedal/340102x0.XLS`) | ✅ HTTP 200 (la page du ministère renvoie 403 sans *User-Agent* navigateur, mais les fichiers XLS sont accessibles) | XLS | **Nombre** de transactions de logements : total, libre, protégé, **neuf**, **ancien**. **Aucun prix** | **Toutes les communes** : 947 en Catalogne | Trimestriel **depuis 2004**, dernière période **1T 2026** (provisoire) | Réutilisation libre (avis légal des ministères) | Source : **notaires** (date de **signature**), donc chiffres différents du n° 1. Communes identifiées **par leur nom seulement**, sans code INE, au format « Llacuna (La) » : un appariement par nom avec l'Idescat est nécessaire, avec une table d'exceptions testée. |
| 3 | **Portal del Notariado** (penotariado.com) | Visualiseur seulement | — | Prix au m², nombre de ventes | Jusqu'au code postal | 12 derniers mois | Aucune licence ouverte | **Écarté** : ni export ni API. Un simple lien depuis la fiche commune reste possible. |
| 4 | **Open Data BCN** (CKAN) | ⚠️ L'API de métadonnées répond, mais **les téléchargements CSV sont protégés par un captcha** (BunkerWeb + hCaptcha) | CSV | Volumes notariaux et surfaces par usage | Ville, districte | 2012–2026 | CC BY 4.0 | **Pas automatisable**. Inutile de toute façon : la source n° 1 fournit déjà les prix **par barri et districte**. |
| 5 | **Portail Socrata de la Generalitat** (`analisi.transparenciacatalunya.cat`) | ✅ | API Socrata | Seulement le **loyer** par commune (`qww9-bvhh`) | Commune | — | CC BY | **Aucun jeu de données de compraventas**. Non utilisé en v1. |
| 6 | **Idescat** : codes territoriaux et API EMEX | ✅ | CSV (`codis/?id=50&n=9&f=ssv`, 947 communes + comarque) et API JSON | Code Idescat à 6 chiffres (les 5 premiers correspondent au code INE), nom officiel, comarque, **population** | Commune | Annuel (population 2025) | Conditions d'usage Idescat (citation) | RAS. Référentiel des noms et des codes. Sa statistique `cpvhu` reprend la même source que le n° 1, mais seulement pour l'ancien : non retenue. |
| 7 | **ICGC**, divisions administratives (WFS `geoserveis.icgc.cat/servei/catalunya/divisions-administratives/wfs`) | ✅ GeoJSON natif (`OUTPUTFORMAT=GEOJSON`), **947 communes**, à l'échelle 1:250 000 (6,9 Mo avant simplification) | GeoJSON (WGS84) | Limites + `CODIMUNI`, comarque, vegueria, province | Commune, comarque, province (échelles 1:5 000 à 1:1 000 000) | Millésime courant | **CC BY 4.0** | `datacloud.icgc.cat` (téléchargements en fichiers) : connexion réinitialisée, mais le WFS suffit. |
| 8 | **Fonds de carte** : ICGC `geoserveis.icgc.cat/contextmaps/*` et **OpenFreeMap** | ✅ Sans clé, `Access-Control-Allow-Origin: *` | Styles MapLibre + tuiles vectorielles | — | — | — | CC BY 4.0 (ICGC) ; OSM/ODbL (OpenFreeMap) | — |
| 9 | **Géocodeur ICGC** (`eines.icgc.cat/geocodificador`) | ✅ CORS `*` | JSON | Adresses, toponymes, communes ; géocodage inverse | Adresse | — | CC BY 4.0 | Limité à la Catalogne (ce qui suffit). Nominatim en secours. |
| 10 | **Catastro, WMS INSPIRE** (`ovc.catastro.meh.es/cartografia/INSPIRE/spadgcwms.aspx`) | ✅ GetMap PNG testé en EPSG:3857, **CORS `*`** : aucun proxy nécessaire | WMS 1.3.0 | Couches `CP.CadastralParcel`, `BU.Building` | Parcelle, bâtiment | Continu | Réutilisation libre avec mention « Dirección General del Catastro » | Chargement **uniquement à fort zoom**, jamais en masse. |
| 11 | **Catastro, OVC** : `Consulta_RCCOOR` (XML) et `COVCCallejero.svc/json/Consulta_DNPRC` (JSON) | ✅ Testés sur Girona (Pl. Josep Pla 10 → `5381917DG8458A`), **CORS `*`** | XML / JSON | Référence cadastrale, adresse, **usage** (`luso`), **surface** (`sfc`), **année de construction** (`ant`), par unité (`car`) | Bien | Continu | Idem | Appel **à la demande, au clic uniquement**. Aucun scraping de la Sede ; lien vers la fiche officielle pour le Valor de Referencia. |

## Constats importants

1. **La source principale existe et elle est riche** : le n° 1 fournit, par commune et par trimestre, le nombre de ventes et le prix au m² **séparés en neuf et ancien**, plus les agrégats comarque, province et Catalogne pour la comparaison, et Barcelone par barri. Tout est dans les mêmes fichiers.
2. **Couverture des prix** : environ 210 communes jusqu'en 2024, 357 depuis 2025. Les autres communes n'ont **pas de prix** : elles s'afficheront en gris « sin datos suficientes », mais **le nombre de ventes reste disponible pour toutes** grâce au MIVAU (n° 2).
3. **Les 4 trimestres glissants sont publiés directement** depuis 2019. Je ne les recalcule pas : la Generalitat publie la **moyenne des prix au m²** de chaque vente, et non total des prix ÷ total des surfaces. Un recalcul donnerait des chiffres faux (Girona 2T26 : 2 866 €/m² publiés, contre 2 802 par recalcul). Avant 2019, seuls les trimestres et les années civiles sont proposés.
4. **Deux mesures des volumes, jamais mélangées** : Registradores (date d'inscription, communes au-dessus du seuil) et Notaires/MIVAU (date de signature, toutes les communes). Chaque chiffre affichera sa source.
5. **CORS : aucun blocage.** Catastro (WMS, OVC), géocodeur ICGC et fonds de carte répondent tous `Access-Control-Allow-Origin: *`. **Aucun proxy nécessaire.**
6. **Secret statistique** : `n.d.`, `0` pour un prix ou moins de 3 ventes seront traités comme « sin datos suficientes », jamais comme zéro.

## Exemple réel : Girona (17079), 4 trimestres glissants 3T25–2T26

| | Neuf libre | Neuf protégé | Ancien | Total |
|---|---|---|---|---|
| Ventes | 452 | 56 | 894 | 1 402 |
| Prix moyen €/m² construit | 3 365 | — | 2 573 | 2 866 |

Source : Secretaria d'Habitatge, à partir des données des Registradores, période juillet 2025 – juin 2026.

## Recommandation (architecture des données)

- **Indicateurs de la v1** : prix moyen €/m² construit (total, neuf, ancien), nombre de ventes (Registradores), variation sur 1 an, et en complément le nombre de ventes (Notaires/MIVAU) pour toutes les communes.
- **Fichiers produits** : `public/data/{indicateur}/{période}.json`, où la période vaut `AAAA-Tn` (trimestre) ou `AAAA-Tn-4T` (4 trimestres glissants se terminant à Tn), plus un fichier `historique/{codeINE}.json` par commune pour la fiche.
- **Clé commune** : code INE à 5 chiffres (= `CODIMUNI` de l'ICGC et code Idescat sans le chiffre de contrôle).

## Prochaine étape (2) : prototype Girona

Pipeline complet pour Girona : téléchargement des fichiers n° 1 (2013–2026), n° 2 et n° 6, normalisation, validation Zod, tests Vitest sur des fixtures réelles, puis une fiche commune minimaliste (chiffres clés, graphique de l'historique, comparaison avec le Gironès, la province de Girona et la Catalogne, sources et dates).
