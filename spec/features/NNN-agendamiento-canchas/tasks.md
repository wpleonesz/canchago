# NNN · Agendamiento de canchas — Tareas

_Checklist para una implementación posterior. En esta tarea documental todo permanece pendiente._

## Preparación y compatibilidad

- [ ] **T01** Auditar migraciones aplicadas, motor PostgreSQL y datos reales de roles/scopes.
- [ ] **T02** Aprobar el contrato condicional de `organizationId` para usuarios globales/tenant.
- [ ] **T03** Planificar validaciones/servicio de usuario sin exigir organización al Futbolista.
- [ ] **T04** Planificar persistencia de scope derivada de cada rol y normalización segura de datos heredados.

## Persistencia y backend

- [ ] **T05** Cerrar la relación recurso→sede→organización y la guarda de scope del Gestor.
- [ ] **T06** Cerrar el modelo conceptual/físico mínimo del recurso reservable.
- [ ] **T07** Cerrar modelo, estados y transiciones de franjas.
- [ ] **T08** Cerrar modelo, estados y transiciones de reservas/cancelaciones.
- [ ] **T09** Cerrar contrato y persistencia de idempotencia.
- [ ] **T10** Diseñar/aprobar migración aditiva con FKs, índices y garantía anti-solapamiento.
- [ ] **T11** Crear schemas Zod para entradas, params, queries, paginación, intervalos y versiones.
- [ ] **T12** Implementar repositorios encapsulados y consultas sin N+1.
- [ ] **T13** Implementar servicios de recursos/disponibilidad con reglas, scope y auditoría.
- [ ] **T14** Implementar reserva/cancelación atómica con ownership, idempotencia y conflictos controlados.
- [ ] **T15** Registrar permisos/menús y asignarlos mínimamente a Futbolista/Gestor.
- [ ] **T16** Implementar API Routes con cadena real de middlewares y envelopes estándar.

## Documentación Swagger (obligatorio)

- [ ] **T17** Crear `documentation/schemas/<módulo>.ts` con schemas registrados vía `registry.registerComponent()`.
- [ ] Registrar cada endpoint con `registry.registerPath()`, seguridad, entradas, respuestas y ejemplos.
- [ ] Exportar el módulo desde `documentation/schemas/index.ts`.
- [ ] Verificar `/api/docs` y que OpenAPI coincida con el código real.

## Aplicación móvil

- [ ] **T18** Verificar el contrato implementado y actualizar `canchago-ionic/spec/constitution/api-integration.md`.
- [ ] **T19** Crear tipos TypeScript y validaciones Zod basados en el contrato real.
- [ ] **T20** Crear funciones en `src/services/api/endpoints/` sin HTTP disperso.
- [ ] **T21** Crear hooks TanStack Query con invalidación, paginación y retry seguro.
- [ ] **T22** Implementar gestión de franjas del Gestor con estados completos.
- [ ] **T23** Implementar catálogo, fecha/franjas, resumen y confirmación del Futbolista.
- [ ] **T24** Implementar Mis reservas, detalle y cancelación propia.
- [ ] **T25** Adaptar rutas, menú, guards y `UserForm` por permisos/scope real.

## Pruebas y validación

- [ ] **T26** Implementar P01–P30 con Vitest e integración PostgreSQL/HTTP donde corresponda.
- [ ] **T27** Implementar P31–P41 con Vitest, Testing Library, mocks API y Cypress donde esté disponible.
- [ ] Ejecutar P42–P46 de compatibilidad, OpenAPI e integración completa.
- [ ] Probar manipulación de todos los IDs y ownership/scope en backend.
- [ ] Probar intervalos inválidos, duplicados, adyacentes y toda forma de solapamiento.
- [ ] Probar concurrencia real con dos confirmaciones simultáneas.
- [ ] Probar claves idempotentes repetidas, divergentes y por usuarios distintos.
- [ ] Probar cancha/sede/organización inactiva, franja retirada y reserva cancelada.
- [ ] Probar en Ionic ausencia de canchas, ausencia de franjas, 401, 403, 409, red y doble toque.
- [ ] **T28** Backend: `yarn generate && yarn lint && yarn typecheck && yarn test && yarn build`.
- [ ] Móvil: `yarn lint && yarn typecheck && yarn test && yarn build && yarn cap:sync`.
- [ ] Ejecutar build/prueba Android/iOS disponible si la implementación toca `src/`.

## Cierre

- [ ] Validar uno a uno los criterios de aceptación de `spec.md`.
- [ ] Confirmar que no se creó afiliación administrativa al reservar.
- [ ] Confirmar que no existen regresiones atribuibles a la feature.
- [ ] **T29** Actualizar ambos roadmaps y el contrato móvil al completar, no durante esta propuesta.

