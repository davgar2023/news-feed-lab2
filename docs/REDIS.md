# Redis

## Role

Redis stores read projections. PostgreSQL retains relationships, posts, and event state. Workers can rebuild Redis through approved `pkg_*` APIs after data loss.

## Keys

| Pattern                 | Type       | Score          | Member   | Purpose                          |
| ----------------------- | ---------- | -------------- | -------- | -------------------------------- |
| `timeline:{userId}`     | Sorted Set | Post timestamp | `postId` | Precomputed regular-account feed |
| `author_posts:{userId}` | Sorted Set | Post timestamp | `postId` | Celebrity author stream          |

Contract helpers are `redisKeys.timeline(userId)` and `redisKeys.authorPosts(userId)`.

## Writes

The Fanout Worker pipelines the same `postId` to follower timelines and trims old entries to `TIMELINE_MAX_ITEMS`. Stable `postId` membership makes repeated `ZADD` idempotent. Celebrity posts update only `author_posts:{authorId}`. Follow/rebuild and unfollow/cleanup converge asynchronously.

## Reads

`TimelineRepository`, not the controller, encapsulates sorted-set reads. `FeedService` hydrates IDs through PostgreSQL repositories, validates visibility, deduplicates, sorts, and applies a stable cursor for equal timestamps.

## Failures

- Redis failure never authorizes fabricated data or weaker PostgreSQL permissions.
- Readiness becomes degraded according to runtime policy.
- Consumers do not ACK before completing the effect or selecting retry/DLQ behavior.
- Rebuild recovers missing or truncated projections.

## Limits

`TIMELINE_MAX_ITEMS` defaults to `1000` and must be positive. `CELEBRITY_THRESHOLD` defaults to `100000`; tests use `5` to exercise both strategies with ten users.
