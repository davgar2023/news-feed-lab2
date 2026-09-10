SET ROLE newsfeed_owner;

CREATE OR REPLACE FUNCTION pkg_posts.create_post(
  p_author_id uuid,
  p_content text
)
RETURNS TABLE (
  id uuid,
  author_id uuid,
  content text,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_post public.posts%ROWTYPE;
BEGIN
  INSERT INTO public.posts (author_id, content)
  VALUES (p_author_id, pg_catalog.btrim(p_content))
  RETURNING * INTO v_post;

  -- Both inserts are part of this function's invoking transaction. Any failure in
  -- the event insert rolls the post insert back with the statement/transaction.
  INSERT INTO public.outbox_events (
    event_type,
    aggregate_type,
    aggregate_id,
    payload,
    created_at,
    available_at
  )
  VALUES (
    'post.created',
    'post',
    v_post.id,
    pg_catalog.jsonb_build_object(
      'postId', v_post.id,
      'authorId', v_post.author_id,
      'createdAt', v_post.created_at
    ),
    v_post.created_at,
    v_post.created_at
  );

  RETURN QUERY
  SELECT v_post.id, v_post.author_id, v_post.content, v_post.created_at;
END
$function$;

CREATE OR REPLACE FUNCTION pkg_posts.get_post(p_post_id uuid)
RETURNS TABLE (
  id uuid,
  author_id uuid,
  content text,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT p.id, p.author_id, p.content, p.created_at
  FROM public.posts AS p
  WHERE p.id = p_post_id
$function$;

CREATE OR REPLACE FUNCTION pkg_posts.get_user_posts(
  p_user_id uuid,
  p_limit integer DEFAULT 50,
  p_before timestamp with time zone DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  author_id uuid,
  content text,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT p.id, p.author_id, p.content, p.created_at
  FROM public.posts AS p
  WHERE p.author_id = p_user_id
    AND (p_before IS NULL OR p.created_at < p_before)
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 0), 100)
$function$;

CREATE OR REPLACE FUNCTION pkg_posts.get_recent_posts(
  p_author_ids uuid[],
  p_limit integer DEFAULT 50,
  p_before timestamp with time zone DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  author_id uuid,
  content text,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT p.id, p.author_id, p.content, p.created_at
  FROM public.posts AS p
  WHERE p.author_id = ANY (COALESCE(p_author_ids, ARRAY[]::uuid[]))
    AND (p_before IS NULL OR p.created_at < p_before)
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 0), 100)
$function$;

CREATE OR REPLACE FUNCTION pkg_posts.delete_post(
  p_post_id uuid,
  p_requesting_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_deleted_count integer;
  v_created_at timestamp with time zone := pg_catalog.clock_timestamp();
BEGIN
  DELETE FROM public.posts AS p
  WHERE p.id = p_post_id
    AND p.author_id = p_requesting_user_id;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  IF v_deleted_count = 0 THEN
    RETURN false;
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
    'timeline.rebuild',
    'user',
    p_requesting_user_id,
    pg_catalog.jsonb_build_object(
      'userId', p_requesting_user_id,
      'deletedPostId', p_post_id
    ),
    v_created_at,
    v_created_at
  );

  RETURN true;
END
$function$;

CREATE OR REPLACE FUNCTION pkg_feed.validate_feed_items(p_post_ids uuid[])
RETURNS TABLE (
  id uuid,
  author_id uuid,
  content text,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT p.id, p.author_id, p.content, p.created_at
  FROM pg_catalog.unnest(COALESCE(p_post_ids, ARRAY[]::uuid[]))
    WITH ORDINALITY AS requested(post_id, position)
  JOIN public.posts AS p ON p.id = requested.post_id
  ORDER BY requested.position
$function$;

RESET ROLE;
