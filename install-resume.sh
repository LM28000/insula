#!/bin/bash
# Copie chaque matin (7 h 45, et au démarrage du Mac) le résumé du relevé de la nuit du serveur vers ~/.config/immobilier-tool/resume-du-jour.json,
# pour la routine Claude version 9 (tools/routine-releve.md), qui n'a pas d'accès au serveur. À installer le jour où le serveur publie.
PLIST="$HOME/Library/LaunchAgents/com.lm28000.insula-resume.plist"
mkdir -p "$HOME/.config/immobilier-tool"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.lm28000.insula-resume</string>
  <key>ProgramArguments</key><array><string>/usr/bin/scp</string><string>-q</string><string>-o</string><string>BatchMode=yes</string>
    <string>debian.home.arpa:.local/share/insula-releve/config/resume-du-jour.json</string><string>$HOME/.config/immobilier-tool/resume-du-jour.json</string></array>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>7</integer><key>Minute</key><integer>45</integer></dict>
  <key>RunAtLoad</key><true/>
</dict></plist>
PL
launchctl unload "$PLIST" 2>/dev/null; launchctl load "$PLIST" && echo "Copie du résumé installée (7 h 45 et au démarrage) : ~/.config/immobilier-tool/resume-du-jour.json"
