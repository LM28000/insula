#!/bin/bash
# Installe la tâche du matin du Mac (7 h 45, au démarrage, puis toutes les heures tant que le résumé du jour n'est pas arrivé) : tools/matin-mac.sh reprend dans Supabase les annonces relevées cette nuit
# par le serveur, avec le résumé de la nuit (data/prive/, ignoré par git), pour la routine Claude version 9 (tools/routine-releve.md),
# qui ne voit que le dossier du projet et n'a aucun accès au serveur. Journal : ~/.config/immobilier-tool/matin.log
D="$(cd "$(dirname "$0")" && pwd)"
PLIST="$HOME/Library/LaunchAgents/com.lm28000.insula-resume.plist"
mkdir -p "$HOME/.config/immobilier-tool"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.lm28000.insula-resume</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$D/tools/matin-mac.sh</string></array>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
  <key>StandardOutPath</key><string>$HOME/.config/immobilier-tool/matin.log</string>
  <key>StandardErrorPath</key><string>$HOME/.config/immobilier-tool/matin.log</string>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>7</integer><key>Minute</key><integer>45</integer></dict>
  <key>StartInterval</key><integer>3600</integer>
  <key>RunAtLoad</key><true/>
</dict></plist>
PL
launchctl unload "$PLIST" 2>/dev/null; launchctl load "$PLIST" && echo "Tâche du matin installée (7 h 45, au démarrage, puis toutes les heures si besoin) : annonces reprises de Supabase, résumé dans data/prive/resume-du-jour.json"
