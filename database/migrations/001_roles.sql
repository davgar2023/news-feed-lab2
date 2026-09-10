-- Bootstrap roles. Run this migration as a PostgreSQL administrator.
DO $bootstrap_roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'newsfeed_owner') THEN
    CREATE ROLE newsfeed_owner LOGIN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'newsfeed_app') THEN
    CREATE ROLE newsfeed_app LOGIN;
  END IF;
END
$bootstrap_roles$;

ALTER ROLE newsfeed_owner
  WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION INHERIT;

ALTER ROLE newsfeed_app
  WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT;

-- Local-development credentials. Production deployments should rotate these roles
-- after bootstrap and supply secrets outside source control.
ALTER ROLE newsfeed_owner PASSWORD 'newsfeed_owner';
ALTER ROLE newsfeed_app PASSWORD 'newsfeed_app';

DO $grant_owner_to_migrator$
BEGIN
  IF CURRENT_USER <> 'newsfeed_owner'
     AND NOT pg_catalog.pg_has_role(CURRENT_USER, 'newsfeed_owner', 'MEMBER') THEN
    EXECUTE pg_catalog.format('GRANT newsfeed_owner TO %I', CURRENT_USER);
  END IF;
END
$grant_owner_to_migrator$;

DO $grant_database_connect$
BEGIN
  EXECUTE pg_catalog.format(
    'GRANT CONNECT ON DATABASE %I TO newsfeed_owner, newsfeed_app',
    pg_catalog.current_database()
  );
END
$grant_database_connect$;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM newsfeed_app;
GRANT USAGE, CREATE ON SCHEMA public TO newsfeed_owner;
