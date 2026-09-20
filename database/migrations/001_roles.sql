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

ALTER ROLE newsfeed_app
  WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT;

-- Passwords are injected by the migration runner and remain outside source control.
ALTER ROLE newsfeed_owner PASSWORD :'newsfeed_owner_password';
ALTER ROLE newsfeed_app PASSWORD :'newsfeed_app_password';

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
    'GRANT CONNECT, CREATE ON DATABASE %I TO newsfeed_owner',
    pg_catalog.current_database()
  );
  EXECUTE pg_catalog.format(
    'GRANT CONNECT ON DATABASE %I TO newsfeed_app',
    pg_catalog.current_database()
  );
END
$grant_database_connect$;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM newsfeed_app;
GRANT USAGE, CREATE ON SCHEMA public TO newsfeed_owner;

-- Demote a Docker-bootstrap owner only after every administrator-only bootstrap
-- action above has completed.
ALTER ROLE newsfeed_owner
  WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION INHERIT;
