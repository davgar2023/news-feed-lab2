#!/usr/bin/env sh
set -eu

container="newsfeed-migrations-$$"
owner_password="migration_owner_test_only"
app_password="migration_app_test_only"
cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker run --detach --rm --name "$container" \
  --env POSTGRES_DB=newsfeed \
  --env POSTGRES_USER=postgres \
  --env POSTGRES_PASSWORD=postgres \
  postgres:17-bookworm >/dev/null

attempt=0
until docker exec "$container" pg_isready --username postgres --dbname newsfeed >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    echo "PostgreSQL container did not become ready" >&2
    exit 1
  fi
  sleep 1
done

for pass in 1 2; do
  echo "Migration pass $pass"
  for migration in database/migrations/*.sql; do
    echo "Applying $(basename "$migration")"
    docker exec --interactive "$container" psql \
      --username postgres --dbname newsfeed --set ON_ERROR_STOP=1 \
      --set newsfeed_owner_password="$owner_password" \
      --set newsfeed_app_password="$app_password" <"$migration"
  done
done

echo "Migrations apply cleanly twice in disposable PostgreSQL."
