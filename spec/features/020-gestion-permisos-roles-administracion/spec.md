# 020 · Gestión de Permisos Asociados a Roles

**Estado:** implementada con cierre de calidad pendiente por deuda preexistente

## Qué hace

Permite que un administrador autorizado abra un rol organizacional existente desde `/admin/roles` en `canchago-ionic`, consulte sus permisos asociados y gestione esas asociaciones en una pantalla dedicada. La interfaz obtiene tanto el rol como el catálogo de permisos desde `canchago`, muestra los permisos agrupados por su módulo real, permite buscar, seleccionar y deseleccionar, presenta el resumen de altas y bajas pendientes y persiste el conjunto mediante un guardado explícito.

La feature administra exclusivamente la relación `RolePermission`; no crea, edita ni elimina registros `Permission`. El backend continúa siendo la única autoridad sobre alcance, permisos asignables, protección de roles, concurrencia y escritura.

## Por qué

La feature 018 incorporó permisos dentro del formulario general de creación/edición de roles, pero la administración cotidiana necesita una acción enfocada y comprensible desde el listado o detalle del rol. Separar “Gestionar permisos” evita mezclar cambios de nombre/descripción con cambios de acceso, hace visible el diff antes de guardar y permite probar con mayor precisión las garantías de mínimo privilegio.

La capacidad se apoya en contratos ya implementados; no justifica otro endpoint ni un catálogo duplicado en Ionic.

## Estado real verificado

### Modelo RBAC y fuente de verdad

- `Permission` es un registro persistido global con `id`, `module`, `action`, `code` único, `description` opcional y `createdAt`. No tiene `active`, `deletedAt`, `assignable`, `protected` ni dependencias/incompatibilidades.
- `RolePermission` es la relación M:N explícita, con PK compuesta `[roleId, permissionId]` y `granted`. Las consultas y sesiones efectivas consideran únicamente filas `granted: true`; las escrituras HTTP actuales reemplazan el conjunto con filas concedidas.
- `Role` pertenece opcionalmente a una organización. La superficie administrativa solo consulta roles con `organizationId` no nulo, `deletedAt: null`; `isSystem` es el único indicador real de protección.
- Los permisos se originan en `prisma/seed.ts`/`prisma/seed-dev.ts` y en la tabla `permissions`. Ionic no contiene ni debe introducir un catálogo de códigos, UUID o nombres de permisos.
- No existe jerarquía numérica entre roles o permisos. Para actores no administradores globales, la regla real de mínimo privilegio es el subconjunto: permisos actuales y solicitados del rol deben pertenecer a los permisos efectivos del actor.
- No existen reglas reales de dependencia o exclusión entre permisos; esta feature no inventa una matriz CRUD ni reglas entre acciones.

### Contratos existentes reutilizados

- `GET /api/roles/{roleId}?organizationId={uuid}` requiere `roles.read` y devuelve el rol, `updatedAt` y todas sus asociaciones concedidas con metadata de `Permission`.
- `GET /api/roles/{roleId}/permisos?organizationId={uuid}&page&pageSize` requiere `roles.read` y expone las asociaciones concedidas paginadas. Se conserva para consumidores existentes; la pantalla puede usar el detalle como snapshot completo para evitar perder selecciones no cargadas.
- `GET /api/permisos?page&pageSize&search?&module?` requiere `permisos.read`; pagina y ordena por `module`, `action`, `code`. Es el único catálogo consumible y no ofrece mutaciones.
- `PATCH /api/roles/{roleId}/permisos?organizationId={uuid}` requiere `roles.manage` y acepta exclusivamente `{ permissionIds: UUID[] únicos, expectedUpdatedAt: ISO date-time }`. Reemplaza el conjunto completo mediante `roleService.updateRole`.
- El PATCH valida UUID, duplicados, máximo 500 IDs, existencia de todos los permisos, alcance organizacional, rol no borrado/no system, subconjunto de capacidades del actor y versión del agregado.
- La escritura actual actualiza `Role.updatedAt`, reemplaza asociaciones y registra `ROLE_UPDATED` con `permissionsAdded`/`permissionsRemoved`, todo dentro de una transacción Prisma.

### Autorización, super admin y sesiones

