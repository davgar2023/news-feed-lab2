SET ROLE newsfeed_owner;

CREATE OR REPLACE FUNCTION pkg_outbox.get_pending_events(p_limit integer DEFAULT 100)
RETURNS TABLE (
  event_id uuid,
  event_type text,
  aggregate_type text,
  aggregate_id uuid,
  payload jsonb,
  status text,
  retry_count integer,
  created_at timestamp with time zone,
  published_at timestamp with time zone,
  last_error text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT
    event.event_id,
    event.event_type,
    event.aggregate_type,
    event.aggregate_id,
    event.payload,
    event.status,
    event.retry_count,
    event.created_at,
    event.published_at,
    event.last_error
  FROM public.outbox_events AS event
  WHERE event.status IN ('pending', 'failed')
    AND event.available_at <= pg_catalog.clock_timestamp()
  ORDER BY event.created_at, event.event_id
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 0), 500)
  FOR UPDATE OF event SKIP LOCKED
$function$;

CREATE OR REPLACE PROCEDURE pkg_outbox.mark_published(p_event_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $procedure$
DECLARE
  v_updated_count integer;
BEGIN
  UPDATE public.outbox_events AS event
  SET status = 'published',
      published_at = pg_catalog.clock_timestamp(),
      last_error = NULL
  WHERE event.event_id = p_event_id
    AND event.status <> 'published';

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count = 0
     AND NOT EXISTS (
       SELECT 1
       FROM public.outbox_events AS event
       WHERE event.event_id = p_event_id
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002',
      MESSAGE = 'outbox event does not exist';
  END IF;
END
$procedure$;

CREATE OR REPLACE PROCEDURE pkg_outbox.mark_failed(
  p_event_id uuid,
  p_error text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $procedure$
DECLARE
  v_updated_count integer;
BEGIN
  UPDATE public.outbox_events AS event
  SET status = 'failed',
      retry_count = event.retry_count + 1,
      available_at = pg_catalog.clock_timestamp()
        + (
          LEAST(
            300::double precision,
            pg_catalog.power(2::double precision, LEAST(event.retry_count, 8))
          ) * INTERVAL '1 second'
        ),
      last_error = pg_catalog.left(COALESCE(p_error, 'unknown publish error'), 2000)
  WHERE event.event_id = p_event_id
    AND event.status <> 'published';

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count = 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0002',
      MESSAGE = 'publishable outbox event does not exist';
  END IF;
END
$procedure$;

CREATE OR REPLACE FUNCTION pkg_outbox.try_process_event(
  p_event_id uuid,
  p_consumer_name text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_inserted_count integer;
BEGIN
  INSERT INTO public.processed_events (event_id, consumer_name)
  VALUES (p_event_id, pg_catalog.btrim(p_consumer_name))
  ON CONFLICT (event_id, consumer_name) DO NOTHING;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  RETURN v_inserted_count = 1;
END
$function$;

RESET ROLE;
