# Redis

## Rol

Redis mantiene proyecciones de lectura. PostgreSQL conserva relaciones, posts y estado de eventos. Si Redis pierde datos, los workers pueden reconstruirlos mediante APIs `pkg_*`.

## Claves

| Patrón                  | Tipo       | Score              | Member   | Uso                                    |
| ----------------------- | ---------- | ------------------ | -------- | -------------------------------------- |
| `timeline:{userId}`     | Sorted Set | timestamp del post | `postId` | Feed precomputado de cuentas normales  |
| `author_posts:{userId}` | Sorted Set | timestamp del post | `postId` | Stream de autor usado para celebrities |

Los helpers contractuales son `redisKeys.timeline(userId)` y `redisKeys.authorPosts(userId)`.

## Escrituras

El Fanout Worker usa pipeline para añadir el mismo `postId` a followers y recorta entradas antiguas hasta `TIMELINE_MAX_ITEMS`. `ZADD` con `postId` estable vuelve idempotente una reentrega del mismo evento.

Para celebrities se actualiza `author_posts:{authorId}` sin empujar a millones de timelines. Follow/rebuild y unfollow/cleanup convergen de manera asíncrona.

## Lecturas

`TimelineRepository`, no el controller, encapsula `ZRANGE`/`ZREVRANGE` por score. `FeedService` hidrata IDs a través de repositorios PostgreSQL, valida visibilidad, deduplica y ordena. El cursor debe ser estable ante timestamps iguales; la implementación final debe documentar su desempate exacto.

## Fallos

- Un error Redis no autoriza a inventar datos ni degradar permisos de PostgreSQL.
- Readiness se marca degradado/no listo según la política integrada.
- Un consumer no ACKea hasta completar el efecto o decidir el flujo de retry/DLQ.
- Rebuild permite recuperar una proyección ausente o truncada.

## Límites

`TIMELINE_MAX_ITEMS` tiene default `1000` y debe ser entero positivo. `CELEBRITY_THRESHOLD` tiene default `100000`; tests usan `5` para cubrir ambos caminos con pocos usuarios.