- Consulta de rol/asociaciones: `roles.read`. Consulta del catálogo: `permisos.read`. Modificación: `roles.manage`. El modelo no define hoy `roles.permissions.manage`; esta feature no inventa un permiso adicional.
- Tener `roles.read` permite consultar, pero nunca modificar. La pantalla de gestión requiere conjuntamente `roles.read`, `permisos.read` y `roles.manage`; cada endpoint vuelve a aplicar su permiso real.
- El super admin se representa por el rol global `Administrador`, código `administrador`, `isSystem: true`, aprovisionado por script/seed. Su bypass centralizado usa el rol resuelto de sesión, no IDs, usernames ni emails.
- Los roles globales no son direccionables por esta superficie porque las rutas exigen una organización y buscan coincidencia estricta. Todo rol `isSystem`, incluido uno organizacional, permanece inmutable por HTTP.
- `middleware/auth.ts` resuelve la sesión persistida y recompone usuario, roles y permisos desde PostgreSQL en cada request. Una concesión o revocación entra en vigor para todos los usuarios del rol en su siguiente request autenticado, sin renovar token, cookie ni cerrar sesiones.

### UI real reutilizable

- Existen `AdminLayout`, `AdminNavigation`, `AdminRoute`, `RolesModule`, `RolesListPage`, `RoleListItem`, `RoleDetailPage`, `PermissionGuard` y la ruta `/admin/roles`.
- Existen tipos, cliente API y hooks de roles/permisos con TanStack Query; `RoleDetailDto` ya normaliza `permissions` y el catálogo se carga en páginas de hasta 100.
- Existen `AppButton`, `AppSearchInput`, `AppSkeleton`, `AppEmptyState`, `AppErrorState`, `AppConfirmDialog`, `AppDetailActions` y controles Ionic como `IonCheckbox`.
- React Hook Form + Zod, React Router 5 y los tokens/CSS actuales cubren formulario, dirty state, navegación, responsive y feedback. No se requieren dependencias nuevas.

## Alcance funcional

### Entrada y navegación

- El detalle y, si no sobrecarga la fila, el listado de roles ofrecen “Gestionar permisos” para roles no system cuando el usuario posee `roles.manage` y `permisos.read`. “Consultar” continúa disponible con `roles.read`.
- La ruta propuesta es `/admin/roles/{roleId}/permissions?organizationId={uuid}`, coherente con las rutas Ionic existentes. No sustituye ni convierte `/admin/permissions` en CRUD: esa ruta sigue siendo, como máximo, catálogo global de solo lectura.
- Un deep link exige `roles.read`, `roles.manage` y `permisos.read` mediante `AdminRoute` con política `all`. La ausencia o manipulación de `organizationId`/`roleId` produce estado controlado y nunca omite la validación backend.
- El encabezado identifica nombre, descripción cuando exista y badge “Personalizado”. Un rol `isSystem` se muestra como protegido desde el detalle y no permite abrir la edición.

### Consulta y presentación

- El snapshot editable procede de `GET /api/roles/{roleId}` y conserva `updatedAt`; el catálogo procede de `GET /api/permisos`. No se realiza una llamada por permiso ni se cargan usuarios del rol.
- Los permisos se agrupan por `Permission.module`; cada opción muestra `description` cuando existe, `action` como etiqueta comprensible disponible y `code` como identificador técnico secundario. Si no hay descripción, se muestran `action` y `code`, sin inventar traducciones semánticas.
- Se usa `IonCheckbox` u otro control Ionic equivalente, con área táctil y estado seleccionado inequívoco. Las categorías se apilan en móvil y usan un ancho legible/grid moderado en escritorio; no se utiliza una tabla horizontal.
- El catálogo mantiene paginación/carga incremental. La búsqueda usa el parámetro remoto `search`; las selecciones y el snapshot inicial se conservan al cambiar búsqueda o cargar otra página.
- Si el rol no tiene permisos se muestra un estado vacío editable, no un error. Se contemplan `loading`, `empty`, `error` y `success` para rol, catálogo y guardado.

### Edición, diff y guardado

- El estado local parte del conjunto de IDs asociados. Cada selección calcula dos conjuntos visibles: “Se añadirán” y “Se retirarán”, derivados contra el snapshot inicial; ningún cambio se persiste hasta pulsar “Guardar cambios”.
- “Guardar cambios” permanece deshabilitado sin diff, con datos inválidos o mientras existe una mutación. Inputs y acción primaria se bloquean durante el envío; no hay retry automático de PATCH y doble clic genera una sola petición.
- El request usa reemplazo completo: `{ permissionIds, expectedUpdatedAt }`. Esta semántica coincide con el backend y garantiza un resultado determinista; no se introducen comandos incrementales POST/DELETE.
- Tras `200`, la respuesta del rol es el nuevo snapshot: se limpia el diff, se muestra confirmación accesible y se actualizan/invalida de forma precisa el detalle, listas de roles y sesión actual. No se recarga toda la aplicación.
- Si se intenta salir con cambios pendientes, `Prompt` y `AppConfirmDialog` reutilizan el patrón actual para confirmar descarte. Una navegación posterior al éxito no muestra aviso obsoleto.

