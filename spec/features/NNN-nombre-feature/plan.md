# NNN · <Nombre de la feature> — Plan

_Cómo se implementa lo descrito en `spec.md`. Debe respetar la `constitution/`._

## Enfoque

<Estrategia general en pocas frases: qué aproximación se toma y por qué encaja con el stack y los principios del proyecto.>

## Implementación

_Pasos técnicos concretos, en orden. Indica los archivos/módulos que se tocan._

1. <Paso — archivo/módulo afectado.>
2. <Paso — archivo/módulo afectado.>
3. <Paso — archivo/módulo afectado.>

N. **`documentation/schemas/<módulo>.ts`** — Registra con `registry.registerComponent()` los schemas Zod de entrada y salida del módulo, y con `registry.registerPath()` cada endpoint (método, path, tags, summary, request body, responses). Exportar desde `documentation/schemas/index.ts`.

> El archivo de documentación debe crearse en el mismo paso que el endpoint al que corresponde, no al final.

## Decisiones

_Elecciones de diseño relevantes y su justificación. Alternativas descartadas y por qué._

- **<Decisión>** — <por qué; qué se descartó>.
- **<Decisión>** — <por qué; qué se descartó>.

## Riesgos

_Qué puede salir mal o requerir cuidado, y cómo se mitiga._

- **<Riesgo>** — <mitigación>.
