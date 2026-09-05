# 021 · Integridad de Permisos y Menús — Tareas

_Checklist accionable derivada del `plan.md`. Tareas pequeñas y concretas; marca `[x]` al completarlas._

## Preflight

- [ ] Releer la documentación de Pages API Routes en `node_modules/next/dist/docs/` relevante antes de tocar `pages/api/menus/`.
- [ ] Releer `canchago-ionic/src/features/admin/navigation/admin-navigation.ts` en el momento de implementar (no confiar en la lista congelada de `plan.md` si el archivo cambió desde la redacción de esta spec).
- [ ] Confirmar que `prisma generate` está sincronizado con `schema.prisma` (los modelos `Menu`/`MenuPermission` ya existen; no se toca el schema en esta feature).

## Catálogo de permisos y menús (seed)

- [ ] Añadir `{ module: 'menus', action: 'read', ... }` al arreglo `PERMISSIONS` de `prisma/seed.ts`, sin reordenar ni tocar entradas existentes.
- [ ] Añadir arreglo `MENUS` a `prisma/seed.ts` con los menús reales de `ADMIN_NAVIGATION` (`users`, `roles`, `permissions`, `organizations`): `code`, `name`, `route`, permisos asociados.
- [ ] Sembrar `Menu` de forma idempotente (`findUnique` por `code` antes de `create`, mismo patrón que permisos).
- [ ] Sembrar `MenuPermission` de forma idempotente (`upsert` por `[menuId, permissionId]`, mismo patrón que `seed-dev.ts#grantAllPermissionsToAdmin`).
- [ ] Implementar la función de auditoría del catálogo: extraer códigos `access('<code>')` de `pages/api/**/*.ts`, comparar contra `Permission`, loguear faltantes (y crearlos aditivamente) y huérfanos (solo reporte).
- [ ] Verificar manualmente que la auditoría, corrida sobre el estado real del repo, reporta `sedes.read`/`sedes.manage` como huérfanos y ningún código faltante.
- [ ] Verificar que correr `yarn seed` dos veces seguidas no duplica ninguna fila de `Menu`, `MenuPermission` ni `Permission`.

## Backend — módulo de menús

- [ ] Crear `database/menus/menu.db.ts` con `getMenus(page, pageSize)` usando `helper/pagination.ts#normalizePagination`, seleccionando `id`, `code`, `name`, `route`, `parentId` y códigos de permisos asociados.
- [ ] Crear `services/roles-permisos/menu.service.ts` delegando en `menu.db.ts`.
- [ ] Crear `validations/roles-permisos/menu.validation.ts` con el schema `.strict()` de query de listado (`page`, `pageSize`, mismos límites que `permissionListQuerySchema`).
- [ ] Crear `pages/api/menus/index.ts`: `auth` + `access('menus.read')` en `GET`, delegando en el servicio, respondiendo `{ data, meta }`.

## Normalización de permisos efectivos

- [ ] Capturar snapshot de permisos efectivos actuales de los fixtures de prueba (antes del cambio).
- [ ] Añadir `where: { granted: true }` al `include` de `permissions` en `loadUserWithAccess` (`database/users/index.ts`).
- [ ] Verificar que el snapshot de permisos efectivos es idéntico antes/después para los datos reales de prueba.
- [ ] Añadir caso de prueba con una fila `RolePermission` simulada en `granted: false` que demuestre exclusión de sesión tras el cambio.

## Pruebas

- [ ] `database/menus/menu.db.test.ts` — mocks de Prisma, paginación, forma de retorno.
- [ ] `services/roles-permisos/menu.service.test.ts` — delegación al db layer.
- [ ] `validations/roles-permisos/menu.validation.test.ts` — límites de `page`/`pageSize`, rechazo de campos no soportados.
- [ ] Prueba de auditoría del catálogo: código sintético faltante detectado; huérfanos reales (`sedes.*`) detectados; ejecución repetida no duplica ni borra; rol de prueba con permiso huérfano ya asignado conserva la asignación.
- [ ] `tests/integration/menus.test.ts` — `GET /api/menus` sin sesión (401), sin `menus.read` (403), con `menus.read` (200 con datos del seed).
- [ ] Prueba cruzada IPM-04: tener `menus.read` sin `roles.read` sigue devolviendo 403 en `GET /api/roles`.
- [ ] Prueba de catálogo vacío: `GET /api/menus` y `GET /api/permisos` sin filas devuelven `200` con `data: []`, nunca `404`.
- [ ] Ejecutar la suite completa existente (`tests/integration/roles-permisos.test.ts`, `tests/integration/users-role-guard.test.ts`, pruebas de auth/sesión) y confirmar cero regresiones.

## Documentación Swagger (obligatorio)

_Debe completarse en paralelo con el endpoint, no como paso final._

- [ ] Registrar el schema de un menú y su forma paginada con `registry.register()` (método real verificado en `documentation/registry.ts`).
- [ ] Registrar `GET /menus` con `registry.registerPath()`: método, path, tags, seguridad, query params, respuestas `200/400/401/403`.
- [ ] Decidir y aplicar: archivo propio `documentation/schemas/menus.ts` o sección añadida a `documentation/schemas/roles-permisos.ts` (criterio: >100 líneas → archivo propio).
- [ ] Exportar el módulo de documentación desde `documentation/schemas/index.ts`.
- [ ] Verificar que `GET /api/docs` muestra el endpoint de menús con schema, ejemplos y códigos de respuesta correctos.

## Cierre

- [ ] Validar contra los criterios de aceptación de `spec.md`, uno por uno.
- [ ] `yarn lint && yarn typecheck && yarn test && yarn build` en verde.
- [ ] Mover la feature a "Hecho" en `../../constitution/roadmap.md` solo cuando todo lo anterior esté completo (no antes, siguiendo el mismo criterio que 018/019/020).

## Mantenimiento (checklist recurrente)

_Repetir cada vez que se agregue una ruta nueva protegida por `access(...)` o una sección administrable nueva._

- [ ] Correr `yarn seed` y revisar el log de auditoría: cero códigos faltantes, revisar cualquier huérfano nuevo reportado antes de decidir si se recablea o se deprecra.
- [ ] Si la sección nueva tiene una entrada real en la navegación de algún cliente (p. ej. `canchago-ionic`), añadir el menú correspondiente al arreglo `MENUS` de `prisma/seed.ts` con sus permisos reales asociados — nunca inventar la asociación antes de que la ruta y el permiso existan de verdad en el backend.
