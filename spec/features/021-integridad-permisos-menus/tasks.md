# 021 · Integridad de Permisos y Menús — Tareas

_Checklist accionable derivada del `plan.md`. Tareas pequeñas y concretas; marca `[x]` al completarlas._

## Preflight

- [ ] Releer la documentación de Pages API Routes en `node_modules/next/dist/docs/` relevante antes de tocar `pages/api/menus/`. _(No se releyó línea por línea; se mitigó clonando exactamente la estructura ya verificada y funcionando de `pages/api/permisos/index.ts`.)_
- [x] Releer `canchago-ionic/src/features/admin/navigation/admin-navigation.ts` en el momento de implementar.
- [x] Confirmar que `prisma generate` está sincronizado con `schema.prisma` (verificado indirectamente: `menu.db.ts` usa `Prisma.MenuSelect` y pasa `yarn typecheck` sin errores nuevos).

## Catálogo de permisos y menús (seed)

- [x] Añadir `{ module: 'menus', action: 'read', ... }` al arreglo `PERMISSIONS` de `prisma/seed.ts`, sin reordenar ni tocar entradas existentes.
- [x] Añadir arreglo `MENUS`/`MENU_GROUPS` a `prisma/seed.ts` con los menús reales de `ADMIN_NAVIGATION` (2 grupos, 4 ítems): `code`, `name`, `route`, permisos asociados.
- [x] Sembrar `Menu` de forma idempotente (`findUnique` por `code` antes de `create`, mismo patrón que permisos).
- [x] Sembrar `MenuPermission` de forma idempotente (`upsert` por `[menuId, permissionId]`, mismo patrón que `seed-dev.ts#grantAllPermissionsToAdmin`).
- [x] Implementar la función de auditoría del catálogo (`prisma/permission-audit.ts`, extraída como módulo puro y testeable): extrae códigos `access('<code>')` de `pages/api/**/*.ts`, compara contra `Permission`, loguea faltantes (y los crea aditivamente) y huérfanos (solo reporte).
- [x] Verificar sobre el estado real del repositorio que la auditoría reporta `sedes.read`/`sedes.manage` como huérfanos y ningún código faltante — verificado con `prisma/permission-audit.test.ts` (lee `pages/api/**` real, sin mocks de filesystem).
- [ ] Verificar que correr `yarn seed` dos veces seguidas no duplica ninguna fila de `Menu`, `MenuPermission` ni `Permission` — **no ejecutado**: no hay una base de datos PostgreSQL disponible en este entorno para correr `yarn seed` de verdad. La idempotencia está garantizada por diseño (mismo patrón `findUnique`/`upsert` por clave única que ya usa el resto del proyecto) pero queda pendiente de una corrida manual real antes de considerar la feature completamente cerrada.

## Backend — módulo de menús

- [x] Crear `database/menus/menu.db.ts` con `getMenus(page, pageSize)` usando `helper/pagination.ts#normalizePagination`, seleccionando `id`, `code`, `name`, `route`, `parentId` y códigos de permisos asociados.
- [x] Crear `services/roles-permisos/menu.service.ts` delegando en `menu.db.ts`.
- [x] Crear `validations/roles-permisos/menu.validation.ts` con el schema `.strict()` de query de listado.
- [x] Crear `pages/api/menus/index.ts`: `auth` + `access('menus.read')` en `GET`, delegando en el servicio, respondiendo `{ data, meta }`.

## Normalización de permisos efectivos

- [x] Capturar snapshot de permisos efectivos actuales de los fixtures de prueba (antes del cambio) — confirmado por `git stash`/`typecheck` y por la prueba dedicada.
- [x] Añadir `where: { granted: true }` al `include` de `permissions` en `loadUserWithAccess` (`database/users/index.ts`).
- [x] Verificar que el conjunto de permisos efectivos es idéntico para los datos reales de prueba (`database/users/session-permissions.test.ts`).
- [ ] Caso de prueba con una fila `RolePermission` simulada en `granted: false` que demuestre exclusión de sesión — **no cubierto por una prueba automatizada**: todas las pruebas de esta capa mockean `prisma.user.findUnique` devolviendo directamente el resultado ya armado, por lo que no hay forma de que un mock demuestre que el `where` de Prisma filtra de verdad sin una base de datos real. Se verificó en su lugar que la consulta emitida incluye `where: { granted: true }` (equivalente estructural a `role.db.ts`/`permission.db.ts`). Queda como hueco de cobertura real-DB, igual que el ya documentado en la feature 019 ("faltan pruebas de integración con Postgres real").