### Seguridad, atomicidad y concurrencia

- Los schemas strict y el mapper del servicio aceptan únicamente `permissionIds` y `expectedUpdatedAt`; `roleId`/`organizationId` solo provienen de path/query. Campos como `code`, `isSystem`, `granted`, objetos anidados, timestamps o relaciones se rechazan como mass assignment.
- IDs inexistentes o eliminados entre carga y guardado producen error controlado y la transacción conserva el conjunto anterior. IDs duplicados se rechazan consistentemente; no se normalizan silenciosamente.
- El alcance se determina con la sesión y `UserRole`, no por confiar en el query. Rol inexistente, borrado o cross-tenant devuelve 404 opaco; manipular path/query/payload no revela ni modifica otro tenant.
- Un actor no Administrador solo puede modificar un rol cuyos permisos actuales y solicitados son subconjunto de sus capacidades. Esto impide retirar controles de un rol superior, añadir capacidades superiores o autoescalar un rol que él mismo posee.
- Ningún actor modifica por HTTP un rol `isSystem`. El Administrador global no aparece en el catálogo de roles organizacionales y sus permisos no pueden retirarse desde Ionic.
- `expectedUpdatedAt` aplica optimistic locking. Si otro administrador guarda primero, el segundo recibe 409, conserva su borrador, ve un mensaje de conflicto y puede recargar el snapshot; nunca se mezcla ni sobrescribe silenciosamente.
- Reemplazo, actualización de versión y auditoría forman una transacción. Un error en asociaciones o auditoría revierte todo; no existe estado parcial.

### Consistencia, caché y auditoría

- No se agrega caché Redis para autorización. La sesión backend recompone permisos en cada request, por lo que el plazo de propagación es la siguiente solicitud autenticada posterior al commit.
- TanStack Query puede cachear el catálogo por cinco minutos porque es inmutable por HTTP; el detalle/asociaciones se actualizan inmediatamente tras guardar. Si un cambio afecta al usuario actual, se invalida `SESSION_QUERY_KEY` para que menú y guards reflejen la nueva autorización sin esperar otra navegación.
- El evento durable `ROLE_UPDATED` registra actor, organización, rol, fecha y códigos añadidos/retirados. No registra tokens, cookies, payload completo ni secretos. La auditoría pertenece a la misma transacción.

## Requisitos trazables

| ID     | Requisito verificable                    | Diseño principal                            | Pruebas mínimas                               |
| ------ | ---------------------------------------- | ------------------------------------------- | --------------------------------------------- |
| GPR-01 | Entrada dedicada y protegida desde Roles | acción + ruta `permissions` + guards `all`  | menú/acción/deep link/401/403                 |
| GPR-02 | Rol y asociaciones reales visibles       | GET detalle + snapshot                      | válido, vacío, 404, cross-tenant              |
| GPR-03 | Catálogo real, usable y no hardcodeado   | GET permisos paginado + módulo/search       | páginas, búsqueda, agrupación, cero hardcode  |
| GPR-04 | Selección y diff explícitos              | checkbox + snapshot + resumen altas/bajas   | añadir, retirar, combinación, cancelar        |
| GPR-05 | Reemplazo exacto y atómico               | PATCH subrecurso + transacción              | persistencia, rollback, conjunto vacío        |
| GPR-06 | Validación y mass assignment             | Zod strict + consulta única de IDs          | duplicados, inexistente, claves extra         |
| GPR-07 | IDOR y mínimo privilegio                 | scope opaco + subset + system guard         | roleId/org manipulados, autoescalamiento      |
| GPR-08 | Concurrencia sin overwrite               | `expectedUpdatedAt`                         | dos administradores, segundo 409              |
| GPR-09 | Propagación a sesiones                   | resolución DB por request + session query   | añadir/retirar en sesión activa               |
| GPR-10 | Auditoría segura                         | `ROLE_UPDATED` transaccional + diff cerrado | actor/diff/rollback/sin secretos              |
| GPR-11 | UX completa y responsive                 | componentes Ionic existentes                | estados, doble envío, dirty, móvil/escritorio |
| GPR-12 | Compatibilidad sin regresiones           | contratos existentes + invalidación precisa | roles/users/auth/super admin/guards           |

## Criterios de aceptación

