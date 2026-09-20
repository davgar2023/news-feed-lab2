# Diagramas Archify

Esta carpeta conserva tres formas de cada diagrama:

- `src/*.json`: especificación regenerable y fuente de verdad visual.
- `*.html`: Viewer Archify autocontenido, interactivo y validado.
- `*.svg`: exportación vectorial canónica realizada por `Export → SVG` desde el Viewer entregado.

Los archivos `*.visual-check.json`, `*.visual-check.html` y `*.visual-check.*.png` son evidencia automatizada ligada por SHA-256 al HTML exacto que se inspeccionó. No sustituyen la validación determinística ni la revisión perceptual.

## Inventario y recibos

| Diagrama                      | Tipo           | Fuente                                      | HTML SHA-256                                                       | SVG SHA-256                                                        | Showcase                   | Browser |
| ----------------------------- | -------------- | ------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ | -------------------------- | ------- |
| System Architecture           | `architecture` | `src/system-architecture.architecture.json` | `af69613b1edbe85c751007c59c435c499cab1bf35e107109fd84ae7f256301e3` | `1af4177f5afe990d750b90b570ec0a070512385126da4f922b4b650c48e37b34` | 9/9, 0 errores, 0 warnings | PASS    |
| Post Creation Workflow        | `sequence`     | `src/post-created-flow.sequence.json`       | `2a5dd9cecff79232e79d6eb9c21a5213196d92d6fc763d80bf2286810d87bb1b` | `94c43d1d44cbe1591af5e360b710e8de23c6adfedf8e6c0409f81e17fc207a1f` | 9/9, 0 errores, 0 warnings | PASS    |
| Fan-Out on Write Workflow     | `sequence`     | `src/fanout-write.sequence.json`            | `8c4dcd88499486c9553132a4c89cb81fe11151a73548081b42c6525e3114f16a` | `31b93142d3208e0d8ac7834643bb9752c5fec6cb16a2134d425f137d3cd325e8` | 9/9, 0 errores, 0 warnings | PASS    |
| Hybrid Timeline Workflow      | `sequence`     | `src/hybrid-feed.sequence.json`             | `2bbfaccc2eca8b3a44bdf0329542c198868916b99873f0218d41674a7136916f` | `f0625f460d054661ce7c63bf077e6530fae25d6181d8501a28869e781ec5d4e7` | 9/9, 0 errores, 0 warnings | PASS    |
| Follow/Unfollow Workflow      | `sequence`     | `src/follow-unfollow.sequence.json`         | `891b7e610d65c09bc93fabf6709bccef04c9c2c6eecf292cab2f33c30618e9a0` | `7c77198aa36b90bddcf60746ad8d54d2ef95a60545edd1ece28f4cdabf013556` | 9/9, 0 errores, 0 warnings | PASS    |
| Transactional Outbox Workflow | `sequence`     | `src/transactional-outbox.sequence.json`    | `cdcb89b2df295c3e982c82ab98594cbe1b47e41152389f6bf31841a92a1c8aa3` | `3e4d6b9cb9728cb6f0ee6ea465f68a9826201fe66023850255909b15c16f7c17` | 9/9, 0 errores, 0 warnings | PASS    |
| Multi-Agent Git Workflow      | `workflow` v2  | `src/multi-agent-git.workflow.json`         | `7157533b0c2c30bb44010b04b7aff638134ab1789e30b1dd415db707e6ca1f80` | `9eac63472cc9aa48265728d61a24cc8bf0f40b5c8479faec6ba7152dc87243c7` | 9/9, 0 errores, 0 warnings | PASS    |

La evidencia browser cubre contención y legibilidad en 1440×900, 1600×1000, 1920×1080 y 2048×1320, más capturas light/dark en los tamaños extremos. La revisión perceptual de esas capturas resultó PASS para los siete diagramas.

## Regeneración

Ejecute `validate` después de cambiar una fuente, `deliver` una sola vez cuando quede congelada y `visual-check` únicamente después de una entrega exitosa:

```bash
export ARCHIFY_DIR=/ruta/a/archify

node "$ARCHIFY_DIR/bin/archify.mjs" validate architecture src/system-architecture.architecture.json --quality showcase --json
node "$ARCHIFY_DIR/bin/archify.mjs" deliver architecture src/system-architecture.architecture.json system-architecture.html --quality showcase --json
node "$ARCHIFY_DIR/bin/archify.mjs" visual-check system-architecture.html --json
```

Los demás tipos son `sequence` para los cinco archivos `*.sequence.json` y `workflow` para `multi-agent-git.workflow.json`. Abra el HTML ya entregado y use `Export → SVG` para renovar el vector; no extraiga ni modifique manualmente el SVG embebido.

Archify no ofrece locale español para la UI fija del Viewer: esa interfaz y `<html lang>` usan el fallback inglés. El contenido autoral permanece en español y los identificadores técnicos conservan su nombre exacto.
