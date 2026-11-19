# Le relevé de la nuit sur le serveur

Depuis le 19 novembre 2026, le relevé des annonces peut tourner sans la routine Claude, dans un conteneur Docker du serveur de la maison (Debian, `debian.home.arpa`). La routine reste en place tant que les deux relevés n'ont pas été comparés.

## Ce qui tourne

- `tools/releve.mjs` lit le plan du relevé (`tools/releve_plan.py`), ouvre les pages de résultats de Bien'ici une par une et lance sur chacune le script de lecture de la routine (`tools/extraction-bienici.js`). Puis il lit les fiches des annonces nouvelles avec `tools/fiches-bienici.js`.
- **Le rythme est celui d'un visiteur** : 8 à 14 secondes entre deux pages, tirées au hasard, et 1,5 seconde entre deux fiches. Le 19 novembre, une page toutes les 3 à 4 secondes avait fait cesser l'affichage des annonces au bout de 213 pages.
- **Au premier refus du site**, ou à une page restée vide deux fois, le relevé s'arrête. Il n'écrit rien et ne publie rien, et il garde une capture de la page (`arret.png`). On ne contourne pas un blocage.
- **Dans le conteneur, le navigateur tourne sans fenêtre.** C'est le Chromium de l'image Playwright. En fenêtre, sur un écran virtuel, il abandonnait les pages de Bien'ici (`ERR_ABORTED`).
- **Sur le Mac**, le même script ouvre Chrome dans une fenêtre : `node tools/releve.mjs --essai DOSSIER`.

Avec `MODE=publier`, le conteneur fait ensuite ce que faisait la routine :
1. `maj_annonces.py` met à jour les annonces et leur historique ;
2. `fiches.py merge` range les fiches ;
3. `build.py` construit la page ;
4. `supabase_annonces.py push` envoie les annonces dans Supabase ;
5. `sync.sh` vérifie, lance les tests rapides, enregistre dans git et pousse sur GitHub.

La lecture des descriptions (vendu loué, loyer, travaux…) demande un modèle de langue : elle reste à une routine Claude, qui n'a plus que cela à faire (`fiches.py a-lire`, puis `lu`).

## Les fichiers sur le serveur

| Où | Quoi |
|---|---|
| `~/insula` | le clone du dépôt, mis à jour avant chaque relevé |
| `~/insula/docker/releve` | l'image (`Dockerfile`), sa configuration (`compose.yaml`) et son lancement (`releve-docker.sh`) |
| `~/.local/share/insula-releve/config` | le code du groupe (`groupe`, lisible par le compte seulement), le profil du navigateur, le journal (`releve.log`) et, en essai, le relevé (`releve-essai/`) |
| `~/.local/share/insula-releve/ssh` | la clé de déploiement GitHub, en mode publier |

Rien de cela n'est dans le dépôt, et rien n'est publié.

## Commandes

```bash
cd ~/insula/docker/releve
docker compose build                              # après un changement de l'image
LISTES=3 docker compose run --rm releve           # essai court : les 3 premières listes
docker compose run --rm releve                    # essai complet (environ 1 h 30)
MODE=publier docker compose run --rm releve       # pour de bon
tail -f ~/.local/share/insula-releve/config/releve.log
```

Le cron du compte lance le relevé chaque nuit à 5 h 30, en essai pour l'instant (`crontab -l`).

## Passer pour de bon au serveur

1. **Comparer** une nuit le relevé du serveur (`releve-essai/releve-du-jour.json`) avec celui de la routine.
2. **Donner au serveur le droit de pousser** : créer une clé dans `~/.local/share/insula-releve/ssh`, l'ajouter comme clé de déploiement en écriture du dépôt `LM28000/insula`, et faire pointer `origin` du clone vers `git@github.com:LM28000/insula.git`.
3. **Passer le cron en `MODE=publier`.**
4. **Réduire la routine Claude** à la lecture des descriptions et aux messages.
5. **Sur le Mac**, avant de construire la page, reprendre les annonces du serveur : `python3 tools/supabase_annonces.py pull --force`.
