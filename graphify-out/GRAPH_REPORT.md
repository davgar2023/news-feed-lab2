# Graph Report - news-feed-lab2  (2026-09-15)

## Corpus Check
- 81 files · ~22,190 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 631 nodes · 1264 edges · 40 communities (23 shown, 14 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 65 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Messaging and Configuration
- Feed HTTP Layer
- Post Domain
- Architecture Documentation
- Redis Timelines
- User Domain Errors
- Project Manifest
- User HTTP Validation
- Database Routine Engine
- NPM Scripts
- User Controllers
- User Persistence Errors
- Feed Persistence
- Development Tooling
- Database Test Doubles
- TypeScript Configuration
- Users SQL Package
- Build Configuration
- Database Facade
- User Contracts
- User Service
- Posts and Feed SQL
- Database Contracts and Tests
- Outbox Contracts
- User Test Doubles
- Core SQL Schema
- Runtime Dependencies
- Outbox SQL Package
- Post Test Doubles A
- Post Test Doubles B
- Controller Test Utilities
- Docker Runtime
- Formatting Rules
- Seed SQL Package
- Migration Runner
- Postgres Init
- Node Engine

## God Nodes (most connected - your core abstractions)
1. `RedisService` - 30 edges
2. `RabbitMQConnection` - 26 edges
3. `RoutineExecutor` - 19 edges
4. `Database` - 18 edges
5. `scripts` - 17 edges
6. `loadConfig()` - 17 edges
7. `UserRepository` - 16 edges
8. `OutboxRepository` - 16 edges
9. `main()` - 16 edges
10. `Post` - 15 edges

## Surprising Connections (you probably didn't know these)
- `Routines-Only Database Access` --semantically_similar_to--> `PostgreSQL Package API`  [INFERRED] [semantically similar]
  docs/DATABASE.md → database/README.md
- `Atomic Post and Event Write` --semantically_similar_to--> `Atomic Domain Events`  [INFERRED] [semantically similar]
  docs/OUTBOX.md → database/README.md
- `Modular Monolith with Independent Workers` --conceptually_related_to--> `System Architecture`  [INFERRED]
  README.md → docs/ARCHITECTURE.md
- `Rebuildable Redis Projections` --conceptually_related_to--> `PostgreSQL Source of Truth`  [INFERRED]
  docs/REDIS.md → database/README.md
- `createUsersRouter()` --calls--> `UserController`  [EXTRACTED]
  src/modules/users/users.routes.ts → src/modules/users/UserController.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Durable Event Delivery Flow** — docs_outbox_atomic_post_event_write, docs_outbox_outbox_publisher, docs_rabbitmq_rabbitmq_topology, docs_rabbitmq_consumer_idempotency [EXTRACTED 1.00]
- **Hybrid Timeline Flow** — docs_fanout_fanout_on_write, docs_fanout_fanout_on_read, docs_fanout_hybrid_feed_algorithm, docs_redis_timeline_sorted_sets [EXTRACTED 1.00]
- **Multi-Agent Release Evidence** — docs_git_workflow_dependency_ordered_integration, docs_multi_agent_frozen_contracts, docs_graph_analysis_drift_gate, docs_architecture_readme_visual_validation_evidence [INFERRED 0.85]

## Communities (40 total, 14 thin omitted)

### Community 0 - "Messaging and Configuration"
Cohesion: 0.05
Nodes (49): amqplib, AppConfig, booleanString, envSchema, loadConfig(), DomainEvent, EVENT_TYPES, EventType (+41 more)

### Community 1 - "Feed HTTP Layer"
Cohesion: 0.06
Nodes (33): supertest, zod, ApiErrorBody, HealthStatus, TimelinePage, decodeFeedCursor(), encodeFeedCursor(), FeedCursor (+25 more)

### Community 2 - "Post Domain"
Cohesion: 0.06
Nodes (29): Post, PostRepositoryContract, TimelineEntry, createPostRouter(), postRouter, createApp(), post, createPostBodySchema (+21 more)

### Community 3 - "Architecture Documentation"
Cohesion: 0.05
Nodes (45): Atomic Domain Events, PostgreSQL Package API, PostgreSQL Source of Truth, Asynchronous Event Path, Graceful Shutdown Order, Archify Diagram Inventory, Regenerable Visual Sources, Visual Validation Evidence (+37 more)

### Community 4 - "Redis Timelines"
Cohesion: 0.09
Nodes (6): ioredis, redisKeys, createRedisService(), parseEntries(), RedisService, RedisServiceOptions

### Community 5 - "User Domain Errors"
Cohesion: 0.17
Nodes (10): vitest, FollowAlreadyExistsError, SelfFollowError, UserDomainError, UsernameAlreadyExistsError, UserNotFoundError, normalizedUser, userRow (+2 more)

### Community 6 - "Project Manifest"
Cohesion: 0.11
Nodes (17): name, private, type, version, dotenv, eslint, @eslint/js, pg (+9 more)

### Community 7 - "User HTTP Validation"
Cohesion: 0.16
Nodes (14): express, UserErrorCode, CreateUserBody, createUserBodySchema, FollowBody, followBodySchema, UnfollowParams, unfollowParamsSchema (+6 more)

### Community 8 - "Database Routine Engine"
Cohesion: 0.21
Nodes (15): approvedRoutines, assertApprovedRoutine(), callFunction(), callProcedure(), createPoolConfig(), executeFunction(), executeProcedure(), healthCheck() (+7 more)

### Community 9 - "NPM Scripts"
Cohesion: 0.12
Nodes (17): scripts, build, dev, format, format:check, lint, seed, start (+9 more)

### Community 11 - "User Persistence Errors"
Cohesion: 0.21
Nodes (7): FollowNotFoundError, errorCode(), normalizeTimestamp(), normalizeUser(), PostgreSqlError, UserRepository, UserRow

### Community 12 - "Feed Persistence"
Cohesion: 0.19
Nodes (9): FeedRepository, post(), PostRow, timestamp(), user(), UserRow, event(), post() (+1 more)

### Community 13 - "Development Tooling"
Cohesion: 0.14
Nodes (14): devDependencies, eslint, @eslint/js, prettier, supertest, tsx, @types/amqplib, @types/express (+6 more)

### Community 14 - "Database Test Doubles"
Cohesion: 0.19
Nodes (5): ApprovedRoutine, FakeDatabase, FakeDatabase, FakeRoutineExecutor, RoutineCall

### Community 15 - "TypeScript Configuration"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, resolveJsonModule, skipLibCheck, strict (+3 more)

### Community 17 - "Build Configuration"
Cohesion: 0.20
Nodes (9): ./tsconfig.json, compilerOptions, declaration, outDir, rootDir, sourceMap, exclude, extends (+1 more)

### Community 18 - "Database Facade"
Cohesion: 0.20
Nodes (3): Database, getPool(), withClient()

### Community 21 - "Posts and Feed SQL"
Cohesion: 0.36
Nodes (5): pkg_feed.validate_feed_items(), pkg_posts.get_post(), pkg_posts.get_recent_posts(), pkg_posts.get_user_posts(), public.posts

### Community 22 - "Database Contracts and Tests"
Cohesion: 0.32
Nodes (4): APPROVED_DATABASE_SCHEMAS, DATABASE_ROUTINES, postRow, userRow

### Community 25 - "Core SQL Schema"
Cohesion: 0.38
Nodes (6): public.follows, public.outbox_events, public.posts, public.processed_events, public.users, public

### Community 26 - "Runtime Dependencies"
Cohesion: 0.29
Nodes (7): dependencies, amqplib, dotenv, express, ioredis, pg, zod

### Community 31 - "Docker Runtime"
Cohesion: 0.60
Nodes (5): Integrated Docker Runtime, PostgreSQL Service, RabbitMQ Service, Redis Service, Independent Worker Services

### Community 32 - "Formatting Rules"
Cohesion: 0.40
Nodes (4): printWidth, semi, singleQuote, trailingComma

## Knowledge Gaps
- **134 isolated node(s):** `HealthStatus`, `node`, `name`, `private`, `type` (+129 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 238 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `RedisService` connect `Redis Timelines` to `Messaging and Configuration`?**
  _High betweenness centrality (0.001) - this node is a cross-community bridge._
- **Why does `Database` connect `Database Facade` to `Database Routine Engine`, `Outbox Contracts`?**
  _High betweenness centrality (0.001) - this node is a cross-community bridge._
- **What connects `HealthStatus`, `node`, `name` to the rest of the system?**
  _134 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Messaging and Configuration` be split into smaller, more focused modules?**
  _Cohesion score 0.05451829723674384 - nodes in this community are weakly interconnected._
- **Should `Feed HTTP Layer` be split into smaller, more focused modules?**
  _Cohesion score 0.05583972719522592 - nodes in this community are weakly interconnected._
- **Should `Post Domain` be split into smaller, more focused modules?**
  _Cohesion score 0.06398730830248546 - nodes in this community are weakly interconnected._
- **Should `Architecture Documentation` be split into smaller, more focused modules?**
  _Cohesion score 0.05353535353535353 - nodes in this community are weakly interconnected._