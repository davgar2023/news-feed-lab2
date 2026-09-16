# Estrategia de pruebas

## Capas

- Unitarias: servicios, validadores, repositories con doubles y algoritmos de merge/paginación.
- Integración PostgreSQL: migraciones, rutinas, transacciones, constraints y permisos reales.
- Integración Redis/RabbitMQ: topología, retries, DLQ, idempotencia y proyecciones.
- API: rutas, errores, health/readiness y graceful shutdown.
- Arquitectura: scanner de SQL, unicidad de pool y drift Graphify/Archify.

## Matriz mínima

| Área           | Casos obligatorios                                           |
| -------------- | ------------------------------------------------------------ |
| Users          | create/get, follow/unfollow, self-follow, duplicate follow   |
| Posts          | create/get/by user/delete, atomicidad post + outbox          |
| Feed normal    | fan-out, DESC, pagination, empty, non-followed excluded      |
| Feed celebrity | fan-out on read, merge híbrido, dedupe, umbral de prueba `5` |
| Unfollow       | filtrado inmediato en lectura y cleanup eventual             |
| RabbitMQ       | retry, DLQ, duplicate delivery, manual ACK                   |
| Idempotencia   | `processed_events`, mismo `postId` en ZSET                   |
| Fallos         | Redis unavailable, PostgreSQL recovery, RabbitMQ recovery    |
| Database       | pool shutdown, roles, package-only scanner                   |
| Seed           | 10 users, 50 posts, follows, un celebrity                    |

## Seguridad de base de datos

La suite debe conectarse con ambos roles. Como `newsfeed_app`, un `SELECT` directo sobre `public.users` falla por permiso; ejecutar `pkg_users.get_user` funciona. El test no se reemplaza con mocks porque verifica grants reales.

## Comandos

```bash
npm run format:check
npm run lint
npm run typecheck
npm run build
npm run verify:database-policy
npm run test
npm run test:integration
```

CI ejecuta `npm ci` antes de esos gates. `npm run test:all` sirve para reproducir toda la suite localmente.

## Datos y aislamiento

`npm run seed` llama `pkg_lab_seed.generate_mock_data`; Node no ejecuta inserts. Cada test integra estado conocido, no depende del orden de otros tests y limpia mediante una API de owner aprobada. El umbral `CELEBRITY_THRESHOLD=5` permite ejercitar ambos modos con diez usuarios.

## Criterios de éxito

- No quedan handles abiertos de pool, Redis o RabbitMQ.
- Los resultados son deterministas con timestamps iguales.
- Los retries son acotados y observables.
- Una reentrega produce exactamente el mismo estado materializado.
- Todos los comandos retornan exit code cero en el árbol integrado.
- `git status --short` queda vacío después de generar artefactos versionados.
