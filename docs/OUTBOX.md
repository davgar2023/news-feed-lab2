# Transactional Outbox

![Transactional outbox](architecture/transactional-outbox.svg)

## Problema

Guardar el post y publicar a RabbitMQ como dos escrituras independientes permite estados imposibles: post sin evento o evento sin post. La outbox mueve ambas escrituras durables a una sola transacción PostgreSQL.

## Escritura

`pkg_posts.create_post(authorId, content)`:

1. inicia o participa en una transacción;
2. inserta el post;
3. inserta `post.created` en `outbox_events` con status pendiente;
4. confirma ambos cambios o revierte ambos.

Campos contratados: `event_id`, `event_type`, `aggregate_type`, `aggregate_id`, `payload JSONB`, `status`, `retry_count`, `created_at`, `published_at`, `last_error`.

## Publicación

El Outbox Publisher ejecuta en intervalo `OUTBOX_POLL_INTERVAL_MS`:

1. `pkg_outbox.get_pending_events(limit)`;
2. publicación persistent a `newsfeed.events` con routing key igual al event type;
3. confirmación del broker;
4. `pkg_outbox.mark_published(eventId)` tras éxito;
5. `pkg_outbox.mark_failed(eventId, error)` tras fallo.

El publisher no consulta ni actualiza `outbox_events` directamente.

## Concurrencia

La rutina de pendientes debe evitar que dos publishers reclamen el mismo lote, por ejemplo mediante locks de fila con skip locked o un mecanismo equivalente verificable. La decisión concreta pertenece a la migración integrada y debe preservarse en pruebas.

## Reintento e idempotencia

`retry_count` y `last_error` permiten reintentos observables. Publicar puede haber funcionado aunque se pierda la confirmación, por lo que los consumers siempre deben tolerar duplicados. `event_id` no cambia entre intentos.

## Pruebas esenciales

- rollback no deja ni post ni evento;
- commit deja ambos;
- evento pendiente se publica y marca;
- fallo incrementa retry y conserva error;
- publisher duplicado no produce efecto de negocio duplicado;
- runtime accede exclusivamente por `pkg_outbox`.
