#!/usr/bin/env sh
set -eu

if [ -z "${DATABASE_ADMIN_URL:-}" ]; then
  echo "DATABASE_ADMIN_URL is required (PostgreSQL administrator connection string)" >&2
  exit 1
fi

if [ -z "${NEWSFEED_OWNER_PASSWORD:-}" ] || [ -z "${NEWSFEED_APP_PASSWORD:-}" ]; then
  echo "NEWSFEED_OWNER_PASSWORD and NEWSFEED_APP_PASSWORD are required" >&2
  exit 1
fi

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
migrations_dir="$script_dir/../migrations"

for migration in "$migrations_dir"/*.sql; do
  echo "Applying $(basename -- "$migration")"
  psql "$DATABASE_ADMIN_URL" --no-psqlrc --set ON_ERROR_STOP=1 \
    --set newsfeed_owner_password="$NEWSFEED_OWNER_PASSWORD" \
    --set newsfeed_app_password="$NEWSFEED_APP_PASSWORD" \
    --file "$migration"
done
