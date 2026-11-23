# Journal des changements

Les grandes étapes du site. Le détail de chaque changement est dans l'historique git, où les messages de commit sont rédigés. Les notes de l'app Android sont dans son propre dépôt.

## 23 novembre 2026 — La routine retrouve le résumé de la nuit

- Fiche, « Si on revend » : le gain en euros au bout de 15 ans et ce qu'on a sorti de notre poche pour l'avoir (apport, plus les mois négatifs, moins les mois positifs). Un crédit plus court fait baisser le rendement mais monter le gain : les deux se voient.

- Le résumé du relevé de la nuit passe par Supabase avec les annonces. Une tâche du Mac (`tools/matin-mac.sh`, 7 h 45) les reprend dans le dossier du projet, seul endroit que voit la routine Claude. Du 20 au 22 novembre, la routine s'était arrêtée sans rien lire, faute de trouver le résumé.

## 19 novembre 2026 — Le relevé sur le serveur, et les notaires

- Le relevé de la nuit peut tourner sans la routine Claude : `tools/releve.mjs`, dans un conteneur Docker du serveur de la maison (`docker/releve`, [docs/releve-serveur.md](docs/releve-serveur.md)).
- Deuxième source de ventes : les annonces des notaires (immobilier.notaires.fr), avec leur fiche, la situation locative déclarée et le quartier quand le notaire l'écrit. Elles portent la mention « annonce des notaires ».
- Les sites qui refusent les navigateurs automatiques (Leboncoin, SeLoger, PAP…) ne sont pas relevés.

## 14 novembre 2026 — Les fiches en questions

- La fiche est faite de questions repliées, les mêmes dans l'app Android : qu'est-ce qu'on achète, est-ce cher, combien il se louera, combien ça coûte et rapporte, ce qui peut mal tourner, où c'est, si on y va. Chacune a sa ligne de faits ; en tête, trois chiffres et « À regarder » ; en bas, Suivre et Voir l'annonce.
- « Gagnant après N ans » si l'on revend : le prix de vente rembourse le crédit restant, l'impôt sur la plus-value et ce qu'on a sorti de notre poche.
- Sur téléphone : la liste des annonces est l'accueil, la carte un bouton ; menu du bas Annonces, Villes, Nos biens, Projet ; Réglages sous le rond ; la fiche s'ouvre en pleine page, sans panneau à tirer.
- La fiche d'une ville mène à ses annonces pour nos critères et liste ses quartiers, du plus rentable au moins rentable.
- Sur ordinateur : le tableau des annonces est l'accueil, la carte un bouton ; une fiche ouverte se place à droite, la liste passe en lignes compactes ; une ville de la liste ouvre sa fiche, et ‹ › passent d'une ville à l'autre.
- « Première visite ? » est en tête de la liste.
- Comme dans l'app : la ville des annonces et le tri dans des menus, sur téléphone comme sur ordinateur ; les villes se trient aussi par un menu (rendement, cash-flow, budget, annonces pour nos critères, Paris, étudiants, loyer).
- Dans une question, les rubriques ne se replient plus : un intertitre, sans retrait ; tableaux resserrés (« Par associé » tient sur un téléphone) ; les offres arrondies au même prix ne font qu'une ligne ; une description écrite en capitales est remise en phrases.
- La description d'une annonce ne s'affiche plus en double.

## 12 novembre 2026 — Insula devient le site

- La nouvelle interface (`src/v3`) est servie à l'adresse d'origine, https://insula.du-cray.eu. Elle a quatre espaces identiques sur ordinateur et téléphone : Explorer, Nos biens, Projet, Réglages.
- L'app installable s'appelle Insula, avec l'icône de l'app Android. `essai.html` renvoie à la page.
- `.well-known/assetlinks.json` : les liens du site (invitation `#g=`, fiche `#f=`) ouvrent l'app Android.
- La fiche à emporter titre les ventes réelles selon le type du bien.

## 11 novembre 2026 — Famille et amis

- Un groupe par foyer : code tiré au hasard, invitation par lien, mode d'emploi, remarques envoyées depuis l'app.
- Insula à l'essai (`essai.html`), à côté de l'interface d'alors.
- `dist/moteur.js` : le moteur sans interface, repris par l'app Android.
- Calcul du rendement 3 à 4 fois plus rapide, avec les mêmes chiffres.
- Pages de confidentialité et de suppression des données.

## 10 novembre 2026 — Le quartier en détail

- Copropriétés du registre national, résidences étudiantes et logements neufs autour des biens.
- Zone tendue, demande étudiante, stock d'annonces à la revente.
- Vue « Bruit » de la carte, lignes de bus et tram dans les rues.
- Documents à demander avant une offre. Audit de cohérence du calcul et des fiches.
- Codes de groupe gardés seulement en empreinte dans la base.

## 9 novembre 2026 — 22 villes et le fond du calcul

- Nantes puis Rouen ajoutées (22 villes). Grandes lignes de train, lignes de transport sur la carte.
- Gestion par agence, hausse des prix selon la ville, mois vides mesurés sur le relevé, DPE à jour du calcul de 2027.
- Biens non louables hors calcul. Photos en grand.
- Annonces visibles par tout le monde (vue en lecture seule), le code de groupe ne servant plus qu'à « Nos biens ».
- Code sous licence MIT ; données sous la licence de leur source.

## 8 novembre 2026 — La version 2

- Nouvelle interface : carte d'abord, fiche en onglets, annonces en tableau ou en nuage, scénarios prudent, central et favorable.
- Carte MapLibre en 3D, quartiers colorés, thème clair ou sombre.
- Sept villes ajoutées (Évreux, Bourges, Niort, Limoges, Brest, Alençon, Cherbourg) ; annonces relevées dans 20 villes.
- Associés : de 1 à 6 personnes. Mode « Tous » : studios, T2 et T3 ensemble.
- Réglages communs à deux ; « Ce qui a bougé » depuis la visite précédente.

## 7 novembre 2026 — Annonces complètes et privées

- Fiche complète de chaque annonce (description, photos, charges, DPE, étage, position).
- Annonces, historique et fiches retirés du dépôt public, rangés dans Supabase.
- Serveur MCP. Prix DVF ramenés à la surface type ; loyers recalés sur les annonces.

## 5 novembre 2026 — Première version

- Comparateur de villes pour un studio meublé : prix, loyers, quartiers IRIS, ventes réelles, liste commune.
