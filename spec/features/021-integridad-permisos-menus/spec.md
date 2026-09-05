# 021 · Integridad de Permisos y Menús

**Estado:** implementada, con cierre de calidad pendiente (ver `tasks.md`: bloqueada por el mismo `yarn build` preexistente de las features 018/019/020, y con huecos de cobertura real-DB documentados explícitamente)

## Qué hace

Cierra la brecha entre lo que el modelo de datos de RBAC promete (`Permission`, `Role`, `RolePermission`, `Menu`, `MenuPermission`) y lo que el backend realmente sirve hoy. Concretamente:

1. Implementa el módulo de **menús** (`Menu`/`MenuPermission`) que existe en el schema de Prisma y en la migración desde el origen del proyecto, pero que ningún archivo de `database/`, `services/`, `validations/`, `pages/api/` ni `documentation/schemas/` referencia todavía — hoy es un par de tablas vacías e inalcanzables por API. Se le da el mismo tratamiento de solo-lectura + catálogo sembrado que ya tiene `Permission`, expresando la relación real menú→permiso que el schema modela.
2. Refuerza el **catálogo de permisos** (`prisma/seed.ts`) para que la sincronización manual entre los códigos que exigen los middlewares `access(...)` y las filas de la tabla `permissions` sea verificable y no dependa de que un humano la recuerde. No sustituye el mecanismo: lo audita y lo reafirma.
3. Documenta y corrige una inconsistencia real detectada en el cómputo de permisos efectivos de sesión (`database/users/index.ts`), donde la columna `RolePermission.granted` se ignora en un punto del código pero se respeta en otros dos.
4. Documenta, sin resolverlas por decisión unilateral, dos filas de permisos huérfanas (`sedes.read`, `sedes.manage`) que existen en el catálogo pero que ninguna ruta protege hoy.

## Por qué

`spec/constitution/mission.md` compromete explícitamente "un sistema de control de accesos basado en roles y **menús dinámicos**" como principio arquitectónico (sección "Qué construimos", punto 2). El modelo `Menu`/`MenuPermission` fue creado para eso desde la migración `20260623232157` (junto con `Permission`/`RolePermission`/`Role`), pero nunca se completó su capa de aplicación: no hay `database/menus/`, ni `services/menus/`, ni `pages/api/menus`, ni entrada en `prisma/seed.ts`, ni registro en `documentation/schemas/`. Es una promesa de la constitución que el código no cumple.

Mientras tanto, `canchago-ionic` (el único consumidor real hoy) no pregunta nada a `canchago` sobre menús: su navegación de administración vive hardcodeada en `canchago-ionic/src/features/admin/navigation/admin-navigation.ts` como un arreglo estático (`ADMIN_NAVIGATION`), con `requiredPermissions` escritos a mano por cada ítem. Esto es un hallazgo verificado, no una suposición: se confirmó por lectura directa de ese archivo y por búsqueda exhaustiva de `menu`/`/api/menus` en `canchago-ionic/src`, sin resultados de consumo. El resultado es que las tablas `menus`/`menu_permissions` están vacías por diseño incompleto, no por un bug puntual — cualquier superficie (Ionic, Swagger, un futuro cliente) que intente leer menús reales desde `canchago` encuentra necesariamente cero filas, porque nunca se sembraron y no existe endpoint para poblarlas ni consultarlas.

El catálogo de permisos (`GET /api/permisos`) sí existe y sí está poblado cuando se corre `yarn seed`, y **está completo hoy** respecto a lo que el código exige: se verificaron los 13 códigos distintos que aparecen en llamadas `access('<code>')` dentro de `pages/api/**` contra las 12 filas que siembra `prisma/seed.ts`, y los 13 están cubiertos. El riesgo no es una falta actual, sino la fragilidad del mecanismo: el propio comentario en `prisma/seed.ts` advierte que si un desarrollador agrega una ruta con un código nuevo y olvida añadirlo al arreglo `PERMISSIONS`, ese permiso "existe" en la ruta pero nunca en la base, y la ruta devuelve 403 eterno — o, visto desde la administración de roles, ese permiso simplemente nunca aparece para asignar. Esta feature reemplaza esa confianza ciega por una verificación reproducible.

