# Architecture

## System view

![Architecture](architecture/system-architecture.svg)

The HTTP process and workers share contracts, infrastructure, and encapsulated PostgreSQL access while running as independent processes. This remains a modular monolith: modules do not own separate databases and do not communicate through remote service APIs.

## Synchronous layers

```text
Client → Nginx → Controller → Service → Repository → Database → pkg_* → PostgreSQL
```

- `Controller`: HTTP transport, input validation, and response codes.
- `Service`: business rules and use-case orchestration.
- `Repository`: adaptation between domain contracts and infrastructure.
- `Database`: the only `pg.Pool`, routine allowlist, transactions, health checks, and shutdown.
- `pkg_*`: the public PostgreSQL API; tables remain private to `newsfeed_app`.

## Post creation path

![Post creation](architecture/post-created-flow.svg)

`POST /api/posts` completes when PostgreSQL commits both the post and its outbox event. Follower propagation happens afterward, so RabbitMQ latency or downtime cannot invalidate an already durable post.

## Asynchronous path

```text
outbox_events
  → Outbox Publisher
  → exchange newsfeed.events
  → feed.fanout | feed.cleanup | feed.rebuild
  → Fanout/Cleanup/Rebuild Worker
  → timeline:{userId} | author_posts:{userId}
```

Messages that exhaust `RABBITMQ_MAX_RETRIES` are routed to `feed.dlq`. Consumers use prefetch, manual acknowledgements, connection recovery, and idempotent effects.

## Runtime topology

| Element                | Identifier                                                             |
| ---------------------- | ---------------------------------------------------------------------- |
| Durable topic exchange | `newsfeed.events`                                                      |
| Fan-out queue          | `feed.fanout`                                                          |
| Cleanup queue          | `feed.cleanup`                                                         |
| Rebuild queue          | `feed.rebuild`                                                         |
| Dead-letter queue      | `feed.dlq`                                                             |
| Routing keys           | `post.created`, `user.followed`, `user.unfollowed`, `timeline.rebuild` |
| Timeline               | `timeline:{userId}`                                                    |
| Author stream          | `author_posts:{userId}`                                                |

## Availability and shutdown

`GET /health` reports process liveness. `GET /health/ready` checks PostgreSQL, Redis, and RabbitMQ. On `SIGTERM` or `SIGINT`, the process stops accepting HTTP traffic, stops consumers and channels, closes RabbitMQ, closes Redis, and finally closes `pg.Pool`.

## Verification

The implementation contains concrete controllers, services, repositories, workers, migrations, Docker infrastructure, health checks, shutdown handling, tests, and generated architecture evidence. Graphify and the database-policy scanner verify that the documented boundaries match the integrated code.
