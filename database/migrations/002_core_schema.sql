SET ROLE newsfeed_owner;

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  username text NOT NULL,
  display_name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CONSTRAINT users_username_length CHECK (pg_catalog.char_length(username) BETWEEN 3 AND 32),
  CONSTRAINT users_username_format CHECK (username ~ '^[A-Za-z0-9_]+$'),
  CONSTRAINT users_display_name_length CHECK (pg_catalog.char_length(pg_catalog.btrim(display_name)) BETWEEN 1 AND 100)
);

CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_uidx
  ON public.users (pg_catalog.lower(username));

CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CONSTRAINT posts_content_length CHECK (pg_catalog.char_length(pg_catalog.btrim(content)) BETWEEN 1 AND 280)
);

CREATE INDEX IF NOT EXISTS posts_author_created_idx
  ON public.posts (author_id, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS public.follows (
  follower_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  followed_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  PRIMARY KEY (follower_id, followed_id),
  CONSTRAINT follows_no_self_follow CHECK (follower_id <> followed_id)
);

-- The primary key supports following lookups. This reverse index supports fan-out.
CREATE INDEX IF NOT EXISTS follows_followed_follower_idx
  ON public.follows (followed_id, follower_id);

CREATE TABLE IF NOT EXISTS public.outbox_events (
  event_id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  available_at timestamp with time zone NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  published_at timestamp with time zone,
  last_error text,
  CONSTRAINT outbox_event_type_not_blank CHECK (pg_catalog.btrim(event_type) <> ''),
  CONSTRAINT outbox_aggregate_type_not_blank CHECK (pg_catalog.btrim(aggregate_type) <> ''),
  CONSTRAINT outbox_payload_is_object CHECK (pg_catalog.jsonb_typeof(payload) = 'object'),
  CONSTRAINT outbox_status_valid CHECK (status IN ('pending', 'failed', 'published')),
  CONSTRAINT outbox_retry_count_nonnegative CHECK (retry_count >= 0),
  CONSTRAINT outbox_published_state_valid CHECK (
    (status = 'published' AND published_at IS NOT NULL)
    OR (status <> 'published' AND published_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS outbox_pending_created_idx
  ON public.outbox_events (available_at, created_at, event_id)
  WHERE status IN ('pending', 'failed');

CREATE TABLE IF NOT EXISTS public.processed_events (
  event_id uuid NOT NULL,
  consumer_name text NOT NULL,
  processed_at timestamp with time zone NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  PRIMARY KEY (event_id, consumer_name),
  CONSTRAINT processed_events_consumer_not_blank CHECK (pg_catalog.btrim(consumer_name) <> '')
);

CREATE INDEX IF NOT EXISTS processed_events_processed_at_idx
  ON public.processed_events (processed_at);

CREATE SCHEMA IF NOT EXISTS pkg_users AUTHORIZATION newsfeed_owner;
CREATE SCHEMA IF NOT EXISTS pkg_posts AUTHORIZATION newsfeed_owner;
CREATE SCHEMA IF NOT EXISTS pkg_feed AUTHORIZATION newsfeed_owner;
CREATE SCHEMA IF NOT EXISTS pkg_outbox AUTHORIZATION newsfeed_owner;
CREATE SCHEMA IF NOT EXISTS pkg_lab_seed AUTHORIZATION newsfeed_owner;

ALTER DEFAULT PRIVILEGES FOR ROLE newsfeed_owner IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE newsfeed_owner IN SCHEMA public
  REVOKE ALL ON TABLES FROM newsfeed_app;
ALTER DEFAULT PRIVILEGES FOR ROLE newsfeed_owner IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE newsfeed_owner IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM newsfeed_app;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, newsfeed_app;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, newsfeed_app;

RESET ROLE;
