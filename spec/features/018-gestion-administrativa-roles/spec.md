# 018 · Gestión Administrativa de Roles

**Estado:** implementada con cierre de calidad pendiente por deuda OpenAPI preexistente

## Qué hace

Incorpora al área `/admin` de `canchago-ionic` la gestión administrativa de roles por organización: listado, consulta, creación y edición mediante un único formulario reutilizable. Los roles y permisos proceden siempre de `canchago`; Ionic no mantiene catálogos RBAC hardcodeados ni decide autorización.

La entrega es integrada y backend-first. Antes de habilitar la pantalla se endurecen los contratos existentes de `canchago` para que soporten filtros remotos, validación estricta, escritura atómica, concurrencia optimista, aislamiento por organización, protección de roles de sistema y prevención de escalamiento. No se crea otro CRUD de permisos: `Permission` continúa como catálogo global de solo lectura.

## Por qué

El backend ya expone `/api/roles`, `/api/roles/{roleId}`, `/api/roles/{roleId}/permisos` y `/api/permisos`, mientras que el menú vertical Ionic ya reserva `/admin/roles`; hoy esa ruta muestra `AdminModulePendingPage`. La gestión de usuarios ya consume roles reales, pero no existe una interfaz para definir roles personalizados ni mantener sus permisos.

Exponer sin cambios el contrato actual sería inseguro e inconsistente: cualquier actor con `roles.manage` puede editar un `Role.isSystem`, asignar permisos que él mismo no posee, consultar otra organización si conoce su UUID y sobrescribir cambios concurrentes. Además, los POST/PATCH actuales no son atómicos para rol + permisos, los schemas Zod no son estrictos, el nombre no se normaliza de forma robusta y la unicidad de PostgreSQL distingue mayúsculas/espacios.

## Estado real verificado

### Modelo y relaciones

- `Role`: `id`, `organizationId` nullable, `code`, `name`, `description`, `isSystem`, `createdAt`, `updatedAt`, `deletedAt`; relaciones `permissions: RolePermission[]` y `userRoles: UserRole[]`.
- `Permission`: catálogo global con `id`, `module`, `action`, `code` único, `description`, `createdAt`. No existe CRUD HTTP de permisos.
- `RolePermission`: relación explícita M:N con PK `[roleId, permissionId]` y `granted`.
- `UserRole`: asignación con alcance opcional de organización/sede. No tiene restricción única de usuario/rol/alcance; por ello `_count.userRoles` cuenta asignaciones, no necesariamente usuarios únicos activos.
- `Role` no tiene `status`, `active`, `type`, `priority`, jerarquía ni version. `isSystem` es el único indicador real para distinguir roles internos protegidos.

### Contratos existentes

- `GET /api/roles?organizationId&page&pageSize` requiere `roles.read`, pagina en servidor, filtra `deletedAt: null`, ordena por `createdAt desc` y devuelve `id`, `name`, `description`, `code`, `isSystem`, timestamps y `_count.permissions`. No ofrece búsqueda, orden configurable ni conteo confiable de usuarios.
- `POST /api/roles?organizationId` requiere `roles.manage`; acepta `name`, `description?`, `permissionIds?` y genera `code` desde el nombre.
- `GET/PATCH/DELETE /api/roles/{roleId}?organizationId` requieren `roles.read`/`roles.manage`. El detalle incluye `organizationId` y `permissions[]`.
- `GET/PATCH /api/roles/{roleId}/permisos?organizationId` lista o reemplaza permisos. El GET pagina en memoria después de cargar todas las relaciones.
- `GET /api/permisos?page&pageSize` requiere `permisos.read` y devuelve el catálogo global paginado.
- Los roles globales (`organizationId: null`) como `Administrador` y `Futbolista` nunca aparecen en `/api/roles` porque la consulta exige coincidencia estricta con una organización.
- `middleware/auth.ts` resuelve en cada petición el usuario, roles y permisos desde PostgreSQL. Un cambio de permisos se refleja en las peticiones siguientes sin relogin ni invalidación de token/cookie.
- El super admin real es el rol global `Administrador`, `isSystem: true`, aprovisionado únicamente por `yarn asignar-rol`; no se crea ni degrada por HTTP.

### UI real reutilizable

- `AdminLayout`, `AdminNavigation`, `AdminRoute` y la entrada `/admin/roles` ya existen.
- `AppDataList`, `AppSearchInput`, `AppSelect`, `AppButton`, `AppInput`, `AppSkeleton`, `AppEmptyState`, `AppErrorState`, `AppConfirmDialog`, `PermissionGuard` y los tokens actuales cubren listado, estados, formularios y estilo responsive.
- `src/types/api/roles.ts`, `services/api/endpoints/roles.ts` y `features/roles/hooks/useRoles.ts` ya consumen el listado para gestión de usuarios; deben evolucionar sin romper ese consumidor.
- TanStack Query gestiona estado remoto; React Hook Form + Zod gestionan formularios. No se requieren dependencias nuevas.

