#!/bin/sh
# Discul pentru poze poate fi montat de platformă ca root: îi dăm folderul utilizatorului aplicației,
# apoi pornim serverul fără drepturi de root.
set -e
DIR="${UPLOADS_DIR:-/data/uploads}"
if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DIR"
  chown -R cumped:cumped "$DIR"
  exec setpriv --reuid=cumped --regid=cumped --init-groups java -XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError -jar /app/app.jar
fi
exec java -XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError -jar /app/app.jar
