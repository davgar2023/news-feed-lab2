#!/bin/sh
set -eu

: "${NEWSFEED_OWNER_PASSWORD:?NEWSFEED_OWNER_PASSWORD is required}"
: "${NEWSFEED_APP_PASSWORD:?NEWSFEED_APP_PASSWORD is required}"

find /database-init -type f -name '*.sql' -print | sort | while IFS= read -r migration; do
  psql --set ON_ERROR_STOP=1 \
    --set newsfeed_owner_password="$NEWSFEED_OWNER_PASSWORD" \
    --set newsfeed_app_password="$NEWSFEED_APP_PASSWORD" \
    --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --file "$migration"
done
