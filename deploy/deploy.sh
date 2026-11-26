#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-all}" # all | flexclubmanagement-back1 | flexclubmanagement-gateway | flexclubmanagement-front

if [ ! -f "$ROOT/deploy/.env" ]; then
  echo "deploy/.env manquant : copiez deploy/.env.example en deploy/.env et remplissez-le." >&2
  exit 1
fi

build_jhipster() { # $1 = dossier du projet
  echo ">>> Build de $1"
  (cd "$ROOT/$1" && ./mvnw -ntp -Pprod clean verify jib:dockerBuild -DskipTests)
}

build_frontend() {
  echo ">>> Build du frontend"
  docker build -t flexclubmanagement-frontend "$ROOT/flexclubmanagement-front"
}

case "$TARGET" in
  flexclubmanagement-back1)  build_jhipster flexclubmanagement-back1 ;;
  flexclubmanagement-gateway)  build_jhipster flexclubmanagement-gateway ;;
  flexclubmanagement-front) build_frontend ;;
  all)      build_jhipster flexclubmanagement-gateway; build_jhipster flexclubmanagement-back1; build_frontend ;;
  *) echo "Usage: $0 [all | flexclubmanagement-back1 | flexclubmanagement-gateway | flexclubmanagement-front]"; exit 1;;
esac
cd "$ROOT/deploy"
docker compose --env-file .env up -d

docker compose ps
echo "Registry: http://localhost:8761  |  App: http://localhost"