De paso, revisar exhaustivamente el cómputo de permisos efectivos para diseñar el catálogo de menús expuso una inconsistencia real que compromete el principio de "un permiso asignado debe seguir validándose en backend" a futuro: `database/users/index.ts` arma `SessionUser.permissions` recorriendo `role.permissions` sin filtrar `granted: true`, mientras que `database/roles-permisos/role.db.ts` y `permissionDb.getPermissionsByRole` sí filtran por `granted: true` para las mismas filas de `RolePermission`. Hoy no produce ningún efecto observable porque ningún camino de escritura (`replacePermissions`, `seed-dev.ts`) crea jamás una fila con `granted: false` — pero es una grieta latente que esta feature cierra antes de que alguna vía de revocación parcial la explote.

## Estado real verificado

_Todo lo listado aquí se comprobó leyendo el código y el schema reales de este repositorio el 2026-09-04; nada es inferido ni supuesto._

### Menús — schema existente, capa de aplicación inexistente

- `prisma/schema.prisma` define `Menu` (`id`, `parentId` opcional autorreferenciado con `onDelete: SetNull`, `code` único, `name`, `route` opcional, relación `children`/`parent`) y `MenuPermission` (PK compuesta `[menuId, permissionId]`, `onDelete: Cascade` en ambos lados). Migrados en `prisma/migrations/20260623232157/migration.sql` junto con `permissions`/`role_permissions`.
- `Menu` **no tiene** `order`/`sortOrder`, `icon`, `title` distinto de `name`, `isActive`/`visible`, `module`, ni `description`. Ninguna de esas propiedades existe en el schema ni en la migración. No se inventan: si se necesitan, requieren una migración aditiva explícita y aprobada por separado, fuera de esta feature (ver "Fuera de alcance").
- Búsqueda exhaustiva (`grep -rli "menu" --include="*.ts"` excluyendo `node_modules`/`generated`) sobre todo el repositorio: **cero coincidencias** fuera de `prisma/schema.prisma` y la migración SQL. No existe `database/menus/`, `services/menus/`, `validations/menus/`, `pages/api/menus*`, entrada en `prisma/seed.ts`/`seed-dev.ts`, ni registro en `documentation/schemas/`.
- Consecuencia directa: las tablas `menus`/`menu_permissions` están vacías en todo entorno porque nada las siembra, y son inalcanzables porque no existe ningún endpoint que las lea. No es un estado de "carga" ni un filtro incorrecto: es la ausencia total de la capa de aplicación sobre un schema ya migrado.

### Consumidor real (`canchago-ionic`) — navegación estática, no conectada a `Menu`

- `canchago-ionic/src/features/admin/navigation/admin-navigation.ts` define `ADMIN_NAVIGATION` como un arreglo TypeScript estático: 4 ítems (`users`, `roles`, `permissions`, `organizations`), cada uno con `id`, `label`, `description`, `icon`, `path` y `requiredPermissions` escritos a mano en el propio archivo.
- Búsqueda de `/api/menus` y de la palabra `menu` en `canchago-ionic/src`: sin ningún consumo de un endpoint de menús. La navegación de administración de Ionic hoy no depende ni sabe de las tablas `menus`/`menu_permissions` de `canchago`.
- Esto es información de contexto, no un compromiso de esta feature: `canchago-ionic` es otro repositorio con su propia constitución y su propio flujo SDD. Esta spec no ordena ni asume cambios ahí (ver "Fuera de alcance"). Se documenta porque explica, con evidencia, por qué las tablas de menús aparecen vacías: nunca se sembraron y nada las pide.

### Catálogo de permisos — completo hoy, mantenido a mano

