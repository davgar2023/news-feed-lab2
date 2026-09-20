# Testing Strategy

## Layers

- Unit: services, validators, repositories with doubles, merge logic, and pagination.
- PostgreSQL integration: migrations, routines, transactions, constraints, and real permissions.
- Redis/RabbitMQ integration: topology, retries, DLQ, idempotency, and projections.
- API: routes, errors, health/readiness, and graceful shutdown.
- Architecture: SQL scanner, pool uniqueness, and Graphify/Archify drift.

## Coverage matrix

| Area           | Required behavior                                                         |
| -------------- | ------------------------------------------------------------------------- |
| Users          | create/get, follow/unfollow, self-follow rejection, duplicate rejection   |
| Posts          | create/get/by user/delete, atomic post and outbox                         |
| Regular feed   | fan-out, descending order, pagination, empty feed, non-followed exclusion |
| Celebrity feed | fan-out on read, hybrid merge, deduplication, test threshold `5`          |
| Unfollow       | immediate read filtering and eventual cleanup                             |
| RabbitMQ       | retry, DLQ, duplicate delivery, manual ACK                                |
| Idempotency    | `processed_events`, stable `postId` membership                            |
| Failures       | Redis unavailable, PostgreSQL recovery, RabbitMQ recovery                 |
| Database       | pool shutdown, roles, package-only scanner                                |
| Seed           | 10 users, 50 posts, follows, one celebrity                                |

## Database security

The integration suite connects with both roles. As `newsfeed_app`, direct `SELECT` on `public.users` fails while `pkg_users.get_user` succeeds. This check uses real grants rather than mocks.

## Commands

```bash
npm run format:check
npm run lint
npm run typecheck
npm run build
npm run verify:database-policy
npm test
npm run test:integration
```

CI runs `npm ci` first. `npm run test:all` reproduces the complete Vitest suite locally.

## Data and isolation

`npm run seed` calls `pkg_lab_seed.generate_mock_data`; Node.js performs no raw inserts. Tests create known state, avoid order dependence, and clean through approved owner APIs. `CELEBRITY_THRESHOLD=5` exercises both fan-out strategies with ten users.

## Success criteria

- No PostgreSQL, Redis, or RabbitMQ handles remain open.
- Results are deterministic for equal timestamps.
- Retries are bounded and observable.
- Redelivery produces the same materialized state.
- Every gate exits with code zero on the integrated tree.
- The working tree is clean after generated artifacts are committed.