- [ ] Un actor con `roles.read`, `roles.manage`, `permisos.read` y alcance abre “Gestionar permisos” desde un rol personalizado y visualiza nombre, descripción y permisos asociados actuales.
- [ ] Un actor con solo `roles.read` puede consultar el rol, pero no ve la acción y un PATCH directo devuelve 403; faltar `permisos.read` impide cargar el catálogo y la ruta dedicada.
- [ ] El catálogo mostrado procede exclusivamente de `GET /api/permisos`; Ionic no contiene UUID, códigos ni listas de permisos hardcodeadas.
- [ ] Los permisos se agrupan por `module`, muestran metadata real y pueden buscarse/cargarse por páginas sin perder selecciones.
- [ ] Se pueden seleccionar permisos nuevos, deseleccionar existentes y revisar por separado altas y bajas antes de guardar.
- [ ] Guardar envía una sola operación de reemplazo completo y persiste exactamente el conjunto permitido, incluido el conjunto vacío.
- [ ] UUID inválido, permiso inexistente/desaparecido, duplicado o campo extra se rechaza en backend sin modificar asociaciones.
- [ ] Un rol inexistente, borrado o de otro tenant responde 404 opaco; cambiar manualmente `roleId` u `organizationId` no produce IDOR.
- [ ] Un actor inferior no modifica roles `isSystem`, no administra un rol con capacidades superiores y no añade a un rol propio permisos que él no posee.
- [ ] El rol global Administrador no es editable ni direccionable desde esta pantalla; no se usan IDs, emails o usernames privilegiados hardcodeados.
- [ ] Reemplazo, `updatedAt` y auditoría son atómicos; cualquier fallo conserva íntegro el estado previo.
- [ ] Dos administradores con el mismo snapshot: el primer guardado gana y el segundo recibe 409, conserva el borrador y puede recargar sin sobrescritura silenciosa.
- [ ] Al retirar un permiso, todos los usuarios del rol dejan de tenerlo desde su siguiente request autenticado; al añadirlo, lo obtienen con el mismo plazo, sin relogin ni privilegios residuales en tokens.
- [ ] El cambio genera `ROLE_UPDATED` con actor, rol, organización, altas y bajas, sin tokens, cookies, secretos ni payload indiscriminado.
- [ ] La pantalla cubre loading, empty, error y success; evita doble envío, muestra progreso/feedback y advierte al salir con cambios pendientes.
- [ ] La experiencia conserva el shell administrativo y componentes Ionic, es táctil y legible en móvil/escritorio y no añade dependencias UI.
- [ ] No existen regresiones en creación/edición/detalle de roles, asignación de roles a usuarios, login web/nativo, sesión, menú, guards ni bootstrap del super admin.

### Contratos y documentación (obligatorio)

- [ ] Se verifica y, solo si está incompleta, se corrige `documentation/schemas/roles-permisos.ts` para documentar GET/PATCH `/roles/{roleId}/permisos`, GET `/permisos`, schemas, security y respuestas 200/400/401/403/404/409/500.
- [ ] El export existente desde `documentation/schemas/index.ts` se conserva y los contratos son visibles/correctos en `GET /api/docs`.
- [ ] `canchago-ionic/spec/constitution/api-integration.md` documenta el consumo dedicado antes de implementar la pantalla.
- [ ] Los DTO/request de Ionic reflejan la respuesta real y `{ permissionIds, expectedUpdatedAt }` sin `any` ni campos supuestos.

## Manejo de errores

- `400 VALIDATION_ERROR`: query/body strict inválido, UUID mal formado, IDs duplicados o claves extra.
- `401 UNAUTHORIZED`: sesión ausente, expirada o revocada; el interceptor limpia la sesión y dirige al login.
- `403 FORBIDDEN`: falta de permisos, rol system, permisos actuales/solicitados superiores o alcance no autorizado sin recurso ya identificado.
- `404 NOT_FOUND`: rol inexistente, borrado o fuera de organización/alcance; mensaje opaco.
- `409 CONFLICT`: `expectedUpdatedAt` obsoleto; se conserva el borrador y se ofrece recargar.
- `422 VALIDATION_ERROR`: se respetará el envelope real si el handler global clasifica así una validación de dominio existente; las pruebas fijarán el código efectivo sin inventar uno distinto.
- `500 INTERNAL_ERROR` o fallo de red: mensaje recuperable y retry manual de lecturas; nunca stack, SQL o detalles Prisma.

## Fuera de alcance

- CRUD, activación, desactivación o borrado de `Permission`.
- Inventar permisos protegidos/asignables, dependencias, exclusiones, jerarquía o matriz CRUD que el modelo no representa.
- Cambiar el modelo de super admin, crear/promover administradores globales o editar roles globales/system por HTTP.
- Renombrar el rol, editar descripción/código, crear o eliminar roles desde la pantalla dedicada.
- Cargar usuarios asociados, mostrar conteos de usuarios o editar `UserRole`.
- Crear endpoints incrementales POST/DELETE para asociaciones; el PATCH atómico existente es suficiente.
- Visor de auditoría, caché Redis nueva, polling de sesión, dependencias UI o cambios de autenticación.