- `prisma/seed.ts` siembra 12 permisos (`module.action`): `users.{read,create,update,delete,manage}`, `organizaciones.{read,manage}`, `sedes.{read,manage}`, `roles.{read,manage}`, `permisos.read`. Inserción idempotente por `code` único (`findUnique` antes de `create`), sin sobrescribir filas existentes.
- Se extrajeron con `grep -rnoE "access\('[a-zA-Z0-9_.-]+'\)"` los 30 sitios de llamada a `access(...)` en `pages/api/**`, reduciéndolos a 13 códigos distintos: `organizaciones.read`, `organizaciones.manage`, `permisos.read`, `roles.read`, `roles.manage`, `users.read`, `users.create`, `users.update`, `users.delete`, `users.manage`. **Los 13 códigos que el código exige existen en el catálogo sembrado.** Hoy no hay ningún permiso "vacío" por código faltante.
- Dos filas sembradas — `sedes.read` y `sedes.manage` — **no las exige ningún `access(...)` actual**: las rutas de sedes (`pages/api/organizaciones/[organizationId]/sedes/**`) están protegidas con `organizaciones.read`/`organizaciones.manage`, no con las de `sedes`. Son permisos huérfanos: existen, son asignables a un rol y aparecen en `GET /api/permisos`, pero no habilitan ni bloquean ninguna ruta real.
- El propio código documenta el riesgo del mecanismo manual: el comentario en `prisma/seed.ts` dice textualmente que el catálogo "debe reflejar EXACTAMENTE los codigos que exigen los middlewares access(...)" y que un descuadre produce "403 eterno". No existe hoy ninguna verificación automatizada de esa correspondencia; depende de que quien añade una ruta recuerde actualizar el arreglo `PERMISSIONS`.

### Cómputo de permisos efectivos — inconsistencia real en el filtro `granted`

- `database/roles-permisos/role.db.ts` (selects usados por `role.service.ts`) y `permissionDb.getPermissionsByRole` (`database/roles-permisos/permission.db.ts`) consultan `RolePermission` con `where: { granted: true }` explícito.
- `database/users/index.ts` (`loadUserWithAccess` → `mapPermissions`, usado por `middleware/auth.ts` para construir `SessionUser.permissions` en cada request) incluye `role.permissions` **sin** ese filtro: cualquier fila de `RolePermission` asociada al rol, sin importar `granted`, entra a la sesión efectiva.
- Auditoría de todos los caminos de escritura de `RolePermission` (`role.db.ts#replacePermissions`, `prisma/seed-dev.ts#grantAllPermissionsToAdmin`): ambos crean siempre `granted: true`; no existe hoy ningún camino que escriba `granted: false`. Por eso la inconsistencia no tiene efecto observable actualmente — pero es un cómputo de "permisos efectivos" no uniforme dentro del mismo dominio, y el día que exista una revocación parcial (en vez de reemplazo completo), la sesión concedería un permiso que otras consultas del mismo sistema ya no consideran vigente.

### Documentación y respuesta HTTP — convenciones a reutilizar

- Las rutas de solo lectura existentes (`GET /api/permisos`, `GET /api/roles/{roleId}/permisos`) devuelven siempre `{ data: [...], meta: { page, pageSize, total, totalPages } }`, incluyendo cuando `total` es 0 — nunca `404` ni `null` por ausencia de filas. Ese es el contrato de "vacío real" que ya existe en el proyecto y que el nuevo endpoint de menús debe igualar.
- `documentation/schemas/roles-permisos.ts` registra componentes con `registry.register(nombre, schema)` y endpoints con `registry.registerPath({...})` (no `registry.registerComponent()` como sugiere de forma genérica `AGENTS.md` §7 — el método real exportado por `documentation/registry.ts`, vía `@asteasolutions/zod-to-openapi`, es `register`). Esta feature sigue el método real, verificado en el código, no el nombre genérico del documento constitucional.
- `helper/pagination.ts` expone `normalizePagination`, reutilizable para el nuevo listado de menús; hoy `permissionDb.getPermissions` no lo usa (calcula `skip`/`take` a mano) — se señala como inconsistencia menor preexistente, no se corrige aquí salvo que el nuevo endpoint de menús la introduzca limpiamente sin tocar el de permisos.

## Alcance funcional

### Menús (nuevo)

