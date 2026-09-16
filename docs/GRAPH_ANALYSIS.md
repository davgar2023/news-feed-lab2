# Análisis Graphify

## Snapshot analizado

| Campo                      | Valor verificable en esta rama                     |
| -------------------------- | -------------------------------------------------- |
| Rama                       | `agent/docs`                                       |
| Base                       | `16ef739` (`contracts-v1`)                         |
| Contenido disponible       | contratos TypeScript, configuración y metadata npm |
| `graphify-out/`            | ausente en este snapshot                           |
| Alcance del análisis final | árbol integrado de `develop`                       |

No se atribuyen ciclos, god modules ni caminos runtime a un grafo que todavía no existe en esta rama. Esta estructura se actualiza después de generar Graphify sobre el árbol integrado.

## Hallazgos factuales del snapshot

- `src/contracts/index.ts` reexporta `database`, `events`, `http`, `models`, `repositories` y `topology`.
- `repositories.ts` depende sólo de tipos de `events.ts` y `models.ts`.
- `src/config/env.ts` depende de Zod y define todos los parámetros de PostgreSQL, Redis, RabbitMQ, fan-out y proxy.
- No hay controllers, services, repositories concretos, workers ni infraestructura para trazar en este branch.
- No hay SQL para verificar calls contra cuerpos de rutinas en este branch.

## Consultas obligatorias post-integración

| Pregunta                                       | Evidencia Graphify requerida          | Resultado                    |
| ---------------------------------------------- | ------------------------------------- | ---------------------------- |
| ¿Hay ciclos entre módulos?                     | SCC/cycle report                      | Sin evaluar en este snapshot |
| ¿Se respeta controller → service → repository? | paths desde routes/controllers        | Sin evaluar en este snapshot |
| ¿Todo acceso PostgreSQL pasa por `Database`?   | callers de pool/query y rutinas       | Sin evaluar en este snapshot |
| ¿Quién publica a RabbitMQ?                     | path desde outbox publisher           | Sin evaluar en este snapshot |
| ¿Quién consume cada queue?                     | bindings/call paths de workers        | Sin evaluar en este snapshot |
| ¿Redis queda detrás de repositories/services?  | callers de `ioredis`                  | Sin evaluar en este snapshot |
| ¿Existen god modules?                          | centralidad, tamaño y fan-in/fan-out  | Sin evaluar en este snapshot |
| ¿Fanout usa `pkg_users.get_followers`?         | path event → worker → routine → Redis | Sin evaluar en este snapshot |
| ¿Timeline implementa merge híbrido?            | path HTTP → FeedService → Redis/pkg_* | Sin evaluar en este snapshot |

## Procedimiento de actualización

```bash
graphify update .
```

Después:

1. registrar commit exacto y versión de Graphify;
2. confirmar `graph.html`, `graph.json` y `GRAPH_REPORT.md`;
3. ejecutar consultas de la tabla anterior;
4. enlazar nodos/paths concretos y describir sólo resultados observados;
5. corregir acoplamientos o ciclos indeseados;
6. regenerar el grafo tras cada corrección;
7. comparar el grafo final con los JSON Archify y registrar PASS/FAIL del drift gate.

## Registro final de deriva

La integración debe completar una fila por elemento: módulos `users/posts/feed`, `Database`, schemas `pkg_*`, Outbox Publisher, workers, exchange/queues, routing keys y claves Redis. Cada fila debe indicar evidencia de código, evidencia de grafo, diagrama correspondiente y veredicto.
