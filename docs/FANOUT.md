# Fan-out

## Fan-out on write

![Fan-out on write](architecture/fanout-write.svg)

For a regular account, `post.created` reaches `feed.fanout`. The worker obtains followers through `pkg_users.get_followers(authorId)`, never from the `follows` table, and pipelines `ZADD timeline:{followerId}` with the post timestamp as score and `postId` as member. It then trims each timeline to `TIMELINE_MAX_ITEMS`.

Benefit: fast reads. Cost: writes scale with the follower count.

## Fan-out on read

For a celebrity account, the worker updates `author_posts:{celebrityId}` instead of every follower timeline. `CELEBRITY_THRESHOLD` selects the strategy from the durable follower count.

Benefit: bounded writes. Cost: reads must merge additional streams.

## Hybrid feed

![Hybrid feed](architecture/hybrid-feed.svg)

1. Read regular IDs from `timeline:{userId}`.
2. Fetch followed celebrities through `pkg_users.get_celebrity_following`.
3. Read each `author_posts:{celebrityId}` stream and recent posts through approved APIs.
4. Hydrate and validate candidates with `pkg_feed.validate_feed_items`.
5. Exclude deleted posts and authors no longer followed.
6. Deduplicate by `postId`.
7. Sort by timestamp descending with a stable tie-breaker.
8. Apply the requested limit and return `TimelinePage.nextCursor`.

## Follow and unfollow

![Follow and unfollow](architecture/follow-unfollow.svg)

`follow_user` rejects self-follows and duplicates, then emits a rebuild event. `unfollow_user` removes the relationship and emits a cleanup event. Feed reads validate candidates against PostgreSQL while projections converge asynchronously.

## Edge conditions

- An empty timeline returns an empty page and a null cursor.
- Event redelivery does not duplicate a `postId`.
- Equal timestamps keep deterministic ordering.
- Partial pipeline failure is not acknowledged before completion or retry.
- Changing the celebrity threshold requires a rebuild to reclassify historical projections.
