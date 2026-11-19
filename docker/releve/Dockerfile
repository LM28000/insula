# Relevé de la nuit dans un conteneur (serveur de la maison) : Chromium et ses bibliothèques viennent de l'image
# Playwright, à la même version que package.json. Le dépôt, le profil du navigateur et les secrets sont des volumes (compose.yaml).
FROM mcr.microsoft.com/playwright:v1.65.0-noble
RUN apt-get update && apt-get install -y --no-install-recommends python3 git openssh-client ca-certificates tzdata \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /home/releve && chmod 1777 /home/releve   # lancé sous l'identifiant du compte du serveur (compose.yaml) : un dossier personnel à tous
ENV RELEVE_CHROME=0 PYTHONDONTWRITEBYTECODE=1 TZ=Europe/Paris PLAYWRIGHT_BROWSERS_PATH=/ms-playwright HOME=/home/releve npm_config_cache=/home/releve/.npm GIT_CONFIG_GLOBAL=/home/releve/.gitconfig
COPY releve-docker.sh /usr/local/bin/releve-docker.sh
WORKDIR /depot
ENTRYPOINT ["/bin/bash", "/usr/local/bin/releve-docker.sh"]
