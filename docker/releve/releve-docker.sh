#!/bin/bash
# Dans le conteneur : met le dépôt à jour, reprend les annonces privées depuis Supabase, fait le relevé (tools/releve.mjs), puis, en mode « publier », publie comme le Mac (sync.sh : vérifications, tests rapides, commit, Supabase, GitHub).
set -u
cd /depot || exit 1
now() { date '+%F %T'; }
echo "=== $(now) relevé ($MODE)"
git config --global --add safe.directory /depot
git config --global user.name "Relevé Insula (serveur)"; git config --global user.email "releve@insula.invalid"
git pull --rebase --quiet origin main || { echo "$(now) git pull impossible : relevé annulé"; exit 1; }
[ -d node_modules/playwright ] && cmp -s package-lock.json node_modules/.package-lock.json || npm ci --silent --no-audit --no-fund
# annonces, historique et fiches : privés, dans Supabase ; le relevé part de la dernière version en ligne
python3 tools/supabase_annonces.py pull --force || { echo "$(now) lecture de Supabase impossible : relevé annulé"; exit 1; }
if [ "$MODE" = "publier" ]; then
  node tools/releve.mjs --publier ${FICHES:+--fiches $FICHES} || { echo "$(now) relevé arrêté : rien n'est publié"; exit 2; }
  bash sync.sh
else
  node tools/releve.mjs --essai "$HOME/.config/immobilier-tool/releve-essai" ${LISTES:+--listes $LISTES}
fi
code=$?; echo "=== $(now) fin (code $code)"; exit $code
