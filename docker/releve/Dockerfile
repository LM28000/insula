# Relevé de la nuit dans un conteneur (serveur de la maison) : Chromium et ses bibliothèques viennent de l'image
# Playwright, à la même version que package.json. Le dépôt, le profil du navigateur et les secrets sont des volumes (compose.yaml).
FROM mcr.microsoft.com/playwright:v1.65.0-noble
RUN apt-get update && apt-get install -y --no-install-recommends python3 git openssh-client ca-certificates tzdata \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /home/releve && chmod 1777 /home/releve   # lancé sous l'identifiant du compte du serveur (compose.yaml) : un dossier personnel à tous
ENV RELEVE_CHROME=0 PYTHONDONTWRITEBYTECODE=1 TZ=Europe/Paris PLAYWRIGHT_BROWSERS_PATH=/ms-playwright HOME=/home/releve npm_config_cache=/home/releve/.npm GIT_CONFIG_GLOBAL=/home/releve/.gitconfig
# ssh lit son dossier dans le compte système (pas dans $HOME) : la clé de déploiement et les empreintes de GitHub, explicitement
ENV GIT_SSH_COMMAND="ssh -i /home/releve/.ssh/id_ed25519 -o UserKnownHostsFile=/home/releve/.ssh/known_hosts -o IdentitiesOnly=yes -o BatchMode=yes"
# copie de secours : compose.yaml lance le script du dépôt (/depot/docker/releve/releve-docker.sh), mis à jour par git sans reconstruire l'image
COPY releve-docker.sh /usr/local/bin/releve-docker.sh
WORKDIR /depot
ENTRYPOINT ["/bin/bash", "/usr/local/bin/releve-docker.sh"]
