# RabbitMQ

## Topology

| Routing key        | Queue          | Purpose                                      |
| ------------------ | -------------- | -------------------------------------------- |
| `post.created`     | `feed.fanout`  | Materialize normal or celebrity author posts |
| `user.followed`    | `feed.rebuild` | Add visible history for a new follow         |
| `user.unfollowed`  | `feed.cleanup` | Remove posts from an unfollowed author       |
| `timeline.rebuild` | `feed.rebuild` | Rebuild a timeline from durable state        |

`feed.fanout`, `feed.cleanup`, `feed.rebuild`, and `feed.dlq` are durable queues bound to the durable topic exchange `newsfeed.events`.

## Delivery semantics

- Messages are persistent.
- Publisher confirmation precedes `pkg_outbox.mark_published`.
- Consumers use manual ACK.
- `RABBITMQ_PREFETCH` limits in-flight work.
- `RABBITMQ_MAX_RETRIES` bounds retries before dead-letter routing.
- Connections and channels recover without creating divergent topology.

## Idempotency

Before applying an effect, a consumer uses `pkg_outbox.try_process_event(eventId, consumer)` backed by `processed_events`. Redelivery is acknowledged without repeating the business effect. Redis reinforces this property by using `postId` as the sorted-set member.

## Failure handling

Recoverable failures carry bounded retry metadata. Poison messages end in the DLQ with diagnostic context instead of looping forever. A failure is never acknowledged as silent success. Graceful shutdown stops consumption, allows bounded in-flight completion, closes channels, and then closes the connection.

## Safe observability

Log event identifiers, event type, routing key, queue, retry count, outcome, and duration. Never log credentials, tokens, or complete sensitive payloads. Readiness distinguishes a connected broker from usable topology.