- Existe un catálogo de menús persistido, sembrado de forma idempotente (mismo patrón `findUnique`-antes-de-`create` por `code` único que ya usa `prisma/seed.ts` para permisos), reflejando **exactamente** las secciones administrables reales y ya existentes hoy en el único consumidor conocido (`canchago-ionic`): los 4 ítems de `ADMIN_NAVIGATION` (`users`, `roles`, `permissions`, `organizations`), sin inventar secciones nuevas que no existan en ningún cliente real.
- Cada menú sembrado queda asociado, vía `MenuPermission`, al o los códigos de `Permission` que ya gobiernan esa sección según `access(...)` en el backend (p. ej. el menú `roles` con `roles.read`; el menú `permissions` con `permisos.read`). La asociación refleja el permiso real verificado en el paso anterior, no una suposición.
- Un nuevo permiso `menus.read` se añade al catálogo (mismo mecanismo, mismo archivo) para gobernar la lectura del propio catálogo de menús — igual que `permisos.read` gobierna la lectura del catálogo de permisos.
- Un endpoint de solo lectura (`GET /api/menus`, ver `plan.md` para el detalle técnico) expone el catálogo con paginación y estructura jerárquica basada en `parentId`, protegido por `menus.read`, devolviendo para cada menú sus campos reales (`id`, `code`, `name`, `route`, `parentId`) y los códigos de permiso asociados (no objetos `Permission` completos innecesarios). No se agregan endpoints de creación/edición/borrado de menús vía HTTP: igual que `Permission`, el catálogo se administra por seed, no por CRUD interactivo (ver "Fuera de alcance").
- Un menú visible en la respuesta de `GET /api/menus` **no implica autorización sobre nada**: el cliente que lo consuma sigue obligado a evaluar sus propios `permissions` de sesión (ya expuestos hoy) contra `requiredPermissions` del menú antes de navegar, y cada endpoint de recurso (`/roles`, `/users`, etc.) sigue validando su propio `access(...)` de forma independiente, exactamente como hoy. Completar el catálogo de menús no amplía ni reduce ningún privilegio.

### Permisos — auditoría y refuerzo del catálogo existente

- Se define un mecanismo de verificación reproducible (reutilizando y extendiendo `prisma/seed.ts`/`seed-dev.ts`, no reemplazándolos) que compara, en cada ejecución, el conjunto de códigos `access('<code>')` presentes en `pages/api/**` contra las filas de `Permission`:
  - Código exigido por el código pero ausente en la tabla → se reporta y se crea de forma aditiva (mismo patrón idempotente ya usado), nunca se sobreescribe ni se borra nada existente.
  - Código presente en la tabla pero no exigido por ningún `access(...)` actual (caso ya detectado: `sedes.read`, `sedes.manage`) → se reporta como huérfano; **no se borra automáticamente** (podría estar ya concedido a un rol real) ni se asume su destino. Queda documentado como hallazgo que requiere una decisión explícita del equipo (recablearlo a las rutas de sedes si esa es la intención real, o marcarlo formalmente como obsoleto) antes de cualquier eliminación.
- El mecanismo corre como parte del flujo de seed ya existente (`yarn seed`) y queda documentado para poder ejecutarse también como verificación aislada (p. ej. en CI o antes de un release), sin introducir una herramienta nueva ni un runner distinto a los que ya tiene el proyecto (Node/TypeScript vía los scripts de `package.json`, mismo mecanismo que ejecuta `seed.ts` hoy).
- Ningún rol, ninguna asignación `RolePermission` existente, ni ningún permiso ya sembrado se modifica, renombra o elimina como efecto de esta auditoría. Es estrictamente aditiva y de solo reporte para lo que ya existe.

### Permisos efectivos — normalización del filtro `granted`

- `database/users/index.ts` (`mapPermissions`) pasa a filtrar `granted: true` en la misma consulta/estructura que ya usan `role.db.ts` y `permissionDb.getPermissionsByRole`, de modo que "permisos efectivos de sesión" signifique lo mismo en todo el backend.
- Al no existir hoy ninguna fila con `granted: false`, este cambio es transparente para todos los usuarios y roles actuales: ninguna sesión pierde ni gana un permiso como consecuencia directa de esta normalización (se verifica con prueba dedicada, ver `plan.md`/`tasks.md`).

### Estados de respuesta (para que cualquier cliente, incluido uno visual, represente vacío/carga/error/éxito sin ambigüedad)

- `GET /api/menus` y `GET /api/permisos` devuelven siempre el sobre `{ data: [], meta: {...} }` cuando no hay filas — nunca `404`, `null` ni un arreglo `undefined` — igual que el resto de listados paginados del proyecto. Un cliente puede distinguir "cargando" (sin respuesta aún), "vacío real" (`200` con `data: []`), "error" (`4xx`/`5xx` con el sobre `{ error: {...} }`) y "éxito con datos" (`200` con `data` no vacío) sin inferencias.
- No se oculta ninguna inconsistencia detectada: el reporte de auditoría del catálogo de permisos (huérfanos, faltantes) se expone como salida legible del propio proceso de seed (log estructurado, igual estilo que ya usan `seed.ts`/`seed-dev.ts` con `console.log`/`console.error`), nunca se silencia ni se "arregla" fusionándolo en el resultado normal sin dejar rastro.

