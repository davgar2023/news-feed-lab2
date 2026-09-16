# Fan-out

## Fan-out on write

![Fan-out on write](architecture/fanout-write.svg)

Para una cuenta normal, `post.created` llega a `feed.fanout`. El worker obtiene followers mediante `pkg_users.get_followers(authorId)`, no desde `follows`, y usa pipeline Redis para `ZADD timeline:{followerId}` con score timestamp y member `postId`. Después recorta a `TIMELINE_MAX_ITEMS`.

Ventaja: lectura rápida. Coste: escrituras proporcionales al número de followers.

## Fan-out on read

Para una cuenta celebrity, el worker actualiza `author_posts:{celebrityId}`. No escribe el post en cada follower. `CELEBRITY_THRESHOLD` decide la estrategia a partir del conteo durable de followers.

Ventaja: escritura acotada. Coste: la lectura debe consultar y combinar streams adicionales.

## Feed híbrido

![Feed híbrido](architecture/hybrid-feed.svg)

Algoritmo contratado:

1. Leer IDs normales desde `timeline:{userId}`.
2. Obtener celebrities seguidos mediante `pkg_users.get_celebrity_following`.
3. Leer cada `author_posts:{celebrityId}` y/o posts recientes por API `pkg_posts`.
4. Hidratar y validar candidatos mediante `pkg_feed.validate_feed_items`.
5. Excluir autores no seguidos y posts eliminados.
6. Deduplicar por `postId`.
7. Ordenar por timestamp DESC con desempate estable.
8. Aplicar Top N y devolver `TimelinePage.nextCursor`.

## Follow y unfollow

![Follow y unfollow](architecture/follow-unfollow.svg)

`follow_user` rechaza self-follow y duplicados. Su evento programa rebuild. `unfollow_user` elimina la relación y su evento programa cleanup. Como la proyección es eventual, la lectura valida elementos contra PostgreSQL para impedir que un post obsoleto sobreviva en la respuesta.

## Condiciones límite

- Timeline vacía devuelve página vacía y cursor nulo.
- Reentrega de evento no duplica `postId`.
- Posts con igual timestamp conservan orden determinista.
- Una falla parcial de pipeline no se confirma antes de completar/reintentar el lote.
- Cambiar el umbral no reclasifica correctamente contenido histórico sin rebuild; la operación final debe incluir ese camino.
