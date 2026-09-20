# Graph Report - news-feed-lab2  (2026-09-19)

## Corpus Check
- 104 files · ~26,416 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 705 nodes · 1555 edges · 31 communities (22 shown, 6 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 83 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7bab18d2`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- rebuildWorker.ts
- FeedService.ts
- app.ts
- News Feed Lab 2
- RedisService
- User
- package.json
- server.ts
- Database.ts
- scripts
- UserController.ts
- database-policy.ts
- FeedRepository.ts
- devDependencies
- migrations-docker.sh
- compilerOptions
- 003_users_api.sql
- tsconfig.build.json
- 004_posts_feed_api.sql
- 002_core_schema.sql
- dependencies
- 005_outbox_api.sql
- Post
- Integrated Docker Runtime
- .prettierrc.json
- pkg_lab_seed.generate_mock_data
- migrate.sh
- run-init.sh

## God Nodes (most connected - your core abstractions)
1. `User` - 43 edges
2. `Post` - 38 edges
3. `RedisService` - 32 edges
4. `RabbitMQConnection` - 31 edges
5. `database` - 22 edges
6. `vitest` - 20 edges
7. `loadConfig()` - 19 edges
8. `RoutineExecutor` - 19 edges
9. `scripts` - 18 edges
10. `UserRepositoryContract` - 18 edges

## Surprising Connections (you probably didn't know these)
- `Routines-Only Database Access` --semantically_similar_to--> `PostgreSQL Package API`  [INFERRED] [semantically similar]
  docs/DATABASE.md → database/README.md
- `Atomic Post and Event Write` --semantically_similar_to--> `Atomic Domain Events`  [INFERRED] [semantically similar]
  docs/OUTBOX.md → database/README.md
- `Modular Monolith with Independent Workers` --conceptually_related_to--> `System Architecture`  [INFERRED]
  README.md → docs/ARCHITECTURE.md
- `Rebuildable Redis Projections` --conceptually_related_to--> `PostgreSQL Source of Truth`  [INFERRED]
  docs/REDIS.md → database/README.md
- `event()` --indirect_call--> `timestamp()`  [INFERRED]
  src/workers/workers.test.ts → src/modules/feed/FeedRepository.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Durable Event Delivery Flow** — docs_outbox_atomic_post_event_write, docs_outbox_outbox_publisher, docs_rabbitmq_rabbitmq_topology, docs_rabbitmq_consumer_idempotency [EXTRACTED 1.00]
- **Hybrid Timeline Flow** — docs_fanout_fanout_on_write, docs_fanout_fanout_on_read, docs_fanout_hybrid_feed_algorithm, docs_redis_timeline_sorted_sets [EXTRACTED 1.00]
- **Multi-Agent Release Evidence** — docs_git_workflow_dependency_ordered_integration, docs_multi_agent_frozen_contracts, docs_graph_analysis_drift_gate, docs_architecture_readme_visual_validation_evidence [INFERRED 0.85]

## Communities (31 total, 6 thin omitted)

### Community 0 - "rebuildWorker.ts"
Cohesion: 0.06
Nodes (49): booleanString, envSchema, loadConfig(), DomainEvent, EVENT_TYPES, EventType, FollowChangedPayload, PostCreatedPayload (+41 more)

### Community 1 - "FeedService.ts"
Cohesion: 0.07
Nodes (29): zod, TimelinePage, decodeFeedCursor(), encodeFeedCursor(), FeedCursor, feedCursorSchema, createFeedRouter(), feedRouter (+21 more)

### Community 2 - "app.ts"
Cohesion: 0.07
Nodes (27): express, supertest, ApplicationHealthDependencies, ApplicationRouters, check(), createApp(), CreateAppOptions, errorBody() (+19 more)

### Community 3 - "News Feed Lab 2"
Cohesion: 0.06
Nodes (45): Atomic Domain Events, PostgreSQL Package API, PostgreSQL Source of Truth, Asynchronous Event Path, Graceful Shutdown Order, Archify Diagram Inventory, Regenerable Visual Sources, Visual Validation Evidence (+37 more)

### Community 4 - "RedisService"
Cohesion: 0.09
Nodes (9): createRabbitMQConnection(), RabbitMQConnection, readRetryCount(), parseEntries(), RedisService, main(), main(), main() (+1 more)

### Community 5 - "User"
Cohesion: 0.05
Nodes (30): APPROVED_DATABASE_SCHEMAS, DATABASE_ROUTINES, User, PostRepositoryContract, UserRepositoryContract, createApp(), post, DeletePostRow (+22 more)

### Community 6 - "package.json"
Cohesion: 0.10
Nodes (19): engines, node, name, private, type, version, amqplib, dotenv (+11 more)

### Community 7 - "server.ts"
Cohesion: 0.10
Nodes (13): AppConfig, createRedisService(), createShutdown(), DatabaseLifecycle, installSignalHandlers(), main(), RabbitLifecycle, RedisLifecycle (+5 more)

### Community 8 - "Database.ts"
Cohesion: 0.10
Nodes (24): pg, vitest, SeedResult, approvedRoutines, assertApprovedRoutine(), callFunction(), callProcedure(), closePool() (+16 more)

### Community 9 - "scripts"
Cohesion: 0.11
Nodes (18): scripts, build, dev, format, format:check, lint, seed, start (+10 more)

### Community 10 - "UserController.ts"
Cohesion: 0.09
Nodes (15): UserErrorCode, CreateUserBody, createUserBodySchema, FollowBody, followBodySchema, UnfollowParams, unfollowParamsSchema, userId (+7 more)

### Community 11 - "database-policy.ts"
Cohesion: 0.23
Nodes (11): typescript, add(), DIRECT_SQL, isIgnored(), lineOf(), literalText(), main(), PolicyViolation (+3 more)

### Community 12 - "FeedRepository.ts"
Cohesion: 0.07
Nodes (17): ApprovedRoutine, RoutineExecutor, FeedRepository, post(), PostRow, FakeDatabase, postRow, userRow (+9 more)

### Community 13 - "devDependencies"
Cohesion: 0.14
Nodes (14): devDependencies, eslint, @eslint/js, prettier, supertest, tsx, @types/amqplib, @types/express (+6 more)

### Community 15 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, resolveJsonModule, skipLibCheck, strict (+3 more)

### Community 17 - "tsconfig.build.json"
Cohesion: 0.20
Nodes (9): ./tsconfig.json, compilerOptions, declaration, outDir, rootDir, sourceMap, exclude, extends (+1 more)

### Community 21 - "004_posts_feed_api.sql"
Cohesion: 0.36
Nodes (5): pkg_feed.validate_feed_items(), pkg_posts.get_post(), pkg_posts.get_recent_posts(), pkg_posts.get_user_posts(), public.posts

### Community 25 - "002_core_schema.sql"
Cohesion: 0.38
Nodes (6): public.follows, public.outbox_events, public.posts, public.processed_events, public.users, public

### Community 26 - "dependencies"
Cohesion: 0.29
Nodes (7): dependencies, amqplib, dotenv, express, ioredis, pg, zod

### Community 28 - "Post"
Cohesion: 0.11
Nodes (8): Post, FakeFeed, FakePostRepository, normalizePost(), normalizeTimestamp(), PostRepository, PostPage, FakePostRepository

### Community 31 - "Integrated Docker Runtime"
Cohesion: 0.60
Nodes (5): Integrated Docker Runtime, PostgreSQL Service, RabbitMQ Service, Redis Service, Independent Worker Services

### Community 32 - ".prettierrc.json"
Cohesion: 0.40
Nodes (4): printWidth, semi, singleQuote, trailingComma

## Knowledge Gaps
- **141 isolated node(s):** `semi`, `singleQuote`, `trailingComma`, `printWidth`, `public.outbox_events` (+136 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 229 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `semi`, `singleQuote`, `trailingComma` to the rest of the system?**
  _141 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `rebuildWorker.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06165099268547544 - nodes in this community are weakly interconnected._
- **Should `FeedService.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06892655367231638 - nodes in this community are weakly interconnected._
- **Should `app.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07149758454106281 - nodes in this community are weakly interconnected._
- **Should `News Feed Lab 2` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._
- **Should `RedisService` be split into smaller, more focused modules?**
  _Cohesion score 0.09468599033816426 - nodes in this community are weakly interconnected._
- **Should `User` be split into smaller, more focused modules?**
  _Cohesion score 0.051839464882943144 - nodes in this community are weakly interconnected._