## Requisitos trazables

| ID     | Requisito verificable                                             | Diseño principal                                              | Pruebas mínimas                                        |
| ------ | ------------------------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------- |
| IPM-01 | Catálogo de menús real, sembrado y consultable                     | `database/menus/`, seed idempotente, `GET /api/menus`           | seed dos veces sin duplicar, listado con datos          |
| IPM-02 | Menú↔Permiso refleja asociaciones reales, no inventadas            | `MenuPermission` seed alineado a `access(...)` real              | cada menú sembrado expone códigos que existen y aplican |
| IPM-03 | Lectura de menús exige permiso propio (`menus.read`)                | `access('menus.read')` en la ruta nueva                          | 401 sin sesión, 403 sin el permiso, 200 con el permiso  |
| IPM-04 | Menú visible no otorga acceso a los recursos que representa         | independencia entre `GET /api/menus` y `access(...)` de recursos | tener `menus.read` sin `roles.read` sigue dando 403 en `/roles` |
| IPM-05 | Catálogo de permisos auditable contra el código real                | extensión de `prisma/seed.ts`/`seed-dev.ts` con reporte          | detecta código faltante inyectado en prueba, detecta huérfano real (`sedes.*`) |
| IPM-06 | Auditoría nunca borra ni muta datos existentes                      | inserción aditiva idempotente, huérfanos solo reportados         | rol con permiso "huérfano" ya asignado conserva la asignación tras correr la auditoría |
| IPM-07 | Permisos efectivos de sesión consistentes con el resto del sistema  | filtro `granted: true` uniforme en `database/users/index.ts`     | sesión antes/después de la normalización expone el mismo conjunto de permisos para datos actuales; un permiso con `granted: false` simulado deja de aparecer en sesión pero sí en el detalle interno |
| IPM-08 | Estados vacío/error/éxito representables sin ambigüedad             | sobre `{ data, meta }` / `{ error }` uniforme                    | catálogo vacío devuelve `200` con `data: []`, no `404`  |
| IPM-09 | Sin regresiones en auth/autorización/navegación existentes          | cambios aditivos + normalización aislada                        | suite completa (`roles-permisos`, `users`, auth, sesión) sigue en verde |

## Criterios de aceptación

- [ ] `GET /api/menus` responde `200` con `{ data: [...], meta: {...} }` conteniendo los menús sembrados (mínimo los 4 correspondientes a `users`, `roles`, `permissions`, `organizations`), cada uno con sus códigos de permiso asociados reales.
- [ ] Ejecutar el seed de menús dos veces seguidas no produce duplicados (mismo `code` único, misma verificación `findUnique`-antes-de-`create` que ya usa el seed de permisos).
- [ ] `GET /api/menus` devuelve `401` sin sesión y `403` a un usuario autenticado sin `menus.read`; con `menus.read` devuelve `200`.
- [ ] Tener `menus.read` (y por tanto ver el menú "Roles" en el catálogo) no otorga por sí solo acceso a `GET /api/roles`: sin `roles.read`, esa ruta sigue devolviendo `403`. Ningún endpoint de recursos cambia su comportamiento de autorización por la existencia del catálogo de menús.
- [ ] El mecanismo de auditoría del catálogo de permisos, ejecutado sobre el estado real del repositorio, reporta cero códigos `access(...)` sin permiso correspondiente en la tabla `permissions`.
- [ ] El mismo mecanismo, ejecutado con un código de permiso deliberadamente eliminado del catálogo en una prueba, lo detecta y lo reporta como faltante (prueba de caracterización de la propia auditoría).
- [ ] El mecanismo reporta `sedes.read` y `sedes.manage` como huérfanos (no exigidos por ningún `access(...)` actual) sin eliminarlos ni modificarlos.
- [ ] Un rol con `sedes.read` ya asignado antes de correr la auditoría conserva esa asignación intacta después de correrla.
- [ ] Ningún rol, `RolePermission`, ni permiso previamente sembrado cambia de valor, se renombra o se elimina como efecto de correr el seed/auditoría extendidos.
- [ ] Tras normalizar `database/users/index.ts` para filtrar `granted: true`, el conjunto de permisos efectivos de cada usuario/rol existente en los datos de prueba es idéntico al que tenían antes del cambio (verificado con prueba dedicada que compara antes/después).
- [ ] Con una fila de `RolePermission` simulada en `granted: false` (solo en prueba, no en datos reales), esa sesión ya no incluye ese permiso en `SessionUser.permissions`, aunque el registro siga existiendo en `role.db.ts`/`permissionDb.getPermissionsByRole` para consultas administrativas que sí lo filtran explícitamente.
- [ ] Un catálogo de menús o de permisos sin filas responde `200` con `data: []`, nunca `404` ni un cuerpo vacío/`null`.
- [ ] Toda la suite de pruebas existente (`roles-permisos`, `users`, autenticación, sesión, guardas de rol) permanece en verde tras los cambios; no se modifica el comportamiento de ningún endpoint de recursos fuera de lo descrito aquí.

