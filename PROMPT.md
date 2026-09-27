# Prompt : création de l'app « Data Spain »

> Comment l'utiliser : ouvre une session Claude Code sur ce dépôt, puis copie tout ce qui se trouve sous la ligne ci-dessous et envoie-le. Tu peux aussi simplement écrire : « Lis PROMPT.md et exécute les instructions situées sous la ligne `---` ».
> Avant d'envoyer, relis la section `<mes_preferences>` et modifie ce que tu veux.
> Important : l'environnement cloud doit pouvoir accéder aux sites des sources de données (`*.gob.es`, `*.gencat.cat`, `*.cat`, `penotariado.com`…). Sinon, autorise ces domaines dans les réglages réseau de l'environnement.

---

<role>
Tu es un développeur full-stack senior spécialisé dans les applications cartographiques et les données ouvertes immobilières espagnoles et catalanes (Catastro, Notariado, Ministerio de Vivienda, Generalitat de Catalunya, Idescat, ICGC). Tu écris du code TypeScript propre, typé et testé. Tu es rigoureux sur la provenance des données : tu ne présentes jamais une donnée estimée ou inventée comme une donnée réelle.
</role>

<contexte>
Je veux une application personnelle, pour moi seul, qui me permet de visualiser le marché immobilier récent en **Catalogne**, un peu comme DVF (« Demandes de valeurs foncières ») en France.

Contrainte fondamentale, que tu dois respecter et ne jamais contourner : **l'Espagne ne publie pas les prix de vente individuels en open data**. Les prix réels de chaque vente sont détenus par les notaires et le Registro de la Propiedad, et ne sont pas publics. Le « Valor de Referencia » du Catastro est une valeur calculée par l'administration, pas un prix de vente, et il ne se consulte que bien par bien.

L'app affiche donc :

1. des **statistiques agrégées réelles** par zone et par période : prix moyen au m², nombre de ventes et évolution ;
2. par-dessus un **fond cadastral** (parcelles et bâtiments), avec les informations publiques de chaque parcelle.

Ce n'est pas un produit commercial : pas de comptes, pas de backend payant, pas de tracking.
</contexte>

<mes_preferences>

- Nom de l'app : Data Spain
- Langue de l'interface : espagnol (je lis l'espagnol ; les termes techniques peuvent rester en espagnol ou en catalan quand c'est le terme officiel)
- Zone : Catalogne uniquement (4 provinces, environ 947 communes). L'architecture doit permettre d'ajouter d'autres régions plus tard.
- Appareils : ordinateur et téléphone (design responsive, installable en PWA)
- Ambiance visuelle : sobre et lisible, type outil d'analyse (inspiration : DVF / explore.data.gouv.fr, Idealista Data), mode sombre et clair
  </mes_preferences>

<sources_de_donnees>
Ta première tâche est de **vérifier chacune de ces pistes** : URL actuelle, format (CSV, XLSX, API, WMS…), licence, granularité géographique, fréquence de mise à jour et historique disponible. Mes informations peuvent être datées. Si une source n'existe plus ou n'est pas accessible automatiquement, dis-le et propose une alternative.

