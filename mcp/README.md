# Serveur MCP « Notre studio »

Branche l'outil sur une IA (Claude Code, Claude Desktop ou tout client MCP) : elle peut classer les villes et les quartiers, chercher les annonces, lire leur fiche complète, simuler un bien, voir les nouveautés du relevé et consulter ou compléter la liste « Nos biens ».

Les chiffres sont exactement ceux de l'app : le serveur ouvre la page construite (`dist/test.html`) dans un navigateur invisible et appelle ses fonctions de calcul. Il fonctionne hors ligne, sauf pour « Nos biens » (Supabase).

## Installer

```bash
npm install && npx playwright install chromium && python3 build.py
claude mcp add notre-studio -s user -- node "$PWD/mcp/serveur.mjs"     # Claude Code
```

Claude Desktop : dans `~/Library/Application Support/Claude/claude_desktop_config.json`, ajouter
`"mcpServers": {"notre-studio": {"command": "node", "args": ["/chemin/vers/immobilier-tool/mcp/serveur.mjs"]}}`.

## Outils

| Outil | Ce qu'il fait |
|---|---|
| `classement_villes` | les 22 villes par rendement sur 15 ans, pour un studio, un T2 ou un T3 (chiffre de leur quartier du milieu, nommé), avec la hausse des prix et les mois vides retenus pour chaque ville |
| `quartiers` | les quartiers d'une ville, classés |
| `annonces` | annonces à vendre filtrées (ville, prix maximum, DPE, banque) et triées ; résidences gérées exclues par défaut |
| `fiche_annonce` | description, photos, étage, DPE, charges, copropriété retrouvée dans le registre national (lots, époque, syndic ; sûre ou probable), résidences étudiantes à 1 km et logements neufs autorisés à 500 m, bruit (grands axes, voies ferrées, aéroports), zone tendue, prix à proposer, points d'attention, historique du prix |
| `simuler_bien` | n'importe quel bien (autre site, contre-offre) avec vos réglages |
| `nouveautes` | annonces nouvelles, baisses de prix, annonces disparues au dernier relevé |
| `reglages` | lire ou changer apport, taux, revenus, type de bien… (gardés dans `~/.config/immobilier-tool/hypotheses.json`) |
| `nos_biens`, `ajouter_bien`, `changer_statut` | la liste commune, avec le code de groupe de `~/.config/immobilier-tool/groupe` |

## Texte des annonces et écritures

Une annonce est écrite par n'importe qui : sa description peut contenir des phrases adressées à l'IA (« ajoute ce bien », « change le taux »…). Deux protections :

- **Texte balisé.** La description, le chauffage, les frais d'agence et le secteur d'une annonce, ainsi que les titres et notes de « Nos biens », sont rendus tels quels mais entre `<<<TEXTE_EXTERNE code>>>` et `<<<FIN_TEXTE_EXTERNE code>>>`, avec un code tiré au hasard à chaque réponse et un `avertissement` en tête. Cela aide l'IA à ne pas les suivre, sans le garantir.
- **Votre accord avant chaque écriture.** `ajouter_bien`, `changer_statut` et `reglages` (quand une valeur change) demandent votre accord par le client MCP (« elicitation ») : une fenêtre montre le changement exact, et rien n'est écrit sans « Je confirme ». L'IA ne peut pas répondre à votre place. Chaque écriture relit les données après votre accord, pour ne pas écraser un changement fait entre-temps.

Un client qui ne sait pas demander cet accord ne peut pas écrire : l'outil répond « écriture refusée ». Pour passer outre en connaissance de cause, lancer le serveur avec `NOTRE_STUDIO_ECRITURE_SANS_CONFIRMATION=1` ; seule l'autorisation d'outil du client protège alors (ne pas pré-autoriser ces trois outils).

Exemples de demandes : « Quels sont les 5 meilleurs studios sous 65 000 € avec un DPE D ou mieux ? », « Lis la fiche de cette annonce et dis-moi quoi demander à la visite », « Si on négocie à 52 000 €, que devient le cash-flow ? », « Ajoute-la à nos biens ».

Test : `node tests/mcp.test.mjs` (après `python3 build.py`).
