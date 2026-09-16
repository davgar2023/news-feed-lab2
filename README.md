# News Feed Lab 2

News Feed escalable tipo Twitter/X construido como **monolito modular Node.js + TypeScript con workers independientes**. PostgreSQL es la fuente de verdad, Redis materializa timelines y RabbitMQ transporta eventos publicados mediante transactional outbox.

> Estado documental: esta rama parte de `contracts-v1` (`16ef739`). Los nombres de rutinas, eventos, colas, claves y variables descritos como **contratados** existen en `src/contracts` y `src/config`. La implementación ejecutable, migraciones, contenedores y pruebas se verifican después de integrar las ramas especializadas en `develop`.

## Arquitectura

El camino síncrono es `Client → Nginx → Controller → Service → Repository → Database → pkg_* → PostgreSQL`. El camino asíncrono es `outbox_events → Outbox Publisher → newsfeed.events → Workers → Redis`.

![Arquitectura del sistema](docs/architecture/system-architecture.svg)

Principios obligatorios:

- Node.js no ejecuta DML directo sobre `users`, `posts`, `follows`, `outbox_events` o `processed_events`.
- `newsfeed_app` sólo puede ejecutar rutinas aprobadas de `pkg_users`, `pkg_posts`, `pkg_feed`, `pkg_outbox` y `pkg_lab_seed`.
- `pkg_posts.create_post` persiste post y evento outbox en una sola transacción.
- Redis no es fuente de verdad; sus Sorted Sets se pueden reconstruir desde PostgreSQL.
- Los consumidores RabbitMQ son idempotentes y confirman con ACK manual después del efecto exitoso.
- Las cuentas normales usan fan-out on write; las cuentas celebrity se mezclan mediante fan-out on read.

La explicación completa está en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) y [docs/DESIGN.md](docs/DESIGN.md).

## Requisitos

- Node.js 20 o superior.
- npm compatible con `package-lock.json`.
- Docker Engine y Docker Compose v2 para el entorno integrado.
- Git con soporte de worktrees.
- Graphify para el grafo final del repositorio.
- Archify para regenerar la documentación visual.

## Configuración

Copie `.env.example` como `.env` y ajuste secretos para el entorno local. Nunca reutilice esas credenciales de ejemplo en producción.

| Variable                  | Valor de ejemplo                  | Propósito                                          |
| ------------------------- | --------------------------------- | -------------------------------------------------- |
| `NODE_ENV`                | `development`                     | Perfil de ejecución                                |
| `PORT`                    | `3000`                            | Puerto HTTP                                        |
| `DATABASE_URL`            | `postgres://newsfeed_app:…`       | Pool del runtime con permisos restringidos         |
| `DATABASE_OWNER_URL`      | `postgres://newsfeed_owner:…`     | Migraciones, seed y verificaciones administrativas |
| `REDIS_URL`               | `redis://redis:6379`              | Timelines materializados                           |
| `RABBITMQ_URL`            | `amqp://newsfeed:…@rabbitmq:5672` | Transporte asíncrono                               |
| `CELEBRITY_THRESHOLD`     | `100000`                          | Umbral de fan-out on read; pruebas usan `5`        |
| `TIMELINE_MAX_ITEMS`      | `1000`                            | Máximo de miembros por timeline                    |
| `OUTBOX_POLL_INTERVAL_MS` | `500`                             | Intervalo del publisher                            |
| `RABBITMQ_PREFETCH`       | `20`                              | Entregas no confirmadas por consumidor             |
| `RABBITMQ_MAX_RETRIES`    | `3`                               | Intentos antes de DLQ                              |
| `TRUST_PROXY`             | `true` por defecto                | Confianza en Nginx                                 |

## Inicio con Docker

Después de integrar la infraestructura Docker en `develop`:

```bash
cp .env.example .env
docker compose up --build -d postgres redis rabbitmq
docker compose run --rm app npm run seed
docker compose up --build -d app nginx outbox-publisher fanout-worker cleanup-worker rebuild-worker
docker compose ps
```

