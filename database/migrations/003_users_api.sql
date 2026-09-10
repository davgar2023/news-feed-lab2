SET ROLE newsfeed_owner;

CREATE OR REPLACE FUNCTION pkg_users.create_user(
  p_username text,
  p_display_name text
)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  RETURN QUERY
  INSERT INTO public.users (username, display_name)
  VALUES (pg_catalog.lower(pg_catalog.btrim(p_username)), pg_catalog.btrim(p_display_name))
  RETURNING users.id, users.username, users.display_name, users.created_at;
END
$function$;

CREATE OR REPLACE FUNCTION pkg_users.get_user(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT u.id, u.username, u.display_name, u.created_at
  FROM public.users AS u
  WHERE u.id = p_user_id
$function$;

CREATE OR REPLACE PROCEDURE pkg_users.follow_user(
  p_follower_id uuid,
  p_followed_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $procedure$
DECLARE
  v_created_at timestamp with time zone := pg_catalog.clock_timestamp();
BEGIN
  IF p_follower_id = p_followed_id THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'a user cannot follow itself';
  END IF;

  INSERT INTO public.follows (follower_id, followed_id, created_at)
  VALUES (p_follower_id, p_followed_id, v_created_at);

  INSERT INTO public.outbox_events (
    event_type,
    aggregate_type,
    aggregate_id,
    payload,
    created_at,
    available_at
  )
  VALUES (
    'user.followed',
    'user',
    p_follower_id,
    pg_catalog.jsonb_build_object(
      'followerId', p_follower_id,
      'followedId', p_followed_id
    ),
    v_created_at,
    v_created_at
  );
END
$procedure$;

CREATE OR REPLACE PROCEDURE pkg_users.unfollow_user(
  p_follower_id uuid,
  p_followed_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $procedure$
DECLARE
  v_deleted_count integer;
  v_created_at timestamp with time zone := pg_catalog.clock_timestamp();
BEGIN
  DELETE FROM public.follows AS f
  WHERE f.follower_id = p_follower_id
    AND f.followed_id = p_followed_id;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  IF v_deleted_count = 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002',
      MESSAGE = 'follow relationship does not exist';
  END IF;

  INSERT INTO public.outbox_events (
    event_type,
    aggregate_type,
    aggregate_id,
    payload,
    created_at,
    available_at
  )
  VALUES (
    'user.unfollowed',
    'user',
    p_follower_id,
    pg_catalog.jsonb_build_object(
      'followerId', p_follower_id,
      'followedId', p_followed_id
    ),
    v_created_at,
    v_created_at
  );
END
$procedure$;

CREATE OR REPLACE FUNCTION pkg_users.get_followers(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT u.id, u.username, u.display_name, u.created_at
  FROM public.follows AS f
  JOIN public.users AS u ON u.id = f.follower_id
  WHERE f.followed_id = p_user_id
  ORDER BY f.created_at, u.id
$function$;

CREATE OR REPLACE FUNCTION pkg_users.get_following(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT u.id, u.username, u.display_name, u.created_at
  FROM public.follows AS f
  JOIN public.users AS u ON u.id = f.followed_id
  WHERE f.follower_id = p_user_id
  ORDER BY f.created_at, u.id
$function$;

CREATE OR REPLACE FUNCTION pkg_users.count_followers(p_user_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT pg_catalog.count(*)
  FROM public.follows AS f
  WHERE f.followed_id = p_user_id
$function$;

CREATE OR REPLACE FUNCTION pkg_users.is_following(
  p_follower_id uuid,
  p_followed_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.follows AS f
    WHERE f.follower_id = p_follower_id
      AND f.followed_id = p_followed_id
  )
$function$;

CREATE OR REPLACE FUNCTION pkg_users.get_celebrity_following(
  p_user_id uuid,
  p_celebrity_threshold integer
)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT u.id, u.username, u.display_name, u.created_at
  FROM public.follows AS own_follow
  JOIN public.users AS u ON u.id = own_follow.followed_id
  WHERE own_follow.follower_id = p_user_id
    AND (
      SELECT pg_catalog.count(*)
      FROM public.follows AS celebrity_follow
      WHERE celebrity_follow.followed_id = own_follow.followed_id
    ) >= GREATEST(p_celebrity_threshold, 1)
  ORDER BY u.id
$function$;

RESET ROLE;
