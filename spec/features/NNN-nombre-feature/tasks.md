# NNN · <Nombre de la feature> — Tareas

_Checklist accionable derivada del `plan.md`. Tareas pequeñas y concretas; marca `[x]` al completarlas._

- [ ] <Tarea concreta de implementación.>
- [ ] <Tarea concreta de implementación.>
- [ ] <Tarea de pruebas / validación.>

## Documentación Swagger (obligatorio)

_Debe completarse en paralelo con los endpoints, no como paso final._

- [ ] Crear `documentation/schemas/<módulo>.ts` con los schemas Zod de entrada y salida registrados vía `registry.registerComponent()`.
- [ ] Registrar cada endpoint del módulo con `registry.registerPath()` en el mismo archivo (método, path, tag, summary, security, requestBody, responses).
- [ ] Exportar el módulo desde `documentation/schemas/index.ts`.
- [ ] Verificar que todos los endpoints aparecen en `GET /api/docs` con schemas, ejemplos y códigos de respuesta correctos.

## Cierre

- [ ] Validar contra los criterios de aceptación de `spec.md`.
- [ ] Mover la feature a "Hecho" en `../../constitution/roadmap.md`.

## Mantenimiento (checklist recurrente)

_Opcional. Pasos a repetir cada vez que se toque esta feature en el futuro (revisar datos, regenerar algo, etc.). Borra esta sección si no aplica._

- [ ] <Acción recurrente.>
