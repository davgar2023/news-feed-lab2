# PostgreSQL

## Roles and permissions

`newsfeed_owner` owns tables, indexes, schemas, and routines. `newsfeed_app` is the runtime role and receives only `USAGE` and `EXECUTE` on approved package schemas. It has no direct `SELECT`, `INSERT`, `UPDATE`, `DELETE`, or `TRUNCATE` permission on business tables.

Integration tests prove both sides of the boundary:

1. A direct `SELECT` from `users` as `newsfeed_app` fails.
2. Executing `pkg_users.get_user(...)` as `newsfeed_app` succeeds.

## 3NF model

| Table              | Responsibility              | Main constraints                                                       |
| ------------------ | --------------------------- | ---------------------------------------------------------------------- |
| `users`            | Local identity              | Primary key, unique username, timestamps                               |
| `posts`            | Author content              | Primary key, author foreign key, non-empty content, timestamps         |
| `follows`          | Directed relationship       | Two foreign keys, unique follower/followed pair, no self-follow        |
| `outbox_events`    | Events awaiting publication | Event key, type, aggregate, JSONB payload, status, retries, timestamps |
| `processed_events` | Consumer idempotency        | Unique event and consumer identity                                     |

Indexes support username lookup, posts by author/date, both follow directions, pending outbox events, and processed-event lookup.

## Public package API

- `pkg_users`: `create_user`, `get_user`, `follow_user`, `unfollow_user`, `get_followers`, `get_following`, `count_followers`, `is_following`, `get_celebrity_following`.
- `pkg_posts`: `create_post`, `get_post`, `get_user_posts`, `get_recent_posts`, `delete_post`.
- `pkg_feed`: `validate_feed_items`.
- `pkg_outbox`: `get_pending_events`, `mark_published`, `mark_failed`, `try_process_event`.
- `pkg_lab_seed`: `generate_mock_data`.

## `SECURITY DEFINER`

Privileged routines pin a safe `search_path` and fully qualify sensitive objects. They never resolve objects through a caller-controlled path. Grants apply to approved routines and schemas, not their underlying tables.

## `Database` abstraction

- `initializePool()` and `getPool()` manage one pool per process.
- `withClient()` bounds client checkout and release.
- `callFunction()` and `callProcedure()` enforce the routine allowlist.
- `transaction()` controls begin, commit, and rollback.
- `healthCheck()` supports readiness.
- `closePool()` supports graceful shutdown.

Repositories do not store arbitrary SQL. The only generated SQL is the parameterized routine invocation built centrally by `Database`.

## Automated enforcement

`npm run verify:database-policy` scans runtime TypeScript and fails on direct business-table DML or `new Pool()` outside the database infrastructure. Migration SQL runs under the owner boundary and is intentionally excluded from runtime scanning.
