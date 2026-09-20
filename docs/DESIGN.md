# Design

## Scope

The system is a modular monolith with three business modules (`users`, `posts`, and `feed`) plus four independent worker processes (`outbox`, `fanout`, `cleanup`, and `rebuild`). Shared contracts define database routines, event types, RabbitMQ topology, Redis keys, and repository interfaces.

## Decisions

### PostgreSQL as the source of truth

Users, posts, follows, and event state live in PostgreSQL. Redis is a disposable read projection, so timelines can be recovered without making the cache authoritative for visibility or relationships.

### Package-style database API

PostgreSQL has no Oracle-style `PACKAGE`, so schemas provide package boundaries: `pkg_users`, `pkg_posts`, `pkg_feed`, `pkg_outbox`, and `pkg_lab_seed`. `Database.callFunction` and `Database.callProcedure` are the only runtime execution points and enforce `DATABASE_ROUTINES` and `APPROVED_DATABASE_SCHEMAS`.

### Transactional outbox

`pkg_posts.create_post` writes `posts` and `outbox_events` in one transaction. RabbitMQ does not participate in that commit. The publisher later claims pending events through `pkg_outbox`, publishes them, and records success or failure.

### Hybrid feed

Mass fan-out is efficient for regular authors. Authors at or above `CELEBRITY_THRESHOLD` store posts in `author_posts:{userId}`. On reads, `FeedService` combines regular timeline entries with followed celebrity streams, deduplicates, sorts by descending timestamp, and applies stable cursor pagination.

### At-least-once delivery

RabbitMQ may redeliver messages. `processed_events` and `pkg_outbox.try_process_event` make consumer effects idempotent. Using `postId` as the Redis sorted-set member also makes repeated `ZADD` operations safe.

### Follow and unfollow consistency

PostgreSQL commits the relationship before projection. `user.followed` triggers rebuild, while `user.unfollowed` triggers cleanup. Feed reads validate visibility so stale projections cannot expose posts from an author who is no longer followed.

## Invariants

1. Controllers never import `pg`, `ioredis`, or `amqplib`.
2. Services never create pools or compose business SQL.
3. SQL repositories invoke only approved routines through `Database`.
4. Only `src/infrastructure/database/Database.ts` creates `pg.Pool`.
5. RabbitMQ ACK happens only after a successful idempotent effect.
6. Redis loss may reduce feed availability or performance, never durable truth.
7. Post creation never publishes directly from HTTP.

## Trade-offs

| Decision             | Benefit                                       | Controlled cost                                    |
| -------------------- | --------------------------------------------- | -------------------------------------------------- |
| Routines-only access | Small SQL surface and enforceable permissions | More migrations and SQL API versioning             |
| Hybrid fan-out       | Bounded writes for celebrity accounts         | More complex reads and pagination                  |
| Transactional outbox | Eliminates post/broker dual-write loss        | Eventual consistency and another publisher process |
| Modular monolith     | Simple transactions and deployment            | Strict internal dependency discipline              |
| Independent workers  | Independent asynchronous scaling              | Per-process recovery, observability, and shutdown  |

## Drift criterion

The final gate compares diagrams, Graphify output, and integrated code. Every documented module, worker, queue, routing key, Redis key, and package schema must exist with the same identifier.
