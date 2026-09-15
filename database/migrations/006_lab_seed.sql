SET ROLE newsfeed_owner;

CREATE OR REPLACE FUNCTION pkg_lab_seed.generate_mock_data(
  p_celebrity_threshold integer DEFAULT 5
)
RETURNS TABLE (
  user_count integer,
  post_count integer,
  follow_count integer,
  celebrity_user_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_user_ids uuid[] := ARRAY[]::uuid[];
  v_user_id uuid;
  v_post_id uuid;
  v_post_created_at timestamp with time zone;
  v_celebrity_threshold integer;
  v_follow_count integer;
  i integer;
  j integer;
BEGIN
  v_celebrity_threshold := LEAST(
    GREATEST(COALESCE(p_celebrity_threshold, 5), 1),
    9
  );

  -- Deterministic IDs and conflict handling make the lab seed safe to rerun.
  FOR i IN 1..10 LOOP
    v_user_id := (
      '00000000-0000-4000-8000-' || pg_catalog.lpad(i::text, 12, '0')
    )::uuid;

    INSERT INTO public.users (id, username, display_name)
    VALUES (
      v_user_id,
      'lab_user_' || pg_catalog.lpad(i::text, 2, '0'),
      CASE WHEN i = 1 THEN 'Lab Celebrity' ELSE 'Lab User ' || i::text END
    )
    ON CONFLICT (id) DO UPDATE
    SET username = EXCLUDED.username,
        display_name = EXCLUDED.display_name;

    v_user_ids := pg_catalog.array_append(v_user_ids, v_user_id);
  END LOOP;

  -- Users 2..threshold+1 follow user 1, guaranteeing one demonstrable
  -- celebrity at the requested lab threshold.
  FOR i IN 2..(v_celebrity_threshold + 1) LOOP
    INSERT INTO public.follows (follower_id, followed_id)
    VALUES (v_user_ids[i], v_user_ids[1])
    ON CONFLICT (follower_id, followed_id) DO NOTHING;
  END LOOP;

  -- A ring gives every account a following relationship without creating a
  -- second celebrity at the default threshold.
  FOR i IN 1..10 LOOP
    INSERT INTO public.follows (follower_id, followed_id)
    VALUES (v_user_ids[i], v_user_ids[(i % 10) + 1])
    ON CONFLICT (follower_id, followed_id) DO NOTHING;
  END LOOP;

  -- Five deterministic posts per user: exactly fifty posts in the lab corpus.
  -- The CTE emits an outbox event only when it inserts a new post.
  FOR i IN 1..10 LOOP
    FOR j IN 1..5 LOOP
      v_post_id := (
        '10000000-0000-4000-8000-'
        || pg_catalog.lpad((((i - 1) * 5) + j)::text, 12, '0')
      )::uuid;
      v_post_created_at := pg_catalog.clock_timestamp()
        - (((10 - i) * 5 + (5 - j))::text || ' minutes')::interval;

      WITH inserted_post AS (
        INSERT INTO public.posts (id, author_id, content, created_at)
        VALUES (
          v_post_id,
          v_user_ids[i],
          'Lab post ' || j::text || ' from lab_user_' || pg_catalog.lpad(i::text, 2, '0'),
          v_post_created_at
        )
        ON CONFLICT (id) DO NOTHING
        RETURNING id, author_id, created_at
      )
      INSERT INTO public.outbox_events (
        event_type,
        aggregate_type,
        aggregate_id,
        payload,
        created_at,
        available_at
      )
      SELECT
        'post.created',
        'post',
        inserted_post.id,
        pg_catalog.jsonb_build_object(
          'postId', inserted_post.id,
          'authorId', inserted_post.author_id,
          'createdAt', inserted_post.created_at
        ),
        inserted_post.created_at,
        inserted_post.created_at
      FROM inserted_post;
    END LOOP;
  END LOOP;

  SELECT pg_catalog.count(*)::integer
  INTO v_follow_count
  FROM public.follows AS f
  WHERE f.follower_id = ANY (v_user_ids)
    AND f.followed_id = ANY (v_user_ids);

  RETURN QUERY
  SELECT 10, 50, v_follow_count, v_user_ids[1];
END
$function$;

RESET ROLE;
