# Archify Diagrams

Each diagram has three forms:

- `src/*.json`: regenerable specification and visual source of truth.
- `*.html`: self-contained, interactive, validated Archify Viewer.
- `*.svg`: canonical vector export from the delivered Viewer.

Visual-check files provide automated browser evidence tied to the exact delivered HTML. They do not replace deterministic validation or perceptual review.

## Inventory

| Diagram                       | Type           | Source                                      | Showcase                  | Browser |
| ----------------------------- | -------------- | ------------------------------------------- | ------------------------- | ------- |
| System Architecture           | `architecture` | `src/system-architecture.architecture.json` | 9/9, 0 errors, 0 warnings | PASS    |
| Post Creation Workflow        | `sequence`     | `src/post-created-flow.sequence.json`       | 9/9, 0 errors, 0 warnings | PASS    |
| Fan-Out on Write Workflow     | `sequence`     | `src/fanout-write.sequence.json`            | 9/9, 0 errors, 0 warnings | PASS    |
| Hybrid Timeline Workflow      | `sequence`     | `src/hybrid-feed.sequence.json`             | 9/9, 0 errors, 0 warnings | PASS    |
| Follow/Unfollow Workflow      | `sequence`     | `src/follow-unfollow.sequence.json`         | 9/9, 0 errors, 0 warnings | PASS    |
| Transactional Outbox Workflow | `sequence`     | `src/transactional-outbox.sequence.json`    | 9/9, 0 errors, 0 warnings | PASS    |
| Multi-Agent Git Workflow      | `workflow` v2  | `src/multi-agent-git.workflow.json`         | 9/9, 0 errors, 0 warnings | PASS    |

Browser evidence covers containment and readability at 1440×900, 1600×1000, 1920×1080, and 2048×1320, including light and dark screenshots at the boundary sizes. Perceptual review passed for all seven diagrams.

## Regeneration

Run `validate` after changing a source, `deliver` once after the source is frozen, and `visual-check` only after successful delivery:

```bash
export ARCHIFY_DIR=/path/to/archify

node "$ARCHIFY_DIR/bin/archify.mjs" validate architecture src/system-architecture.architecture.json --quality showcase --json
node "$ARCHIFY_DIR/bin/archify.mjs" deliver architecture src/system-architecture.architecture.json system-architecture.html --quality showcase --json
node "$ARCHIFY_DIR/bin/archify.mjs" visual-check system-architecture.html --json
```

Use `sequence` for the five sequence sources and `workflow` for `multi-agent-git.workflow.json`. Open the delivered HTML and use `Export → SVG` to refresh the vector. Do not manually extract or edit the embedded SVG.

Viewer-owned UI and authored diagram content both use English. Technical identifiers remain exact.
