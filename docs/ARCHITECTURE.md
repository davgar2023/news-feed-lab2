# Arquitectura

## Vista del sistema

![Arquitectura](architecture/system-architecture.svg)

El proceso HTTP y los workers comparten contratos, infraestructura y acceso encapsulado a PostgreSQL, pero se ejecutan como procesos independientes. Esto no constituye microservicios: no hay propiedad de datos separada ni APIs remotas entre módulos.

## Capas síncronas

```text
Client → Nginx → Controller → Service → Repository → Database → pkg_* → PostgreSQL
```

- `Controller`: HTTP, validación de entrada y códigos de respuesta.
- `Service`: reglas y orquestación de caso de uso.
- `Repository`: adapta contratos de dominio a infraestructura.
- `Database`: único `pg.Pool`, allowlist de rutinas, transacciones, health y cierre.
- `pkg_*`: API pública de PostgreSQL; tablas quedan privadas para `newsfeed_app`.

## Camino de creación

![Creación de post](architecture/post-created-flow.svg)

`POST /api/posts` termina cuando PostgreSQL confirma post y evento outbox. La propagación a followers es posterior. Esta separación evita que la latencia o caída de RabbitMQ invalide una escritura ya durable.

## Camino asíncrono

```text
outbox_events
  → Outbox Publisher
  → exchange newsfeed.events
  → feed.fanout | feed.cleanup | feed.rebuild
  → Fanout/Cleanup/Rebuild Worker
  → timeline:{userId} | author_posts:{userId}
```

La cola `feed.dlq` concentra entregas que agotaron `RABBITMQ_MAX_RETRIES`. Los consumers usan prefetch, ACK manual, recuperación de conexión e idempotencia.

## Topología contractual

| Elemento               | Identificador                                                          |
| ---------------------- | ---------------------------------------------------------------------- |
| Exchange topic durable | `newsfeed.events`                                                      |
| Fanout queue           | `feed.fanout`                                                          |
| Cleanup queue          | `feed.cleanup`                                                         |
| Rebuild queue          | `feed.rebuild`                                                         |
| Dead-letter queue      | `feed.dlq`                                                             |
| Routing keys           | `post.created`, `user.followed`, `user.unfollowed`, `timeline.rebuild` |
| Timeline               | `timeline:{userId}`                                                    |
| Stream de autor        | `author_posts:{userId}`                                                |

## Disponibilidad y cierre

`GET /health` comunica estado del proceso. `GET /health/ready` evalúa PostgreSQL, Redis y RabbitMQ requeridos para operación normal. Ante `SIGTERM` o `SIGINT` el orden contratado es: dejar de aceptar HTTP, detener consumers/channels, cerrar conexión RabbitMQ, cerrar Redis y cerrar `pg.Pool`.

## Estado verificable

En la revisión de `contracts-v1` existen:

- contratos de repositorio para users, posts y outbox;
- tipos `User`, `Post`, `TimelinePage` y `DomainEvent`;
- nombres de rutinas aprobadas;
- topología RabbitMQ y constructores de claves Redis;
- schema Zod de entorno.

Los controllers, services, repositories concretos, workers, migraciones y Docker no están en esta rama base. El Integration Agent debe actualizar la evidencia después de los merges sin alterar nombres contratados de forma silenciosa.
