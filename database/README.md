# News Feed database

PostgreSQL is the source of truth. Business tables live in `public`, are owned by
`newsfeed_owner`, and are deliberately inaccessible to `newsfeed_app`. Runtime
code receives `USAGE` on the package schemas and `EXECUTE` on their routines only.

## Migrations

Migrations are ordered and safe to rerun. Bootstrap them with a PostgreSQL
administrator connection (the initial `newsfeed_owner` created by the official
Postgres image is also supported while it is still a bootstrap superuser):

```sh
DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/newsfeed \
  ./database/scripts/migrate.sh
```

`001_roles.sql` creates and then restricts both login roles. Its checked-in
passwords are development defaults and must be rotated by deployment tooling in
non-lab environments. Subsequent migrations switch to `newsfeed_owner`, so all
tables, indexes, schemas, functions, and procedures have the intended owner.

## Package API

- `pkg_users`: `create_user`, `get_user`, `follow_user`, `unfollow_user`,
  `get_followers`, `get_following`, `count_followers`, `is_following`, and
  `get_celebrity_following`.
- `pkg_posts`: `create_post`, `get_post`, `get_user_posts`, `get_recent_posts`,
  and `delete_post`.
- `pkg_feed`: `validate_feed_items` preserves the requested Redis timeline order
  while dropping post IDs no longer present in PostgreSQL.
- `pkg_outbox`: `get_pending_events`, `mark_published`, `mark_failed`, and
  `try_process_event`.
- `pkg_lab_seed`: `generate_mock_data`, defaulting to threshold `5`, creates ten
  deterministic users, fifty posts, and a celebrity relationship set.

`follow_user`, `unfollow_user`, `mark_published`, and `mark_failed` are procedures
and are invoked with `CALL`. The remaining API entries are functions. Every
`SECURITY DEFINER` routine pins `search_path` to `pg_catalog` and fully qualifies
business tables.

`create_post` writes the post and its `post.created` outbox event in the same
function invocation. PostgreSQL statement/transaction atomicity prevents either
record from committing alone. Follow changes use the same pattern for
`user.followed` and `user.unfollowed` events.
