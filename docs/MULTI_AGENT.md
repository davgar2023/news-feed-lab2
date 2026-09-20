# Desarrollo multiagente

## Contrato de coordinación

Wave 0 congela interfaces, nombres de rutinas, eventos, topología, claves y entorno en `contracts-v1`. Wave 1 permite implementación paralela sin reescribir esos contratos. Un cambio contractual posterior requiere coordinación explícita y actualización conjunta de consumidores, pruebas y documentación.

## Propiedad

| Agente         | Propiedad primaria                                                |
| -------------- | ----------------------------------------------------------------- |
| Database       | `database/**`                                                     |
| Infrastructure | `src/infrastructure/**`, `src/config/**`, `docker/**`, `nginx/**` |
| Users          | `src/modules/users/**`                                            |
| Posts          | `src/modules/posts/**`                                            |
| Feed           | `src/modules/feed/**`                                             |
| Workers        | `src/workers/**`                                                  |
| Testing        | `tests/**`, `scripts/verify/**`                                   |
| Documentation  | `docs/**`, `README.md`                                            |

Los archivos compartidos se cambian sólo cuando el responsable de integración puede evaluar todos sus consumidores.

## Protocolo de entrega

Cada agente:

1. confirma branch y worktree;
2. inspecciona contratos congelados;
3. implementa sólo su propiedad;
4. ejecuta format, lint, typecheck, pruebas y checks relevantes;
5. crea commits Conventional Commits lógicos;
6. entrega hash, comandos ejecutados, resultados y riesgos observables;
7. termina con working tree limpio.

## Protocolo de integración

El Integration Agent revisa diffs, fusiona por dependencia y corrige incompatibilidades en una rama de integración. No acepta como cierre la mención de trabajo faltante de otro agente: inspecciona, corrige, prueba y versiona cualquier dependencia necesaria para completar el resultado.

## Prevención de conflictos

- No compartir directorio entre agentes.
- No modificar contratos congelados desde ramas de feature.
- No reformatear archivos fuera del alcance.
- No reescribir historial ajeno.
- Comunicar cambios de nombres antes de integrar.
- Regenerar artefactos derivados desde el árbol final, no copiarlos desde un branch desactualizado.

## Evidencia cruzada

Graphify responde qué se construyó; Archify comunica ese resultado. El gate de deriva coteja ambos. Si un worker, queue, key, schema o dependencia no aparece en código, el diagrama se corrige o la implementación se completa antes del release.
