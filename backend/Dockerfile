# Build
FROM eclipse-temurin:21-jdk AS build
WORKDIR /src
COPY gradlew settings.gradle.kts build.gradle.kts ./
COPY gradle gradle
RUN ./gradlew --no-daemon dependencies > /dev/null || true
COPY src src
RUN ./gradlew --no-daemon bootJar -x test

# Run: serverul rulează ca utilizator fără drepturi (cumped); containerul pornește ca root doar ca să
# pregătească discul pentru poze (montat de platformă), apoi renunță la drepturi (setpriv).
FROM eclipse-temurin:21-jre
RUN groupadd --system --gid 10001 cumped && useradd --system --uid 10001 --gid cumped cumped \
    && mkdir -p /data/uploads && chown cumped:cumped /data/uploads
WORKDIR /app
COPY --from=build /src/build/libs/*.jar app.jar
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod 755 /usr/local/bin/docker-entrypoint.sh
ENV UPLOADS_DIR=/data/uploads
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
