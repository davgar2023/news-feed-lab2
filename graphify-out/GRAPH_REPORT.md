# Graph Report - news-feed-lab2  (2026-09-10)

## Corpus Check
- Corpus is ~660 words - fits in a single context window. You may not need a graph.

## Summary
- 137 nodes · 148 edges · 12 communities (11 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Project Manifest
- NPM Scripts
- Development Dependencies
- Domain Events
- TypeScript Configuration
- Build Configuration
- Infrastructure Contracts
- Post Contracts
- User Contracts
- Runtime Dependencies
- Environment Validation
- Formatting Rules

## God Nodes (most connected - your core abstractions)
1. `scripts` - 17 edges
2. `compilerOptions` - 10 edges
3. `UserRepositoryContract` - 8 edges
4. `User` - 7 edges
5. `Post` - 6 edges
6. `PostRepositoryContract` - 6 edges
7. `OutboxRepositoryContract` - 5 edges
8. `compilerOptions` - 5 edges
9. `DomainEvent` - 3 edges
10. `engines` - 2 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (12 total, 1 thin omitted)

### Community 0 - "Project Manifest"
Cohesion: 0.08
Nodes (24): engines, node, name, private, type, version, amqplib, dotenv (+16 more)

### Community 1 - "NPM Scripts"
Cohesion: 0.12
Nodes (17): scripts, build, dev, format, format:check, lint, seed, start (+9 more)

### Community 2 - "Development Dependencies"
Cohesion: 0.14
Nodes (14): devDependencies, eslint, @eslint/js, prettier, supertest, tsx, @types/amqplib, @types/express (+6 more)

### Community 3 - "Domain Events"
Cohesion: 0.20
Nodes (6): DomainEvent, EVENT_TYPES, EventType, FollowChangedPayload, PostCreatedPayload, OutboxRepositoryContract

### Community 4 - "TypeScript Configuration"
Cohesion: 0.17
Nodes (11): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, resolveJsonModule, skipLibCheck, strict (+3 more)

### Community 5 - "Build Configuration"
Cohesion: 0.20
Nodes (9): ./tsconfig.json, compilerOptions, declaration, outDir, rootDir, sourceMap, exclude, extends (+1 more)

### Community 6 - "Infrastructure Contracts"
Cohesion: 0.20
Nodes (6): APPROVED_DATABASE_SCHEMAS, DATABASE_ROUTINES, ApiErrorBody, HealthStatus, RABBITMQ, redisKeys

### Community 7 - "Post Contracts"
Cohesion: 0.31
Nodes (3): Post, TimelinePage, PostRepositoryContract

### Community 9 - "Runtime Dependencies"
Cohesion: 0.29
Nodes (7): dependencies, amqplib, dotenv, express, ioredis, pg, zod

### Community 10 - "Environment Validation"
Cohesion: 0.33
Nodes (4): zod, AppConfig, booleanString, envSchema

### Community 11 - "Formatting Rules"
Cohesion: 0.40
Nodes (4): printWidth, semi, singleQuote, trailingComma

## Knowledge Gaps
- **92 isolated node(s):** `semi`, `singleQuote`, `trailingComma`, `printWidth`, `name` (+87 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 99 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `semi`, `singleQuote`, `trailingComma` to the rest of the system?**
  _92 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Project Manifest` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `NPM Scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._
- **Should `Development Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._