## Alcance funcional

### Organización y navegación

- La entrada existente “Roles” abre `/admin/roles`. Para usar el módulo se necesita una organización elegida de un catálogo autorizado; no se acepta un UUID escrito libremente.
- El selector reutiliza el mecanismo de organizaciones existente, pero el backend debe devolver únicamente organizaciones dentro del alcance efectivo del actor. El super admin conserva acceso global mediante su rol real, no por nombre de usuario, email o ID hardcodeado.
- Lista y detalle requieren `roles.read`. Crear y editar requieren `roles.manage`; consultar/asignar el catálogo de permisos requiere además `permisos.read`.
- El menú, las rutas y los botones reflejan permisos efectivos; el backend repite todas las comprobaciones y es la autoridad final.

### Listado

- La lista usa `GET /api/roles` con `organizationId`, `page`, `pageSize`, `search?`, `isSystem?`, `orderBy?` (`name|createdAt|updatedAt`) y `order?` (`asc|desc`). Todos los parámetros son lista blanca Zod y la búsqueda se aplica en servidor con debounce en Ionic.
- Cada fila muestra exclusivamente: nombre, descripción cuando exista, etiqueta “Sistema”/“Personalizado” derivada de `isSystem`, código como dato técnico secundario, conteo real de permisos y fecha de actualización si el diseño necesita contexto.
- No muestra estado/activo porque no existen. Tampoco muestra “usuarios asignados”: el modelo no garantiza unicidad de `UserRole` por alcance y el conteo actual podría ser engañoso. Se difiere hasta definir semántica y constraint de integridad.
- Las acciones son “Consultar” para `roles.read` y “Editar” solo con `roles.manage` y `isSystem === false`. Un rol de sistema es visible pero aparece protegido/de solo lectura.
- Cubre `loading`, `empty`, `error` y `success`; reintenta únicamente GET idempotentes. Cambiar organización, búsqueda, filtro u orden vuelve a página 1. No realiza una petición por fila ni descarga todos los roles.

### Detalle

- `/admin/roles/{roleId}` carga un rol de la organización seleccionada con sus permisos actuales. Un UUID inválido se rechaza localmente para UX y siempre en backend.
- Un rol inexistente, borrado o de otra organización devuelve 404 para no confirmar existencia fuera del alcance. Un actor sin sesión recibe 401 y uno sin permiso recibe 403.
- Los permisos se presentan agrupados por `Permission.module`, usando `code`, `action` y `description` reales; no existe una tabla/lista hardcodeada en Ionic.

### Formulario reutilizable

- `RoleForm` opera en modo `create` y `edit`; ambos comparten campos, validación, selector de permisos, estados y acciones.
- Campos editables: `name` obligatorio, `description` opcional y `permissionIds[]`. `organizationId` pertenece al contexto/query, no al body. `code`, `isSystem`, IDs, timestamps, `deletedAt`, relaciones y conteos son de solo lectura o internos.
- El nombre se recorta, colapsa espacios internos y usa Unicode de letras/números más espacios, guion y guion bajo. Longitud final: 1–150. `description` se recorta, vacío se normaliza a `null`, máximo 500 según la validación API vigente.
- La unicidad es por organización sobre una representación normalizada que ignora mayúsculas y diferencias de espacios. La base de datos, no una comprobación previa aislada, resuelve carreras concurrentes con 409.
- El `code` se genera una sola vez al crear, de forma determinista y validada, y permanece inmutable al renombrar. Esto evita romper `RoleGuard`, seeds, registro, scripts o referencias existentes por cambios de nombre. No se acepta `code` en el payload público.
- El catálogo usa `GET /api/permisos` paginado, sin una llamada por permiso. La UI carga hasta 100 por página y permite cargar páginas adicionales; conserva selecciones ya persistidas y agrupa por módulo. Si se añade búsqueda remota al catálogo, se mantiene el mismo endpoint y lista blanca.
- Crear o editar acepta solo permisos reales. IDs inexistentes, duplicados o manipulados se rechazan antes de escribir. Para un actor que no sea el Administrador global, tanto los permisos actuales del rol como el conjunto solicitado deben ser subconjunto de sus permisos efectivos; así no puede modificar un rol superior ni otorgarse capacidades indirectamente.
- `Role.isSystem === true` significa rol de sistema y protegido: es consultable si está en el alcance, pero ningún endpoint HTTP de esta feature permite renombrarlo, cambiar descripción/permisos o borrarlo, incluso con `roles.manage`. Su mantenimiento permanece en seeds/scripts controlados.
- Guardar deshabilita controles y acción primaria mientras hay una mutación; un submit produce una sola petición. Cancelar o salir con cambios pendientes solicita confirmación usando el patrón compatible ya existente.

