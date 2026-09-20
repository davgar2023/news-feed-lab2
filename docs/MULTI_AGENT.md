# Multi-Agent Development

## Coordination contract

Wave 0 freezes shared interfaces, routine names, events, topology, keys, and environment contracts in `contracts-v1`. Later agents implement in parallel without silently changing those contracts. A contract change requires explicit coordination and simultaneous updates to consumers, tests, and documentation.

## Ownership

| Agent          | Primary ownership                                                 |
| -------------- | ----------------------------------------------------------------- |
| Database       | `database/**`                                                     |
| Infrastructure | `src/infrastructure/**`, `src/config/**`, `docker/**`, `nginx/**` |
| Users          | `src/modules/users/**`                                            |
| Posts          | `src/modules/posts/**`                                            |
| Feed           | `src/modules/feed/**`                                             |
| Workers        | `src/workers/**`                                                  |
| Testing        | `tests/**`, `scripts/verify/**`                                   |
| Documentation  | `docs/**`, `README.md`                                            |

Shared files change only when the integration owner can assess all consumers.

## Agent completion protocol

Each agent:

1. works in a dedicated branch and worktree;
2. stays within its ownership boundary;
3. implements complete production behavior rather than placeholders;
4. runs relevant format, lint, typecheck, tests, and policy checks;
5. creates logical Conventional Commits;
6. hands off a clean working tree and evidence.

## Integration protocol

The integration owner reviews diffs, merges in dependency order, and fixes incompatibilities on an integration branch. Missing dependencies are inspected, implemented, tested, and versioned rather than deferred as agent status reports.

## Conflict prevention

- Freeze shared contracts before parallel work.
- Keep one domain owner per path.
- Avoid unrelated formatting in shared files.
- Merge dependency providers before consumers.
- Regenerate derived artifacts from the final integrated tree.
- Resolve conflicts by preserving intended behavior, not by deleting one side.

## Architecture evidence

Graphify describes what was built; Archify communicates it visually. The drift gate compares both. A documented worker, queue, key, schema, or dependency must exist in code before release.