La inicialización de PostgreSQL debe ejecutarse con `newsfeed_owner`; el servidor y los workers usan `DATABASE_URL` como `newsfeed_app`. Redis y RabbitMQ se levantan como dependencias, no como fuentes de inicialización de datos.

## Inicio sin Docker para Node

Con PostgreSQL, Redis y RabbitMQ disponibles según `.env`:

```bash
npm ci
npm run build
npm start
```

Los workers son procesos separados:

```bash
npm run start:outbox
npm run start:fanout
npm run start:cleanup
npm run start:rebuild
```

Datos de demostración:

```bash
npm run seed
```

El seed contratado invoca `pkg_lab_seed.generate_mock_data`; no inserta tablas desde Node.js.

## Verificación

```bash
npm run format:check
npm run lint
npm run typecheck
npm run build
npm run verify:database-policy
npm run test
npm run test:integration
```

`npm run test:all` ejecuta toda la suite Vitest. Las pruebas de integración requieren PostgreSQL, Redis y RabbitMQ activos. Consulte [docs/TESTING.md](docs/TESTING.md).

## Graphify

El grafo sólo es válido cuando analiza el árbol integrado:

```bash
graphify update .
```

Los entregables esperados son `graphify-out/graph.html`, `graphify-out/graph.json` y `graphify-out/GRAPH_REPORT.md`. El análisis y su estado actual están en [docs/GRAPH_ANALYSIS.md](docs/GRAPH_ANALYSIS.md).

## Archify

Las fuentes regenerables viven en `docs/architecture/src/`. Defina la instalación local de Archify y regenere cada HTML con el tipo indicado por el sufijo del archivo:

```bash
export ARCHIFY_DIR=/ruta/a/archify
node "$ARCHIFY_DIR/bin/archify.mjs" validate architecture docs/architecture/src/system-architecture.architecture.json --quality showcase --json
node "$ARCHIFY_DIR/bin/archify.mjs" deliver architecture docs/architecture/src/system-architecture.architecture.json docs/architecture/system-architecture.html --quality showcase --json
node "$ARCHIFY_DIR/bin/archify.mjs" visual-check docs/architecture/system-architecture.html --json
```

Repita con `sequence` para los cinco flujos de secuencia y con `workflow` para `multi-agent-git.workflow.json`. Cada HTML permite exportar el SVG canónico desde `Export → Download SVG`; los SVG versionados junto a los HTML corresponden a esa exportación. Archify conserva UI fija en inglés porque su locale nativo no incluye español; títulos, nodos y relaciones sí están escritos en español.

El [inventario de diagramas](docs/architecture/README.md) registra fuentes, tipos, hashes de HTML/SVG y evidencia browser de los siete entregables.

## Modelo Git

- `main`: releases validados.
- `develop`: integración activa.
- `agent/*`: propiedad aislada por especialidad.
- Un worktree por agente; nunca dos agentes en el mismo directorio.
- Conventional Commits incrementales y árbol limpio antes de entregar.
- Orden sugerido: contracts → database → infrastructure → users → posts → feed → workers → tests → docs.

Véanse [docs/GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md) y [docs/MULTI_AGENT.md](docs/MULTI_AGENT.md).

## Documentación

- [Diseño](docs/DESIGN.md)
- [Arquitectura](docs/ARCHITECTURE.md)
- [PostgreSQL](docs/DATABASE.md)
- [Redis](docs/REDIS.md)
- [RabbitMQ](docs/RABBITMQ.md)
- [Fan-out](docs/FANOUT.md)
- [Transactional outbox](docs/OUTBOX.md)
- [Workflow Git](docs/GIT_WORKFLOW.md)
- [Trabajo multiagente](docs/MULTI_AGENT.md)
- [Análisis Graphify](docs/GRAPH_ANALYSIS.md)
- [Pruebas](docs/TESTING.md)
