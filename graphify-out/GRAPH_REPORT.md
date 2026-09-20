# Graph Report - news-feed-lab2  (2026-09-19)

## Corpus Check
- 105 files · ~27,124 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 710 nodes · 1559 edges · 46 communities (32 shown, 11 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 83 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `56a49b26`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- rebuildWorker.ts
- FeedService.ts
- Post
- News Feed Lab 2
- RabbitMQConnection
- User
- package.json
- server.ts
- newsfeed-flow.test.ts
- scripts
- UserServiceContract
- database-policy.ts
- RoutineExecutor
- devDependencies
- migrations-docker.sh
- compilerOptions
- 003_users_api.sql
- tsconfig.build.json
- UserRepository.ts
- outboxPublisher.ts
- RedisService
- 004_posts_feed_api.sql
- RabbitMQConnection.ts
- app.ts
- Database.ts
- 002_core_schema.sql
- dependencies
- 005_outbox_api.sql
- UserRepository
- FeedRepository.ts
- UserController.ts
- Integrated Docker Runtime
- .prettierrc.json
- pkg_lab_seed.generate_mock_data
- migrate.sh
- run-init.sh
- timelineRebuilder.ts
- database.ts
- UserController.test.ts
- CleanupWorker
- Final Validation — Lab 2 News Feed
- vitest
- .handle

## God Nodes (most connected - your core abstractions)
1. `User` - 43 edges
2. `Post` - 38 edges
3. `RedisService` - 32 edges
4. `RabbitMQConnection` - 31 edges
5. `database` - 22 edges
6. `vitest` - 20 edges
7. `RoutineExecutor` - 19 edges
8. `loadConfig()` - 19 edges
9. `PostRepositoryContract` - 18 edges
10. `UserRepositoryContract` - 18 edges

## Surprising Connections (you probably didn't know these)
- `Routines-Only Database Access` --semantically_similar_to--> `PostgreSQL Package API`  [INFERRED] [semantically similar]
  docs/DATABASE.md → database/README.md
- `Atomic Post and Event Write` --semantically_similar_to--> `Atomic Domain Events`  [INFERRED] [semantically similar]
  docs/OUTBOX.md → database/README.md
- `Modular Monolith with Independent Workers` --conceptually_related_to--> `System Architecture`  [INFERRED]
  README.md → docs/ARCHITECTURE.md
- `requireInfrastructure()` --calls--> `RedisService`  [EXTRACTED]
  tests/integration/newsfeed-flow.test.ts → src/infrastructure/redis/RedisService.ts
- `Rebuildable Redis Projections` --conceptually_related_to--> `PostgreSQL Source of Truth`  [INFERRED]
  docs/REDIS.md → database/README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Durable Event Delivery Flow** — docs_outbox_atomic_post_event_write, docs_outbox_outbox_publisher, docs_rabbitmq_rabbitmq_topology, docs_rabbitmq_consumer_idempotency [EXTRACTED 1.00]
- **Hybrid Timeline Flow** — docs_fanout_fanout_on_write, docs_fanout_fanout_on_read, docs_fanout_hybrid_feed_algorithm, docs_redis_timeline_sorted_sets [EXTRACTED 1.00]
- **Multi-Agent Release Evidence** — docs_git_workflow_dependency_ordered_integration, docs_multi_agent_frozen_contracts, docs_graph_analysis_drift_gate, docs_architecture_readme_visual_validation_evidence [INFERRED 0.85]

## Communities (46 total, 11 thin omitted)

### Community 0 - "rebuildWorker.ts"
Cohesion: 0.17
Nodes (19): DomainEvent, EVENT_TYPES, EventType, FollowChangedPayload, PostCreatedPayload, RABBITMQ, database, createFanoutWorker() (+11 more)

### Community 1 - "FeedService.ts"
Cohesion: 0.06
Nodes (30): zod, TimelinePage, decodeFeedCursor(), encodeFeedCursor(), FeedCursor, feedCursorSchema, createFeedRouter(), feedRouter (+22 more)

### Community 2 - "Post"
Cohesion: 0.06
Nodes (29): express, Post, PostRepositoryContract, createPostRouter(), postRouter, createApp(), FakePostRepository, post (+21 more)

### Community 3 - "News Feed Lab 2"
Cohesion: 0.06
Nodes (45): Atomic Domain Events, PostgreSQL Package API, PostgreSQL Source of Truth, Asynchronous Event Path, Graceful Shutdown Order, Archify Diagram Inventory, Regenerable Visual Sources, Visual Validation Evidence (+37 more)

### Community 4 - "RabbitMQConnection"
Cohesion: 0.26
Nodes (5): RabbitMQConnection, main(), main(), main(), requireInfrastructure()

### Community 5 - "User"
Cohesion: 0.13
Nodes (6): User, UserRepositoryContract, alice, bob, FakeUserRepository, UserService

### Community 6 - "package.json"
Cohesion: 0.11
Nodes (17): engines, node, name, private, type, version, dotenv, eslint (+9 more)

### Community 7 - "server.ts"
Cohesion: 0.09
Nodes (15): AppConfig, booleanString, envSchema, createRedisService(), createShutdown(), DatabaseLifecycle, installSignalHandlers(), main() (+7 more)

### Community 8 - "newsfeed-flow.test.ts"
Cohesion: 0.15
Nodes (8): SeedResult, closePool(), createPoolConfig(), getPool(), initializePool(), withClient(), Infrastructure, pgState

### Community 9 - "scripts"
Cohesion: 0.11
Nodes (18): scripts, build, dev, format, format:check, lint, seed, start (+10 more)

### Community 11 - "database-policy.ts"
Cohesion: 0.23
Nodes (11): typescript, add(), DIRECT_SQL, isIgnored(), lineOf(), literalText(), main(), PolicyViolation (+3 more)

### Community 12 - "RoutineExecutor"
Cohesion: 0.13
Nodes (6): ApprovedRoutine, RoutineExecutor, FakeDatabase, FakeDatabase, FakeRoutineExecutor, RoutineCall

### Community 13 - "devDependencies"
Cohesion: 0.14
Nodes (14): devDependencies, eslint, @eslint/js, prettier, supertest, tsx, @types/amqplib, @types/express (+6 more)

### Community 15 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, resolveJsonModule, skipLibCheck, strict (+3 more)

### Community 17 - "tsconfig.build.json"
Cohesion: 0.20
Nodes (9): ./tsconfig.json, compilerOptions, declaration, outDir, rootDir, sourceMap, exclude, extends (+1 more)

### Community 18 - "UserRepository.ts"
Cohesion: 0.16
Nodes (11): FollowAlreadyExistsError, FollowNotFoundError, SelfFollowError, UserDomainError, UsernameAlreadyExistsError, UserNotFoundError, PostgreSqlError, normalizedUser (+3 more)

### Community 19 - "outboxPublisher.ts"
Cohesion: 0.17
Nodes (8): loadConfig(), OutboxRepositoryContract, createOutboxPublisher(), EventPublisher, main(), OutboxPublisher, OutboxPublisherOptions, errorMessage()

### Community 21 - "004_posts_feed_api.sql"
Cohesion: 0.36
Nodes (5): pkg_feed.validate_feed_items(), pkg_posts.get_post(), pkg_posts.get_recent_posts(), pkg_posts.get_user_posts(), public.posts

### Community 22 - "RabbitMQConnection.ts"
Cohesion: 0.12
Nodes (14): amqplib, ioredis, redisKeys, ConsumerRegistration, createRabbitMQConnection(), MessageHandler, RabbitMQConnectionOptions, RabbitQueue (+6 more)

### Community 23 - "app.ts"
Cohesion: 0.16
Nodes (12): supertest, ApplicationHealthDependencies, ApplicationRouters, check(), createApp(), CreateAppOptions, errorBody(), HealthCheck (+4 more)

### Community 24 - "Database.ts"
Cohesion: 0.27
Nodes (13): approvedRoutines, assertApprovedRoutine(), callFunction(), callProcedure(), executeFunction(), executeProcedure(), healthCheck(), placeholders() (+5 more)

### Community 25 - "002_core_schema.sql"
Cohesion: 0.38
Nodes (6): public.follows, public.outbox_events, public.posts, public.processed_events, public.users, public

### Community 26 - "dependencies"
Cohesion: 0.29
Nodes (7): dependencies, amqplib, dotenv, express, ioredis, pg, zod

### Community 28 - "UserRepository"
Cohesion: 0.21
Nodes (4): errorCode(), normalizeTimestamp(), normalizeUser(), UserRepository

### Community 29 - "FeedRepository.ts"
Cohesion: 0.21
Nodes (9): FeedRepository, post(), PostRow, timestamp(), user(), UserRow, event(), post() (+1 more)

### Community 30 - "UserController.ts"
Cohesion: 0.21
Nodes (11): UserErrorCode, CreateUserBody, createUserBodySchema, FollowBody, followBodySchema, UnfollowParams, unfollowParamsSchema, userId (+3 more)

### Community 31 - "Integrated Docker Runtime"
Cohesion: 0.60
Nodes (5): Integrated Docker Runtime, PostgreSQL Service, RabbitMQ Service, Redis Service, Independent Worker Services

### Community 32 - ".prettierrc.json"
Cohesion: 0.40
Nodes (4): printWidth, semi, singleQuote, trailingComma

### Community 36 - "timelineRebuilder.ts"
Cohesion: 0.23
Nodes (7): TimelineEntry, createRebuildWorker(), RebuildWorker, TimelineRebuilder, TimelineRebuilderOptions, TimelineWriter, toTimelineEntry()

### Community 40 - "database.ts"
Cohesion: 0.32
Nodes (4): APPROVED_DATABASE_SCHEMAS, DATABASE_ROUTINES, postRow, userRow

### Community 42 - "CleanupWorker"
Cohesion: 0.33
Nodes (3): CleanupTimelineStore, CleanupWorker, createCleanupWorker()

### Community 43 - "Final Validation — Lab 2 News Feed"
Cohesion: 0.40
Nodes (4): CI remoto, Final Validation — Lab 2 News Feed, Resultado, Validación de ejecución

## Knowledge Gaps
- **144 isolated node(s):** `Resultado`, `Validación de ejecución`, `CI remoto`, `ConsumerRegistration`, `MessageHandler` (+139 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 233 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `RedisService` connect `RedisService` to `RabbitMQConnection`?**
  _High betweenness centrality (0.001) - this node is a cross-community bridge._
- **Why does `RabbitMQConnection` connect `RabbitMQConnection` to `outboxPublisher.ts`?**
  _High betweenness centrality (0.001) - this node is a cross-community bridge._
- **What connects `Resultado`, `Validación de ejecución`, `CI remoto` to the rest of the system?**
  _144 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `FeedService.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06201923076923077 - nodes in this community are weakly interconnected._
- **Should `Post` be split into smaller, more focused modules?**
  _Cohesion score 0.06298904538341157 - nodes in this community are weakly interconnected._
- **Should `News Feed Lab 2` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._
- **Should `User` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._