### Documentación (obligatorio)

- [ ] `GET /api/menus` está registrado en `documentation/schemas/` mediante `registry.registerPath()`, en un archivo propio (`documentation/schemas/menus.ts`) o, si el volumen no lo justifica, dentro de `documentation/schemas/roles-permisos.ts` junto a Permisos — decisión técnica a fijar en `plan.md`.
- [ ] Los schemas de entrada y salida del nuevo endpoint (query de listado, forma de un menú, forma paginada) están registrados con `registry.register()` (método real verificado en `documentation/registry.ts`), no con el nombre `registerComponent()` que usa como referencia genérica `AGENTS.md` §7.
- [ ] El archivo nuevo o modificado está exportado desde `documentation/schemas/index.ts`.
- [ ] `GET /api/docs` muestra el endpoint de menús con su schema, ejemplos y códigos de respuesta (`200`, `400`, `401`, `403`), igual que el resto de endpoints de solo lectura del módulo `roles-permisos`.

## Fuera de alcance

- Cualquier campo de `Menu` que el schema no tenga hoy (`order`, `icon`, `title`, `isActive`/`visible`, `module`, `description`). Añadirlos requiere una migración Prisma aditiva aprobada explícitamente en una feature propia — no se infiere ni se agrega aquí.
- Endpoints de creación, edición o borrado de menús vía HTTP (`POST`/`PATCH`/`DELETE /api/menus/...`). El catálogo se administra por seed, exactamente igual que `Permission` hoy.
- Cualquier cambio en `canchago-ionic`: migrar `ADMIN_NAVIGATION` a consumir `GET /api/menus`, agregar estados de carga/vacío/error en su UI, o cualquier otro ajuste de interfaz. `canchago` es un backend puro sin frontend (`AGENTS.md` §1, §11); ese trabajo, si se decide hacerlo, es una feature separada en el repositorio `canchago-ionic` bajo su propio flujo SDD, y debe partir de los contratos reales que esta feature deja documentados — no se asume ni se diseña aquí.
- Decidir el destino final de los permisos huérfanos `sedes.read`/`sedes.manage` (recablearlos a rutas reales de sedes o deprecarlos formalmente). Esta feature los detecta, los reporta y protege las asignaciones existentes; la decisión de negocio sobre qué hacer con ellos queda pendiente de confirmación explícita fuera de esta spec.
- Corregir la unicidad real de `Role.name`/`Role.code` (falta de `@@unique`, hallazgo ya registrado en el backlog de `spec/constitution/roadmap.md` desde la feature 019). No forma parte de este alcance.
- Uniformar el uso de `helper/pagination.ts#normalizePagination` en `permissionDb.getPermissions` (inconsistencia menor preexistente, no introducida por esta feature). El nuevo endpoint de menús sí debe usar el helper desde el inicio, sin tocar el de permisos existente.
- Cualquier endpoint, permiso o menú para módulos que no existen todavía en el backend (reservas, pagos, torneos). Solo se cubren los módulos ya reales: usuarios, roles, permisos, organizaciones/sedes, y el propio catálogo de menús.