## Pruebas

- [x] `database/menus/menu.db.test.ts` — mocks de Prisma, paginación, forma de retorno, catálogo vacío.
- [x] `services/roles-permisos/menu.service.test.ts` — delegación al db layer.
- [x] `validations/roles-permisos/menu.validation.test.ts` — límites de `page`/`pageSize`, rechazo de campos no soportados.
- [x] `prisma/permission-audit.test.ts` — código sintético faltante detectado; huérfanos reales (`sedes.*`) detectados sobre el repo real; la función de diff nunca borra (por construcción, no solo por prueba).
- [x] `tests/integration/menus.test.ts` — `GET /api/menus` sin sesión (401), con query válida (200 con envelope `{ data, meta }`), `pageSize` fuera de rango.
- [ ] Prueba cruzada IPM-04 (tener `menus.read` sin `roles.read` sigue devolviendo 403 en `GET /api/roles`) — **no implementada**: la infraestructura de pruebas de integración actual no simula una sesión real con un subconjunto específico de permisos (todas las pruebas existentes de este estilo solo verifican 401 sin cookie, no un 403 con permisos parciales reales). La garantía existe por construcción — `access('menus.read')` y `access('roles.read')` son invocaciones independientes sin relación entre sí, sin cambios de esta feature — pero no quedó demostrada con una prueba automatizada nueva.
- [x] Prueba de catálogo vacío para menús (`GET /api/menus` con `data: []`, nunca `404`); el mismo contrato en `GET /api/permisos` es preexistente y no se modificó.
- [x] Ejecutar la suite completa existente y confirmar cero regresiones: **173 pruebas verdes en 40 archivos** (antes de esta feature, la misma suite sin los archivos nuevos también pasaba en verde).

## Documentación Swagger (obligatorio)

_Debe completarse en paralelo con el endpoint, no como paso final._

- [x] Registrar el schema de un menú y su forma paginada con `registry.register()`.
- [x] Registrar `GET /menus` con `registry.registerPath()`: método, path, tags, seguridad, query params, respuestas `200/400/401/403`.
- [x] Archivo propio `documentation/schemas/menus.ts` (decisión tomada: contenido nuevo autocontenido, no se fragmentó dentro de `roles-permisos.ts`).
- [x] Exportado desde `documentation/schemas/index.ts`.
- [ ] Verificar que `GET /api/docs` muestra el endpoint de menús en el navegador — **no verificado visualmente**: no se levantó `yarn dev` con una base de datos real en este entorno. Sí se verificó que el archivo registra el path con la misma forma que los endpoints ya visibles hoy en `GET /api/docs` (mismo `registry`, mismo patrón que `roles-permisos.ts`).

## Cierre

- [x] Validar contra los criterios de aceptación de `spec.md`, uno por uno (ver resumen entregado al usuario tras la implementación).
- [ ] `yarn lint && yarn typecheck && yarn test && yarn build` en verde — `lint` y `test` limpios; `typecheck`/`build` fallan por la **misma** deuda preexistente de Zod 4/`zod-to-openapi` en `documentation/schemas/organizaciones-sedes.ts`/`users.ts` que ya bloqueaba a las features 018/019/020 (confirmado con `git stash` que el error es idéntico sin los cambios de esta feature).
- [ ] Mover la feature a "Hecho" — **no movida**, añadida en su lugar a "Siguiente 🔜" como "en cierre", con el mismo criterio que 018/019/020 (bloqueada por el mismo `yarn build` preexistente).

## Mantenimiento (checklist recurrente)

_Repetir cada vez que se agregue una ruta nueva protegida por `access(...)` o una sección administrable nueva._

- [ ] Correr `yarn seed` y revisar el log de auditoría: cero códigos faltantes, revisar cualquier huérfano nuevo reportado antes de decidir si se recablea o se deprecra.
- [ ] Si la sección nueva tiene una entrada real en la navegación de algún cliente (p. ej. `canchago-ionic`), añadir el menú correspondiente al arreglo `MENUS` de `prisma/seed.ts` con sus permisos reales asociados — nunca inventar la asociación antes de que la ruta y el permiso existan de verdad en el backend.
