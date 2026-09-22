# News Feed Lab

[![CI](https://github.com/davgar2023/news-feed-lab2/actions/workflows/ci.yml/badge.svg)](https://github.com/davgar2023/news-feed-lab2/actions/workflows/ci.yml)
![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-8-DC382D?logo=redis&logoColor=white)
![RabbitMQ](https://img.shields.io/badge/RabbitMQ-4-FF6600?logo=rabbitmq&logoColor=white)
![Nginx](https://img.shields.io/badge/Nginx-1.29-009639?logo=nginx&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-Tested-6E9F18?logo=vitest&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-Validated-3E67B1?logo=zod&logoColor=white)

A scalable Twitter/X-style news feed implemented as a Node.js and TypeScript modular monolith with independent workers. PostgreSQL is the source of truth, Redis stores rebuildable timeline projections, and RabbitMQ transports events created through a transactional outbox.

## Architecture

The synchronous path is `Client → Nginx → Controller → Service → Repository → Database → pkg_* → PostgreSQL`. The asynchronous path is `outbox_events → Outbox Publisher → newsfeed.events → Workers → Redis`.

![System architecture](docs/architecture/system-architecture.svg)

Core guarantees:

- Node.js never executes direct DML against business tables.
- The runtime role may only execute approved routines from `pkg_users`, `pkg_posts`, `pkg_feed`, `pkg_outbox`, and `pkg_lab_seed`.
- `pkg_posts.create_post` persists a post and its outbox event atomically.
- Redis is not a source of truth and can be rebuilt from PostgreSQL.
- RabbitMQ consumers use manual acknowledgements and idempotent processing.
- Regular accounts use fan-out on write; celebrity accounts use fan-out on read.

See [Architecture](docs/ARCHITECTURE.md) and [Design](docs/DESIGN.md) for the complete rationale.

## Requirements

- Node.js 20 or later
- npm with lockfile support
- Docker Engine and Docker Compose v2
- Git with worktree support
- Graphify for repository architecture analysis
- Archify for visual architecture regeneration

## Configuration

Copy `.env.example` to `.env`, replace every placeholder locally, and keep `.env` out of version control. Percent-encode reserved characters when a password is embedded in a connection URL. Never commit production credentials, access tokens, private URLs, or personal filesystem paths.

| Variable                  | Purpose                                           |
| ------------------------- | ------------------------------------------------- |
| `NODE_ENV`                | Runtime profile                                   |
| `PORT`                    | HTTP port                                         |
| `DATABASE_URL`            | Restricted runtime database connection            |
| `DATABASE_ADMIN_URL`      | Administrator connection used only for migrations |
| `REDIS_URL`               | Redis timeline connection                         |
| `RABBITMQ_URL`            | RabbitMQ connection                               |
| `CELEBRITY_THRESHOLD`     | Fan-out-on-read threshold; tests use `5`          |
| `TIMELINE_MAX_ITEMS`      | Maximum members retained per timeline             |
| `OUTBOX_POLL_INTERVAL_MS` | Outbox publisher interval                         |
| `RABBITMQ_PREFETCH`       | Maximum unacknowledged deliveries per consumer    |
| `RABBITMQ_MAX_RETRIES`    | Attempts before dead-letter routing               |
| `TRUST_PROXY`             | Whether Express trusts the Nginx proxy            |

## Run with Docker

```bash
cp .env.example .env
# Replace all CHANGE_ME values in .env before starting the stack.
docker compose up --build -d
docker compose ps
```

PostgreSQL initializes through the administrator account and creates the restricted runtime role. The API and workers connect only through `DATABASE_URL`.

## Run Node.js locally

With PostgreSQL, Redis, and RabbitMQ available through your local environment:

```bash
npm ci
npm run build
npm start
```

Run workers as separate processes:

```bash
npm run start:outbox
npm run start:fanout
npm run start:cleanup
npm run start:rebuild
```

Generate deterministic lab data through the approved database package:

```bash
npm run seed
```

## Verification

```bash
npm run format:check
npm run lint
npm run typecheck
npm run build
npm run verify:database-policy
npm test
npm run test:integration
```

The integration suite requires PostgreSQL, Redis, and RabbitMQ. See [Testing](docs/TESTING.md).

## Graphify

Refresh the graph only from the integrated repository tree:

```bash
graphify update .
```

Generated artifacts live in `graphify-out/`. Findings are documented in [Graph Analysis](docs/GRAPH_ANALYSIS.md).

## Archify

Regenerable sources live in `docs/architecture/src/`. Set a local Archify installation path without committing it:

```bash
export ARCHIFY_DIR=/path/to/archify
node "$ARCHIFY_DIR/bin/archify.mjs" validate architecture docs/architecture/src/system-architecture.architecture.json --quality showcase --json
node "$ARCHIFY_DIR/bin/archify.mjs" deliver architecture docs/architecture/src/system-architecture.architecture.json docs/architecture/system-architecture.html --quality showcase --json
node "$ARCHIFY_DIR/bin/archify.mjs" visual-check docs/architecture/system-architecture.html --json
```

Use `sequence` for the five sequence sources and `workflow` for the multi-agent Git source. The [diagram inventory](docs/architecture/README.md) records validation evidence for all seven diagrams.

## Git model

- `main`: validated releases
- `develop`: active integration
- `agent/*`: isolated specialist branches
- One worktree per agent
- Incremental Conventional Commits
- Dependency-aware integration order: contracts → database → infrastructure → users → posts → feed → workers → tests → docs

See [Git Workflow](docs/GIT_WORKFLOW.md) and [Multi-Agent Development](docs/MULTI_AGENT.md).

## Documentation

- [Design](docs/DESIGN.md)
- [Architecture](docs/ARCHITECTURE.md)
- [PostgreSQL](docs/DATABASE.md)
- [Redis](docs/REDIS.md)
- [RabbitMQ](docs/RABBITMQ.md)
- [Fan-out](docs/FANOUT.md)
- [Transactional Outbox](docs/OUTBOX.md)
- [Git Workflow](docs/GIT_WORKFLOW.md)
- [Multi-Agent Development](docs/MULTI_AGENT.md)
- [Graph Analysis](docs/GRAPH_ANALYSIS.md)
- [Testing](docs/TESTING.md)
- [Final Validation](FINAL_VALIDATION.md)

## Security and privacy

- No production secrets are stored in this repository.
- `.env` files are ignored; `.env.example` contains placeholders only.
- CI uses isolated test-only credentials.
- Logs and documentation must not contain tokens, private endpoints, personal data payloads, or local absolute paths.
