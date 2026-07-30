#!/usr/bin/env bash
#
# Runs the Row Level Security assertion suite against the LOCAL Supabase stack.
#
# The suite impersonates the real `anon` and `authenticated` Postgres roles with
# simulated JWT claims, so a passing run is genuine evidence that the policies
# hold — not a check that the application remembered to filter.
#
# Usage:  npm run test:rls
# Requires: `supabase start` to be running.

set -euo pipefail

PROJECT_ID="ron-raksmey-portfolio-cms"
SUITE="tests/integration/rls.sql"

if [[ ! -f "$SUITE" ]]; then
  echo "error: $SUITE not found. Run this from the repository root." >&2
  exit 1
fi

CONTAINER="$(docker ps -q -f "name=supabase_db_${PROJECT_ID}" || true)"

if [[ -z "$CONTAINER" ]]; then
  echo "error: the local Supabase database is not running." >&2
  echo "       Start it with:  npm run db:start" >&2
  exit 1
fi

echo "Running RLS suite against container ${CONTAINER}…"
echo

docker exec -i "$CONTAINER" \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "$SUITE"

echo
echo "RLS suite passed."
