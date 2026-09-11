# 022 · Reservas para futbolistas y alcance de gestores — Tareas

- [ ] Auditar datos reales de roles y alcances heredados antes de diseñar la migración.
- [ ] Corregir contrato, validación, servicio y persistencia del CRUD administrativo de usuarios.
- [ ] Añadir pruebas de Futbolista global sin organización y Gestor con alcance obligatorio.
- [ ] Definir modelos/enums/índices/relaciones del dominio y generar una migración aditiva.
- [ ] Implementar y probar la garantía PostgreSQL contra solapamientos concurrentes.
- [ ] Implementar validaciones Zod de recursos, disponibilidad y reservas.
- [ ] Implementar repositorios de recursos y reservas.
- [ ] Implementar servicios de negocio con ownership y scope multi-tenant.
- [ ] Implementar endpoints públicos autenticados del Futbolista y administrativos del Gestor.
- [ ] Sembrar y auditar los permisos nuevos contra cada `access(...)` real.
- [ ] Cubrir loading/error contractual vía respuestas consistentes, incluidos 403, 404, 409 y 422.
- [ ] Ejecutar pruebas unitarias e integración HTTP/PostgreSQL, incluida concurrencia real.
- [ ] Ejecutar `yarn generate`, `yarn lint`, `yarn typecheck`, `yarn test` y `yarn build`.

## Documentación Swagger (obligatorio)

- [ ] Crear `documentation/schemas/reservas.ts` con schemas de entrada y salida.
- [ ] Registrar todos los endpoints, seguridad, parámetros y respuestas.
- [ ] Exportar el módulo desde `documentation/schemas/index.ts`.
- [ ] Verificar los contratos en `GET /api/docs`.

## Cierre

- [ ] Validar todos los criterios de aceptación de `spec.md`.
- [ ] Actualizar `../../constitution/roadmap.md` y promover la siguiente feature adecuada.

