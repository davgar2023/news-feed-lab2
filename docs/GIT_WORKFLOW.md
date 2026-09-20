# Git Workflow

![Multi-agent Git workflow](architecture/multi-agent-git.svg)

## Branches

- `main`: releasable state; receives `develop` only after every gate passes.
- `develop`: integration branch.
- `agent/*`: domain-owned implementation branches.
- `agent/integration-1` and `agent/final-review`: integration repair and final review.

## Worktrees

Each agent works in a different directory attached to its branch:

```bash
git worktree add ../newsfeed-database agent/database
git worktree add ../newsfeed-infrastructure agent/infrastructure
git worktree add ../newsfeed-users agent/users
git worktree add ../newsfeed-posts agent/posts
git worktree add ../newsfeed-feed agent/feed
git worktree add ../newsfeed-workers agent/workers
git worktree add ../newsfeed-tests agent/tests
git worktree add ../newsfeed-docs agent/docs
```

Run `git worktree list` before creating a worktree to confirm the branch is not already checked out elsewhere.

## Commits

Use scoped Conventional Commits:

```text
feat(database): add package-only routines
feat(feed): compose hybrid timeline
test(security): deny runtime table access
docs(architecture): add verified system diagrams
```

Each commit should be cohesive, reviewable, and internally consistent. Do not mix unrelated changes merely to clean the working tree.

## Integration

Recommended dependency order: contracts, database, infrastructure, users, posts, feed, workers, tests, then docs. After each merge group, install locked dependencies, run gates, update Graphify, and resolve conflicts according to intent without deleting functionality.

## Release

When `FINAL_VALIDATION.md` records every check as PASS, merge `develop` into `main` and tag `lab2-v1.0.0`. The working tree must be clean before both operations.
