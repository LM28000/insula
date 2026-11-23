#!/bin/bash
# Chaque matin sur le Mac (7 h 45 et au démarrage, tâche installée par install-resume.sh), sans Claude :
#  1. reprend dans Supabase les annonces, l'historique et les fiches que le serveur a relevés cette nuit (supabase_annonces.py pull --force,
#     avec le code de groupe de ~/.config/immobilier-tool, que la routine ne voit pas) ;
#  2. avec elles, le résumé de la nuit (envoyé par le serveur avec les annonces) : data/prive/resume-du-jour.json, ignoré par git, jamais publié.
#  Il suffit d'internet : le Mac n'a pas besoin d'être à la maison.
# La routine Claude (version 9, tools/routine-releve.md) ne voit que le dossier du projet : elle lit ce résumé, lit les descriptions,
# et la tâche de synchronisation du Mac (sync.sh) envoie ensuite ses lectures dans Supabase. Résumé et annonces arrivent ensemble :
# un résumé du jour veut dire des annonces du jour.
cd "$(dirname "$0")/.." || exit 1
now() { date '+%F %T'; }
export PYTHONDONTWRITEBYTECODE=1
mkdir -p data/prive && chmod 700 data/prive
M=.git/supabase-envoi
# des lectures de la veille pas encore envoyées dans Supabase : ne pas les écraser
if [ -f "$M" ] && [ -n "$(find data/annoncesdata.js data/historique.js data/fiches -newer "$M" 2>/dev/null | head -1)" ]; then
  echo "$(now) données du Mac pas encore envoyées dans Supabase : reprise remise à plus tard"
  osascript -e 'display notification "Lectures du Mac pas encore envoyées dans Supabase : annonces du serveur non reprises" with title "Insula"' >/dev/null 2>&1
  exit 1
fi
python3 tools/supabase_annonces.py pull --force >/dev/null || { echo "$(now) reprise depuis Supabase impossible (pas d'internet ?)"; exit 1; }
touch "$M"   # ce qui vient d'être repris est déjà dans Supabase : sync.sh ne le renverra pas
chmod 600 data/prive/resume-du-jour.json 2>/dev/null
echo "$(now) annonces reprises, résumé du $(python3 -c 'import json;print(json.load(open("data/prive/resume-du-jour.json"))["date"])' 2>/dev/null || echo '? (pas encore de résumé dans Supabase)')"
