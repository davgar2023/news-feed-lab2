# Graphify Analysis

## Analyzed snapshot

| Field               | Value                                                                     |
| ------------------- | ------------------------------------------------------------------------- |
| Integration branch  | `develop`                                                                 |
| Graphify            | `0.9.56`                                                                  |
| Corpus              | 105 files, approximately 27,124 words                                     |
| Graph               | 710 nodes, 1,559 relationships, 46 communities                            |
| Growth since Wave 0 | 573 nodes and 1,411 relationships                                         |
| Health              | 0 missing endpoints, 0 dangling edges, 0 self-loops, 0 directed collapses |

Reproducible artifacts live in `graphify-out/graph.json`, `graphify-out/graph.html`, and `graphify-out/GRAPH_REPORT.md`. Archify HTML, SVG, and PNG outputs are excluded through `.graphifyignore`; their JSON sources and Markdown inventory remain part of drift review.

## Dependencies and layers

- Controllers import services or HTTP contracts, not `pg`, `ioredis`, or `amqplib`.
- Users, Posts, Feed, and Outbox repositories converge on `Database` and `DATABASE_ROUTINES`.
- `Database.ts` is the only module that builds `SELECT * FROM pkg_*` or `CALL pkg_*`; the AST scanner finds no runtime business-table SQL.
- `TimelineRepository` separates Feed from `RedisService`; Redis does not reach the controller.
- `OutboxPublisher` owns RabbitMQ publication instead of the Posts endpoint.

## Critical paths

### Post creation and fan-out

`PostController → PostService → PostRepository → Database → pkg_posts.create_post()` persists the post and outbox event atomically. `OutboxPublisher → RabbitMQConnection → FanoutWorker → UserRepository → pkg_users.get_followers() → RedisService.fanOutPost()` materializes regular-author timelines. Celebrity posts go to `author_posts:{userId}`.

### Hybrid timeline

`FeedController → FeedService → TimelineRepository/FeedRepository` combines `timeline:{userId}` with recent posts from followed celebrity accounts. `pkg_feed.validate_feed_items()` removes deleted or unauthorized posts before deduplication, descending sort, and stable cursor pagination.

### Follow and unfollow

`UserController → UserService → UserRepository → pkg_users.follow_user()/unfollow_user()` commits the relationship and event together. Rebuild and Cleanup consume those events, use `processed_events` for idempotency, and update only rebuildable Redis projections.

## Centrality and coupling

The highest-connectivity nodes are `User`, `Post`, `RedisService`, `RabbitMQConnection`, `database`, `vitest`, `loadConfig()`, and `RoutineExecutor`. Model centrality reflects use across contracts and tests; infrastructure centrality is expected at persistence and messaging boundaries. No module combines HTTP behavior, business-table SQL, and messaging logic.

Graphify reports no import cycles. Internal call loops in `RabbitMQConnection` represent connection recovery and consumer restart behavior within one adapter, not circular module dependencies.

## Semantic findings

- Routines-only access matches the PostgreSQL package API.
- Posts and their events are written atomically through the outbox.
- Redis projections are rebuildable because PostgreSQL remains authoritative.
- Hyperedges correctly group durable delivery, hybrid timeline, and multi-agent release evidence.

## Architecture drift gate

| Documented element                | Code/graph evidence                | Diagram                                       | Status |
| --------------------------------- | ---------------------------------- | --------------------------------------------- | ------ |
| `users`, `posts`, `feed`          | `src/modules/*`                    | `system-architecture`                         | PASS   |
| `Database` and `pkg_*`            | `Database.ts`, migrations 003–006  | `system-architecture`, `post-created-flow`    | PASS   |
| Outbox Publisher                  | `src/workers/outboxPublisher.ts`   | `transactional-outbox`                        | PASS   |
| Fanout/Cleanup/Rebuild            | `src/workers/*Worker.ts`           | `fanout-write`, `follow-unfollow`             | PASS   |
| `newsfeed.events` and four queues | Contracts and topology setup       | `system-architecture`, `transactional-outbox` | PASS   |
| `timeline:*` and `author_posts:*` | `redisKeys`, `RedisService`        | `fanout-write`, `hybrid-feed`                 | PASS   |
| Hybrid feed                       | `FeedService.timeline()`           | `hybrid-feed`                                 | PASS   |
| Git branches and worktrees        | Git history and worktree inventory | `multi-agent-git`                             | PASS   |

No architecture drift requiring code or diagram changes was found.
