# RabbitMQ

## Topología

Exchange durable `newsfeed.events` de tipo `topic`.

| Routing key        | Consumidor principal | Efecto                                        |
| ------------------ | -------------------- | --------------------------------------------- |
| `post.created`     | `feed.fanout`        | Materializar post normal o stream celebrity   |
| `user.followed`    | flujo rebuild        | Incorporar historia visible al nuevo follower |
| `user.unfollowed`  | `feed.cleanup`       | Retirar posts del autor dejado de seguir      |
| `timeline.rebuild` | `feed.rebuild`       | Recomponer timeline desde fuente durable      |

Queues durables: `feed.fanout`, `feed.cleanup`, `feed.rebuild` y `feed.dlq`.

## Semántica de entrega

- Mensajes persistent.
- Publisher confirma publicación antes de `pkg_outbox.mark_published`.
- Consumers usan ACK manual.
- `RABBITMQ_PREFETCH` limita trabajo en vuelo.
- `RABBITMQ_MAX_RETRIES` limita reintentos; agotarlos enruta a `feed.dlq`.
- Conexiones y channels se recuperan sin crear topología divergente.

## Idempotencia

RabbitMQ ofrece entrega potencialmente repetida. Antes del efecto, el consumer usa `pkg_outbox.try_process_event(eventId, consumer)` o una operación equivalente respaldada por `processed_events`. Una segunda entrega se confirma sin repetir el efecto de negocio. En Redis, `postId` como miembro refuerza esa propiedad.

## Manejo de fallos

Un error recuperable se reintenta con metadatos acotados. Un mensaje venenoso termina en DLQ con suficiente contexto para diagnóstico, sin bucle infinito. Nunca se ACKea un fallo como éxito silencioso. El cierre ordenado deja de consumir, espera trabajo en curso según el timeout del proceso, cierra channels y después la conexión.

## Observabilidad mínima

Registrar `eventId`, `eventType`, routing key, queue, retry count, outcome y duración. No registrar credenciales ni payload sensible completo. Readiness debe distinguir conexión disponible de topología utilizable.