### Escritura, concurrencia y consistencia

- Crear rol y asignar permisos ocurre en una única transacción. Si cualquier permiso es inválido o la escritura falla, no queda un rol parcial.
- Editar datos y reemplazar permisos ocurre en una única transacción. El body incluye `expectedUpdatedAt` recibido en el detalle; una versión obsoleta responde 409 y no sobrescribe datos.
- Una actualización exclusiva de permisos también actualiza `Role.updatedAt` dentro de la misma transacción para que el control optimista cubra todo el agregado.
- El backend construye explícitamente el objeto de escritura; schemas `.strict()` rechazan mass assignment. `organizationId`, `roleId`, `code`, `isSystem`, `deletedAt`, timestamps y objetos anidados enviados en body producen 400.
- La autorización scoped verifica el `organizationId` contra `UserRole.organizationId`/alcance efectivo del actor, o el rol global Administrador. Cambiar query/path/body no permite IDOR ni acceso cross-tenant.
- Al cambiar permisos no se invalidan cookies/tokens: la sesión persistente ya recompone roles/permisos desde base en cada request. Después del commit se invalidan únicamente queries Ionic de lista, detalle y catálogo afectadas.

### Auditoría

- No existe hoy `AuditLog`. Antes de considerar la feature lista para producción debe incorporarse auditoría durable para `ROLE_CREATED` y `ROLE_UPDATED` con actor, organización, rol, fecha y cambios de campos/permisos (IDs o códigos añadidos/removidos), sin tokens, cookies ni datos sensibles.
- El diseño de auditoría se añade de forma aditiva y transaccional con la escritura del rol. La migración no se ejecuta hasta reconciliar la deriva conocida de `20260630185000_add_roles_permissions_fields`.
- Pino puede registrar metadatos operativos (`actorId`, `organizationId`, `roleId`, acción), pero no sustituye el registro durable.

## Requisitos trazables

| ID     | Requisito verificable                        | Diseño principal                                          | Pruebas mínimas                                   |
| ------ | -------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------- |
| GAR-01 | Acceso desde menú y rutas administrativas    | navegación existente + `RolesModule`                      | menú, deep link, 401/403                          |
| GAR-02 | Roles siempre desde backend por organización | GET paginado + selector autorizado                        | lista con/sin datos, cambio de org, cero hardcode |
| GAR-03 | Búsqueda, tipo, orden y paginación remotos   | query Zod + DB paginada                                   | filtros/lista blanca/meta                         |
| GAR-04 | Detalle coherente y aislado por tenant       | GET por id + scope guard + 404 opaco                      | válido, UUID inválido, cross-tenant               |
| GAR-05 | Un único formulario create/edit              | `RoleForm` + Zod                                          | ambos modos, defaults, dirty state                |
| GAR-06 | Nombre/código consistentes y únicos          | normalización + constraints + code inmutable              | espacios/caso/Unicode/duplicado/carrera           |
| GAR-07 | Solo permisos reales y permitidos            | catálogo global + validación transaccional + subset guard | IDs válidos/inválidos/duplicados/escalamiento     |
| GAR-08 | Roles system permanecen protegidos           | `isSystem` + guard central                                | lectura permitida, PATCH/DELETE bloqueados        |
| GAR-09 | Escrituras atómicas y sin mass assignment    | transacción + schemas strict + mapper explícito           | rollback y claves protegidas                      |
| GAR-10 | Concurrencia no sobrescribe silenciosamente  | `expectedUpdatedAt`                                       | dos editores, segundo 409                         |
| GAR-11 | Usuarios asociados ven permisos actuales     | sesión server-side existente                              | permiso agregado/retirado en siguiente request    |
| GAR-12 | UX completa, responsive y sin doble envío    | componentes existentes + TanStack Query                   | loading/empty/error/success, móvil/escritorio     |
| GAR-13 | Auditoría durable y segura                   | registro transaccional de cambios                         | actor/acción/diff, rollback, sin secretos         |
| GAR-14 | Sin regresiones en usuarios/auth/super admin | contratos compatibles + code inmutable                    | suites backend/Ionic y flujos críticos            |

## Criterios de aceptación

