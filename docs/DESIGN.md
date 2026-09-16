# Diseño

## Alcance y estado

El sistema se diseña como monolito modular con tres módulos de negocio (`users`, `posts`, `feed`) y cuatro procesos independientes (`outbox`, `fanout`, `cleanup`, `rebuild`). En `contracts-v1` están implementados los contratos TypeScript; los cuerpos de módulos, infraestructura y SQL se incorporan por ramas separadas y deben verificarse en el árbol integrado.

## Decisiones

### PostgreSQL como fuente de verdad

Usuarios, posts, follows y estado de eventos viven en PostgreSQL. Redis se trata como una proyección descartable. Esto hace posible recuperar timelines sin convertir el caché en autoridad sobre visibilidad o relaciones.

### API de base de datos por paquetes

PostgreSQL no tiene `PACKAGE`, así que los límites se representan con schemas:

- `pkg_users`
- `pkg_posts`
- `pkg_feed`
- `pkg_outbox`
- `pkg_lab_seed`

`Database.callFunction` y `Database.callProcedure` forman el único punto de ejecución desde runtime. La allowlist contractual está en `DATABASE_ROUTINES` y `APPROVED_DATABASE_SCHEMAS`.

### Outbox transaccional

`pkg_posts.create_post` debe escribir `posts` y `outbox_events` dentro de la misma transacción. RabbitMQ no participa en ese commit. Un publisher posterior obtiene eventos pendientes mediante `pkg_outbox.get_pending_events`, publica y confirma el resultado con `mark_published` o `mark_failed`.

### Feed híbrido

La escritura masiva sólo es eficiente para autores normales. Un autor cuyo conteo alcanza `CELEBRITY_THRESHOLD` conserva sus posts en `author_posts:{userId}`. Al leer, `FeedService` combina la timeline normal con streams celebrity, deduplica, ordena por timestamp descendente y aplica límite/paginación.

### Entrega al menos una vez

RabbitMQ puede repetir mensajes. `processed_events` y `pkg_outbox.try_process_event` establecen idempotencia de consumidores; usar `postId` como miembro ZSET vuelve repetible `ZADD` sin duplicar entradas.

### Consistencia de follow/unfollow

La relación se confirma en PostgreSQL antes de proyectarse. `user.followed` inicia rebuild; `user.unfollowed` inicia cleanup. La lectura final debe validar visibilidad para que una proyección atrasada no exponga posts de un autor ya no seguido.

## Invariantes

1. Un controller no conoce `pg`, `ioredis` ni `amqplib`.
2. Un service no crea pools ni compone SQL de negocio.
3. Un repository SQL sólo invoca rutinas a través de `Database`.
4. Sólo `src/infrastructure/database/Database.ts` instancia `pg.Pool`.
5. Un ACK RabbitMQ ocurre después de un efecto idempotente exitoso.
6. La pérdida de Redis degrada rendimiento o disponibilidad del feed, nunca la verdad durable.
7. La creación de post nunca publica directamente desde HTTP.

## Trade-offs

| Decisión          | Beneficio                                    | Coste controlado                                  |
| ----------------- | -------------------------------------------- | ------------------------------------------------- |
| Routines-only     | Menor superficie SQL y permisos verificables | Más migraciones y versionado de APIs SQL          |
| Fan-out híbrido   | Escrituras acotadas para celebrities         | Lectura y paginación más complejas                |
| Outbox            | Evita dual write post/broker                 | Consistencia eventual y publisher adicional       |
| Monolito modular  | Transacciones y despliegue simples           | Disciplina estricta de dependencias internas      |
| Workers separados | Escalado asíncrono independiente             | Shutdown, reconexión y observabilidad por proceso |

## Criterio de deriva

Los diagramas representan contratos, no prueban la implementación. El gate final compara nombres y caminos contra Graphify y el código integrado: módulos, workers, queues, routing keys, Redis keys y schemas documentados deben existir con los mismos identificadores.
