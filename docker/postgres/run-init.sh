#!/bin/sh
set -eu

find /database-init -type f -name '*.sql' -print | sort | while IFS= read -r migration; do
  psql --set ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --file "$migration"
done