Statistiques de prix et de volumes (le cœur de l'app) :

- **Portail de données ouvertes de la Generalitat** (`analisi.transparenciacatalunya.cat`, API Socrata) et **Secretaria / Agència de l'Habitatge de Catalunya** : statistiques de compraventas de viviendas par commune et par trimestre (prix moyen, prix au m², nombre de transactions), probablement la meilleure source pour la Catalogne.
- **Portal Estadístico del Notariado** (`penotariado.com`) : prix au m² et nombre de ventes par commune ou code postal. Vérifie s'il existe un export exploitable ; sinon, laisse-la de côté.
- **Ministerio de Vivienda y Agenda Urbana** : « Transacciones inmobiliarias » par commune et « Valor tasado de vivienda libre » (communes de plus de 25 000 habitants), par trimestre.
- **Open Data BCN** (`opendata-ajuntament.barcelona.cat`) : prix de vente par barri et districte pour Barcelone, ce qui permet un zoom plus fin sur la ville.
- **Idescat** : codes officiels des communes et comarques, population (pour les ratios).

Cartographie :

- **ICGC** (Institut Cartogràfic i Geològic de Catalunya) : limites administratives (communes, comarques, provinces) et fonds de carte gratuits.
- **Catastro, services INSPIRE** : WMS des parcelles et bâtiments pour l'affichage à fort zoom (sans téléchargement massif).
- **Catastro, services OVC** (par exemple la consultation par coordonnées qui renvoie la référence cadastrale, et la consultation des données non protégées) : infos d'une parcelle au clic.

Règles strictes :

- Ne scrape jamais la Sede Electrónica del Catastro : ses conditions l'interdisent. Utilise uniquement les services officiels prévus pour ça, à la demande, pour un clic de l'utilisateur.
- N'invente, n'interpole et n'extrapole aucune donnée sans l'afficher clairement comme telle.
- Chaque chiffre affiché doit indiquer sa **source** et sa **période**.
- Respecte le secret statistique : une zone avec trop peu de ventes pour être publiée s'affiche en gris, avec « sin datos suficientes ».
  </sources_de_donnees>

<stack_technique>
Architecture **100 % statique**, sans serveur, pour que ce soit gratuit et simple à maintenir :

- **Pipeline de données** (dossier `pipeline/`, Node.js + TypeScript) :
  - télécharge les sources, les nettoie et les normalise (codes INE à 5 chiffres, noms officiels, périodes au format `AAAA-Tn`) ;
  - valide chaque jeu de données avec Zod et échoue bruyamment si le format d'une source a changé ;
  - simplifie les géométries (mapshaper) et produit des fichiers compacts dans `public/data/` (TopoJSON pour les limites, JSON par indicateur et par période) ;
  - produit un fichier `sources.json` (source, URL, licence, date de téléchargement, dernière période disponible) ;
  - s'exécute via une **GitHub Action planifiée** (une fois par mois, plus un lancement manuel), qui commite les données mises à jour.
- **Application web** : React + TypeScript (mode strict) + Vite + Tailwind CSS.
- **Carte** : MapLibre GL JS, avec un fond de carte gratuit sans clé d'API (ICGC ou OpenFreeMap) et le WMS INSPIRE du Catastro en couche raster à partir d'un zoom élevé.
- **Graphiques** : une bibliothèque légère (par exemple uPlot, ou Recharts si c'est plus simple).
- **PWA** installable (`vite-plugin-pwa`), avec les données agrégées en cache pour une consultation hors ligne.
- **Déploiement** : GitHub Pages via GitHub Actions.
- Si un service du Catastro bloque les appels depuis le navigateur (CORS), signale-le et propose la solution la plus simple : un lien vers la fiche officielle, ou un petit proxy gratuit (Cloudflare Worker), seulement si je valide.
  </stack_technique>

<fonctionnalites>
1. **Carte choroplèthe** de la Catalogne, par commune, colorée selon l'indicateur choisi : prix moyen au m², nombre de ventes, ou variation sur 1 an. Légende claire, par quantiles.
2. **Sélecteurs** : indicateur, période (trimestre ou année), et type de bien si la source le distingue (neuf ou ancien, appartement ou maison).
3. **Recherche** d'une commune ou d'une adresse (géocodage gratuit, par exemple le géocodeur de l'ICGC ou Nominatim).
4. **Fiche commune** au clic, dans un panneau latéral sur ordinateur ou une bottom sheet sur téléphone :
   - chiffres clés de la dernière période, avec la variation sur 1 an ;
   - graphique d'évolution sur tout l'historique disponible (prix au m² et volume) ;
   - comparaison avec la comarca, la province et la Catalogne ;
   - sources et dates.
5. **Barcelone détaillée** : en zoomant sur Barcelone, bascule sur les données par barri si Open Data BCN les fournit.
6. **Parcelle** : à fort zoom, les parcelles du Catastro s'affichent. Au clic : référence cadastrale, usage, surface, année de construction (données publiques), avec un lien vers la consultation officielle de sa fiche et de son Valor de Referencia.
7. **Comparateur** : sélectionner 2 à 4 communes et comparer leurs courbes d'évolution.
8. **Classements** : communes les plus chères et les moins chères, plus fortes hausses et baisses, avec un filtre sur un nombre minimal de ventes.
9. **Page « Fuentes y metodología »** : chaque source, sa définition exacte (prix déclaré, prix expertisé, prix au m² construit ou utile…), ses limites, sa fréquence et la date de mise à jour.
10. Un **bandeau discret mais permanent** : « Datos agregados por zona — no son precios de venta individuales ».
</fonctionnalites>

<qualite>
- Tests unitaires (Vitest) sur les transformations de données du pipeline, avec des fixtures réelles, et sur les calculs (variations, quantiles).
- Un test end-to-end (Playwright) du parcours : ouvrir la carte, chercher une commune, ouvrir sa fiche.
- Lint, format et typecheck dans la CI.
- Performances : chargement initial rapide sur téléphone, avec des données chargées à la demande par indicateur et par période.
- Accessibilité : contrastes suffisants et palette lisible par les daltoniens pour la choroplèthe.
- Un README en français : ce que fait l'app, les sources, comment lancer le pipeline et le développement local.
</qualite>

<methode>
Travaille par étapes et montre-moi le résultat de chacune avant de passer à la suivante :

1. **Exploration des sources** : vérifie chaque source ci-dessus et donne-moi un tableau récapitulatif (disponibilité, format, granularité, historique, licence, limites), puis ta recommandation sur la source principale. **Arrête-toi là et attends ma validation.**
2. **Prototype sur une commune test** (Girona) : pipeline, données et fiche commune minimaliste.
3. **Extension à toute la Catalogne**, avec la carte choroplèthe et les sélecteurs.
4. **Couche cadastrale** et infos parcelle.
5. **Barcelone par barri**, comparateur et classements.
6. **Finitions** : design, PWA, page méthodologie, GitHub Action planifiée, déploiement.

Si tu as un doute sur une définition, une source ou un choix qui change ce que je verrai, pose-moi la question au lieu de supposer.
</methode>
