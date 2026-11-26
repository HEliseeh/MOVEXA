#!/usr/bin/env bash
# Injecte des données de test (membres, abonnements, paiements, pointages, cours, prospects…)
# et deux comptes du personnel : rose@flexclub.test (accueil) et serge@flexclub.test (commercial),
# mot de passe Test1234!
#
# À lancer quand l'application tourne (le gateway et le back1 ont créé les tables) :
#   ./deploy/seed/seed.sh
# Refuse de s'exécuter si la base contient déjà des membres. JAMAIS en production.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE/.."

# Génère les fichiers SQL avec les dates du jour
python -I "$HERE/seed_gen.py" "$HERE"

run_sql() { # $1 = base, $2 = fichier
  echo ">>> $2 → $1"
  docker compose --env-file .env exec -T postgres \
    psql -U flexclubmanagement -d "$1" -v ON_ERROR_STOP=1 --single-transaction -q < "$HERE/$2"
}

run_sql flexclubmanagementback1 seed_back1.sql
run_sql gateway seed_gateway.sql
echo "Données de test injectées."
