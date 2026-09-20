# Transactional Outbox

![Transactional outbox](architecture/transactional-outbox.svg)

## Why it exists

Saving a post and publishing to RabbitMQ as independent writes allows impossible states: a post without an event or an event without a post. The outbox stores both durable records in one PostgreSQL transaction.

## Atomic write

`pkg_posts.create_post`:

1. validates the author and content;
2. inserts the post;
3. inserts a `post.created` event with immutable `event_id` and JSONB payload;
4. returns the created post.

PostgreSQL commits or rolls back both records together.

## Publication

The Outbox Publisher:

1. claims a bounded pending batch through `pkg_outbox.get_pending_events`;
2. publishes persistent messages to `newsfeed.events` with the event type as routing key;
3. waits for broker confirmation;
4. calls `pkg_outbox.mark_published(eventId)` on success;
5. calls `pkg_outbox.mark_failed(eventId, error)` on failure.

The publisher never queries or updates `outbox_events` directly.

## Concurrency and retries

Pending-event claims prevent two publishers from processing the same batch concurrently. `retry_count` and `last_error` provide observable bounded retries. A publish may succeed even if confirmation is lost, so consumers always tolerate duplicate delivery and keep the same `event_id` across attempts.
