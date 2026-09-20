# PostgreSQL

## Roles y permisos

`newsfeed_owner` posee tablas, índices, schemas y rutinas. `newsfeed_app` es el rol del runtime y recibe `USAGE`/`EXECUTE` únicamente sobre schemas aprobados. Debe carecer de `SELECT`, `INSERT`, `UPDATE`, `DELETE` y `TRUNCATE` directos sobre tablas de negocio.

Las pruebas de permisos deben demostrar simultáneamente:

1. `SELECT` directo de `users` como `newsfeed_app` falla.
2. `pkg_users.get_user(...)` como `newsfeed_app` funciona.

## Modelo 3NF contratado

| Tabla              | Responsabilidad           | Restricciones principales                                       |
| ------------------ | ------------------------- | --------------------------------------------------------------- |
| `users`            | Identidad local           | PK, username UNIQUE, timestamps                                 |
| `posts`            | Contenido por autor       | PK, FK author, contenido no vacío, timestamps                   |
| `follows`          | Relación dirigida         | FK doble, UNIQUE follower/followed, rechazo de self-follow      |
| `outbox_events`    | Eventos por publicar      | PK event_id, tipo, aggregate, JSONB, status, retry y timestamps |
| `processed_events` | Idempotencia por consumer | identidad de evento + consumer única                            |

Índices requeridos: username; posts por `(author_id, created_at)`; follows por follower y followed; outbox pendiente; processed event lookup.

## API pública

### `pkg_users`

`create_user`, `get_user`, `follow_user`, `unfollow_user`, `get_followers`, `get_following`, `count_followers`, `is_following`, `get_celebrity_following`.

### `pkg_posts`

`create_post`, `get_post`, `get_user_posts`, `get_recent_posts`, `delete_post`.

### `pkg_feed`

`validate_feed_items`.

### `pkg_outbox`

`get_pending_events`, `mark_published`, `mark_failed`, `try_process_event`.

### `pkg_lab_seed`

`generate_mock_data`.

## `SECURITY DEFINER`

Una rutina que eleva privilegios debe fijar un `search_path` seguro y referenciar objetos sensibles con schema explícito. No debe resolver objetos usando el `search_path` controlado por el caller. Los grants se aplican a rutinas concretas o al schema aprobado, nunca a tablas subyacentes.

## Abstracción `Database`

Responsabilidades contratadas:

- `initializePool()` y `getPool()` gestionan un solo pool por proceso.
- `withClient()` acota checkout/release.
- `callFunction()` y `callProcedure()` validan contra la allowlist.
- `transaction()` controla begin/commit/rollback.
- `healthCheck()` alimenta readiness.
- `closePool()` permite graceful shutdown.

Un repository no guarda SQL arbitrario. La única composición permitida es la invocación parametrizada que `Database` genera para una rutina aprobada.

## Verificación automática

`npm run verify:database-policy` escanea TypeScript de runtime y falla ante DML directo sobre tablas de negocio o ante instancias de `new Pool()` fuera de infraestructura. Las migraciones SQL son código de owner y no se confunden con runtime.
