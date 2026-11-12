# Build
FROM eclipse-temurin:24-jdk AS build
WORKDIR /src
COPY gradlew settings.gradle.kts build.gradle.kts ./
COPY gradle gradle
RUN ./gradlew --no-daemon dependencies > /dev/null || true
COPY src src
RUN ./gradlew --no-daemon bootJar -x test

# Run (utilizator fără drepturi de root)
FROM eclipse-temurin:24-jre
RUN useradd --system --uid 10001 cumped && mkdir -p /data/uploads && chown cumped /data/uploads
USER cumped
WORKDIR /app
COPY --from=build /src/build/libs/*.jar app.jar
ENV UPLOADS_DIR=/data/uploads
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]
