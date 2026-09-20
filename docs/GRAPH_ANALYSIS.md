# Análisis Graphify

## Snapshot final analizado

| Campo                    | Valor                                                                       |
| ------------------------ | --------------------------------------------------------------------------- |
| Rama                     | `develop`                                                                   |
| Commit base del análisis | `7bab18d`                                                                   |
| Graphify                 | `0.9.56`                                                                    |
| Corpus                   | 104 archivos, ~26,416 palabras                                              |
| Grafo                    | 705 nodos, 1,555 relaciones, 31 comunidades                                 |
| Incremento desde Wave 0  | 568 nodos y 1,407 relaciones                                                |
| Salud                    | 0 endpoints faltantes, 0 dangling edges, 0 self-loops, 0 colapsos dirigidos |

Los artefactos reproducibles están en `graphify-out/graph.json`,
`graphify-out/graph.html` y `graphify-out/GRAPH_REPORT.md`. Los HTML, SVG y PNG
generados por Archify se excluyen del corpus mediante `.graphifyignore`; sus fuentes
JSON y el inventario Markdown siguen formando parte de la revisión de deriva.

## Dependencias y capas

- Los controllers importan servicios o contratos HTTP; no importan `pg`, `ioredis` ni
  `amqplib`.
- Los repositories de Users, Posts, Feed y Outbox convergen en `Database` y en la
  allowlist `DATABASE_ROUTINES`.
- `Database.ts` es el único módulo que construye `SELECT * FROM pkg_*` y `CALL pkg_*`;
  el scanner AST confirma que no existe SQL de tablas de negocio en runtime.
- `TimelineRepository` es la frontera entre Feed y `RedisService`. El path Graphify
  `FeedController <- feed.routes.ts <- feed/index.ts -> TimelineRepository.ts -> RedisService`
  muestra que Redis no llega al controller.
- `OutboxPublisher <- outboxPublisher.ts -> RabbitMQConnection` confirma que la
  publicación asíncrona vive en el worker y no en el endpoint de Posts.

## Rutas críticas

### Creación y fan-out

`PostController -> PostService -> PostRepository -> Database ->
pkg_posts.create_post()` persiste post y evento de outbox en una única función SQL.
`OutboxPublisher -> RabbitMQConnection -> FanoutWorker -> UserRepository ->
pkg_users.get_followers() -> RedisService.fanOutPost()` materializa timelines para
autores normales. Las celebridades escriben en `author_posts:{userId}`.

### Timeline híbrido

`FeedController -> FeedService -> TimelineRepository/FeedRepository` combina
`timeline:{userId}` con posts recientes de cuentas celebridad. Antes de responder,
`pkg_feed.validate_feed_items()` elimina posts borrados o ya no autorizados; el
servicio deduplica, ordena descendente y pagina con cursor compuesto estable.

### Follow y unfollow

`UserController -> UserService -> UserRepository -> pkg_users.follow_user()` y
`pkg_users.unfollow_user()` generan eventos en la misma transacción. Rebuild y
Cleanup consumen esos eventos, son idempotentes mediante `processed_events` y
actualizan únicamente proyecciones Redis reconstruibles.

## Centralidad y acoplamiento

Los nodos con mayor conectividad son `User` (43), `Post` (38),
`RedisService` (32), `RabbitMQConnection` (31), `database` (22),
`vitest` (20), `loadConfig()` (19) y `RoutineExecutor` (19). La centralidad de
los modelos refleja su uso transversal en contratos y pruebas; la de los adaptadores es esperada en
adaptadores de infraestructura y fronteras de persistencia; ninguno mezcla lógica
HTTP, SQL de negocio y mensajería en el mismo módulo.

Graphify no detectó ciclos de imports. El análisis SCC encontró tres ciclos internos
de dos métodos dentro de `RabbitMQConnection`: `connect/scheduleReconnect`,
`publish/publishBuffer` y `consume/startConsumer`. Son bucles operativos de
reconexión/configuración dentro de un único adaptador, no dependencias circulares
entre módulos.

## Conexiones semánticas

La extracción documental confirmó tres relaciones que también están implementadas:

- acceso mediante rutinas es equivalente al API de paquetes PostgreSQL;
- post y evento se escriben atómicamente mediante el outbox;
- las proyecciones Redis son reconstruibles porque PostgreSQL es la fuente de verdad.

Los hyperedges de Graphify agrupan correctamente el flujo durable de eventos, el
timeline híbrido y la evidencia de release multiagente.

## Architecture drift gate

| Elemento documentado              | Evidencia de código/grafo                          | Diagrama                                      | Estado |
| --------------------------------- | -------------------------------------------------- | --------------------------------------------- | ------ |
| `users`, `posts`, `feed`          | `src/modules/*` y comunidades Users/Post/Feed      | `system-architecture`                         | PASS   |
| `Database` y `pkg_*`              | `Database.ts`, migraciones 003–006                 | `system-architecture`, `post-created-flow`    | PASS   |
| Outbox Publisher                  | `src/workers/outboxPublisher.ts`                   | `transactional-outbox`                        | PASS   |
| Fanout/Cleanup/Rebuild            | `src/workers/*Worker.ts`                           | `fanout-write`, `follow-unfollow`             | PASS   |
| `newsfeed.events` y cuatro queues | contratos + `RabbitMQConnection.configureTopology` | `system-architecture`, `transactional-outbox` | PASS   |
| `timeline:*` y `author_posts:*`   | `redisKeys`, `RedisService`                        | `fanout-write`, `hybrid-feed`                 | PASS   |
| Feed híbrido                      | `FeedService.timeline()`                           | `hybrid-feed`                                 | PASS   |
| Git branches/worktrees            | historial Git y `git worktree list`                | `multi-agent-git`                             | PASS   |

No se observó deriva arquitectónica que requiera cambiar código o diagramas.