- [ ] Un actor con `roles.read` y alcance válido abre “Roles” desde el menú y obtiene `/admin/roles`; sin sesión o permiso, deep link y request directo terminan en 401/403 sin datos.
- [ ] Los roles mostrados provienen exclusivamente de `GET /api/roles`; no hay nombres, IDs ni permisos hardcodeados en Ionic.
- [ ] La lista pagina en servidor y aplica búsqueda, filtro `isSystem` y orden solo con valores permitidos; no hay N+1 ni petición por fila.
- [ ] La lista muestra solo campos reales acordados y omite estado y conteo de usuarios por no existir una semántica confiable actual.
- [ ] `loading`, `empty`, `error` y `success` son visibles y accesibles; un retry GET no duplica mutaciones.
- [ ] “Nuevo rol” solo aparece con `roles.manage`; abre el mismo `RoleForm` usado para editar.
- [ ] Edición carga nombre, descripción, versión y permisos actuales; cancelar/salir con cambios pendientes advierte al usuario.
- [ ] Nombre vacío, demasiado largo, con caracteres no admitidos o duplicado normalizado se rechaza; la carrera de duplicado termina en 409.
- [ ] El backend ignora cero campos: toda clave fuera de la lista blanca se rechaza con 400 y no cambia datos internos.
- [ ] Solo se guardan IDs de permisos reales, únicos y autorizados; una manipulación no puede asignar capacidades inexistentes ni superiores a las del actor.
- [ ] Un actor de menor privilegio no puede editar un rol cuyos permisos excedan los suyos ni usar un rol que ya posee para autoelevarse.
- [ ] Los roles `isSystem` se pueden consultar cuando pertenecen al alcance, pero no renombrar, cambiar permisos, desactivar ni borrar por HTTP.
- [ ] El rol global Administrador no aparece como rol organizacional, no se crea/promueve desde Ionic y conserva el bootstrap protegido de la feature backend 015.
- [ ] Un `roleId` inexistente, borrado o de otra organización responde 404; manipular `organizationId` no permite IDOR.
- [ ] Creación y edición de datos/permisos son atómicas; fallo parcial deja el estado anterior intacto.
- [ ] Dos administradores editando la misma versión: el primero guarda y el segundo recibe 409 con opción de recargar, sin sobrescritura silenciosa.
- [ ] Doble envío queda prevenido y, tras éxito, TanStack Query actualiza/invalida únicamente lista, detalle y catálogos afectados; no recarga la app completa.
- [ ] Agregar o retirar permisos se refleja en usuarios asociados desde su siguiente request autenticado, sin relogin y sin privilegios residuales en el token.
- [ ] Cada creación/edición produce auditoría durable transaccional sin secretos; fallar la auditoría revierte la escritura.
- [ ] La interfaz conserva el shell vertical y el estilo actual, usa una columna táctil en móvil y aprovecha el ancho en escritorio sin densidad excesiva.
- [ ] No hay regresiones en login web/nativo, sesión, gestión/asignación de usuarios, guards, super admin ni registro público.

### Contratos y documentación obligatorios

- [ ] Los cambios de request/response se registran en `canchago/documentation/schemas/roles-permisos.ts` con `registry.registerComponent()` y `registry.registerPath()`; el export existente desde `documentation/schemas/index.ts` se conserva.
- [ ] `GET /api/docs` muestra query params, DTOs y respuestas 200/201/400/401/403/404/409/500 reales.
- [ ] `canchago-ionic/spec/constitution/api-integration.md` se actualiza antes de consumir el contrato endurecido.
- [ ] Los tipos en `src/types/api/roles.ts` reflejan el contrato real, incluido `expectedUpdatedAt`, sin `any` ni campos supuestos.

## Manejo de errores

- `400 VALIDATION_ERROR`: UUID/query/body inválido, nombre/formato, claves extra, IDs de permiso duplicados.
- `401 UNAUTHORIZED`: sesión ausente, expirada o revocada; el interceptor limpia sesión/token y vuelve a login.
- `403 FORBIDDEN`: falta de permiso, actor sin alcance, intento de editar rol protegido o de administrar capacidades superiores. Para recursos cross-tenant ya identificados se prefiere 404 opaco.
- `404 NOT_FOUND`: rol inexistente, soft-deleted o fuera de organización/alcance.
- `409 CONFLICT`: nombre/code normalizado duplicado o `expectedUpdatedAt` obsoleto.
- `500 INTERNAL_ERROR`: fallo inesperado o de red; nunca expone Prisma, SQL, stack ni detalle de auditoría.

## Fuera de alcance

- Eliminar, restaurar, activar o desactivar roles. DELETE existente no se expone en Ionic y debe bloquear roles system; su endurecimiento de seguridad puede implementarse, pero no es una acción de esta pantalla.
- CRUD de permisos, permisos dependientes/incompatibles o jerarquía numérica: no existen reglas/modelos reales que los sostengan.
- Mostrar roles globales o promover super admins por HTTP.
- Mostrar un conteo de “usuarios asignados” hasta definir usuario único/estado/alcance y agregar la integridad necesaria a `UserRole`.
- Editar `code`, `isSystem`, `organizationId`, timestamps, soft delete o campos internos.
- Auditoría administrativa navegable; esta feature registra eventos, no construye su visor.
- Refactorizar dominios ajenos, añadir librerías UI o cambiar autenticación.
