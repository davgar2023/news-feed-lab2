# Workflow Git

![Workflow Git multiagente](architecture/multi-agent-git.svg)

## Ramas

- `main`: estado releaseable; recibe `develop` sólo después de todos los gates.
- `develop`: rama de integración.
- `agent/contracts`, `agent/database`, `agent/infrastructure`, `agent/users`, `agent/posts`, `agent/feed`, `agent/workers`, `agent/tests`, `agent/docs`: propiedad por dominio.
- `agent/integration-1` y `agent/final-review`: correcciones de integración y revisión final.

## Worktrees

Cada agente trabaja en un directorio distinto asociado a su branch. Ejemplo:

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

Antes de crear, `git worktree list` confirma que el branch no está activo en otro worktree.

## Commits

Use Conventional Commits y alcance explícito:

```text
feat(database): add package-only routines
feat(feed): compose hybrid timeline
test(security): deny runtime table access
docs(architecture): add verified system diagrams
```

Cada commit debe ser cohesivo, revisable y dejar sus artefactos internos consistentes. No se mezclan cambios ajenos sólo para limpiar el status.

## Integración

Orden recomendado por dependencias:

1. contracts
2. database
3. infrastructure
4. users
5. posts
6. feed
7. workers
8. tests
9. docs

Después de cada grupo de merges: instalar dependencias bloqueadas, ejecutar gates, actualizar Graphify y resolver conflictos según intención. Una resolución no elimina funcionalidad para producir un merge vacío.

## Release

Cuando `FINAL_VALIDATION.md` registra todos los checks en PASS, `develop` se integra en `main` y se crea el tag `lab2-v1.0.0`. `git status --short` debe estar vacío antes del merge y del tag.
