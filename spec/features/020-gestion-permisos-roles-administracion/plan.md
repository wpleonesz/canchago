# 020 · Gestión de Permisos Asociados a Roles — Plan

_Cómo se implementa lo descrito en `spec.md`. Debe respetar la `constitution/` de ambos repositorios._

## Enfoque

Implementar una vista Ionic dedicada sobre contratos backend ya existentes. El snapshot del agregado proviene del detalle del rol, el catálogo global del endpoint paginado de permisos y el guardado reutiliza el PATCH de reemplazo completo con optimistic locking. No se modifica el schema Prisma ni se crea un endpoint o permiso administrativo nuevo salvo que las pruebas de caracterización demuestren una divergencia respecto del contrato verificado.

La implementación se hace backend-first: primero se fijan con pruebas las garantías de seguridad/atomicidad aún pendientes de la feature 018 y la documentación OpenAPI; después se añade el cliente, la ruta y la UX Ionic.

## Implementación

1. **Preflight en ambos repositorios** — Preservar cambios ajenos; releer las guías locales de Next.js 16.2.9 aplicables a Pages API Routes antes de cualquier cambio backend. Confirmar scripts reales de `package.json` y que no se requiere migración/dependencia.
2. **Caracterización del contrato** — Añadir pruebas sobre GET detalle, GET `/permisos` y PATCH `/roles/{roleId}/permisos` para fijar envelopes, códigos reales y semántica de reemplazo antes de modificar consumidores.
3. **`validations/roles-permisos/permission.validation.ts`** — Reutilizar `updateRolePermissionsSchema`; conservar array UUID único, máximo 500, `expectedUpdatedAt` y `.strict()`. No aceptar `roleId`, `organizationId`, `granted` ni objetos Permission en body.
4. **`database/roles-permisos/role.db.ts`** — Reutilizar la consulta por rol/organización y `replacePermissions` dentro del transaction client. Verificar por prueba que valida todos los IDs en una consulta, elimina/crea dentro de la misma transacción, toca `updatedAt` y no deja cambios parciales.
5. **`services/roles-permisos/role.service.ts`** — Reutilizar `updateRole`; mantener scope opaco, bloqueo `isSystem`, validación del catálogo dentro de transacción, subconjunto de permisos actuales+solicitados para actor no Administrador y conflicto por versión. No desplazar reglas a la API Route.
6. **`pages/api/roles/[roleId]/permisos/index.ts`** — Conservar `auth`, `roles.read` en GET y `roles.manage` en PATCH, validación query/body y delegación al servicio. No añadir lógica de negocio ni Prisma.
7. **Sesión/autorización** — Añadir prueba de integración que asigne un rol a usuarios, conceda/revoque un permiso y confirme que `middleware/auth`/`sessionService.resolve` refleja el cambio en el siguiente request para todos, sin rotar token/cookie.
8. **Auditoría** — Probar que el PATCH produce `ROLE_UPDATED` con diff de códigos, actor/organización/rol correctos y que un fallo de auditoría revierte asociaciones y versión. No registrar payload ni credenciales.
9. **`documentation/schemas/roles-permisos.ts`** — Verificar los componentes y paths existentes. Corregir solo divergencias del PATCH dedicado: body cerrado, `expectedUpdatedAt`, reemplazo total, permisos requeridos y respuestas efectivas. Conservar export desde `documentation/schemas/index.ts`.
10. **`canchago-ionic/spec/constitution/api-integration.md`** — Registrar el flujo dedicado, requisitos combinados y propagación de sesión antes de integrar UI.
11. **`canchago-ionic/src/types/api/roles.ts`** — Añadir `UpdateRolePermissionsRequest` y la respuesta real reutilizando `RoleDetailDto`; no duplicar `PermissionDto` ni alterar shapes usados por gestión de usuarios.
12. **`canchago-ionic/src/services/api/endpoints/roles.ts`** — Añadir `updateRolePermissions(roleId, organizationId, body)` para PATCH del subrecurso. Reutilizar `mapRoleDetail`; ningún Axios fuera de esta capa.
13. **`canchago-ionic/src/features/roles/hooks/useRoles.ts`** — Añadir mutación sin retry. En éxito, escribir el detalle retornado e invalidar de forma precisa listas de roles; si el rol pertenece al usuario actual, invalidar `SESSION_QUERY_KEY` (es seguro invalidarla siempre tras este cambio sensible).
14. **Selector reutilizable** — Extraer de `RoleForm` un componente como `RolePermissionSelector` que reciba snapshot/selección, agrupe por `module`, conserve selecciones entre páginas/búsquedas y use `IonCheckbox`. Mantener compatibilidad del formulario create/edit de la feature 018.
15. **Búsqueda y catálogo** — Extender el hook del catálogo para query key por `search/module` y páginas de hasta 100. Usar `AppSearchInput` con debounce; combinar metadata del snapshot con páginas del catálogo sin duplicar IDs ni perder permisos ya asignados.
16. **Diff de permisos** — Implementar una función pura que derive IDs/permisos añadidos y retirados desde sets inicial/actual. Mostrar ambos grupos con nombres/description/action/code reales; no derivar reglas de negocio en cliente.
17. **`PermissionManagementPage.tsx`** — Orquestar detalle, catálogo, snapshot `updatedAt`, selector, resumen, guardado/cancelación, feedback y estados loading/empty/error/success. Roles system muestran estado protegido y no formulario editable.
18. **Concurrencia y errores** — Para 409 conservar selección local y ofrecer “Recargar permisos actuales”; para 401 usar interceptor; para 403/404 mensajes opacos/coherentes; para red/500 permitir reintentar GET y reintento manual de PATCH.
19. **Dirty state/doble envío** — Reutilizar `Prompt` + `AppConfirmDialog`; bloquear selector y submit con `isPending/isSubmitting`; limpiar dirty únicamente tras respuesta exitosa o recarga confirmada.
20. **`RolesModule.tsx`** — Registrar `/admin/roles/:roleId/permissions` antes de la ruta de detalle genérica, con `requiredPermissions=['roles.read','roles.manage','permisos.read']` y `requireAllPermissions`.
21. **`RoleDetailPage.tsx` y `RoleListItem.tsx`** — Añadir la acción “Gestionar permisos” solo para roles no system y capacidades efectivas requeridas. Si la fila queda densa en móvil, dejarla únicamente en detalle; la accesibilidad desde detalle satisface el contrato.
22. **Estilos** — Reutilizar `roles.css`, tokens y componentes estandarizados por la feature Ionic 011. Layout apilado/táctil en móvil, grid moderado en escritorio, dark mode, safe areas y reduced motion; sin tabla horizontal ni dependencia nueva.
23. **Pruebas frontend** — Vitest + Testing Library para ruta/guards, catálogo, agrupación/búsqueda/paginación, diff, selección, roles system, dirty warning, doble submit, 200/401/403/404/409/500, invalidación y regresión de `RoleForm`.
24. **Pruebas integradas/E2E** — Con la infraestructura existente, cubrir detalle → gestionar → añadir/retirar → guardar → autorización efectiva; URL/payload manipulado, sesión expirada y viewports móvil/escritorio. No inventar Cypress/Playwright si no existe en el repo al implementar: usar los comandos reales confirmados en preflight.
25. **Calidad y cierre** — Backend e Ionic: `yarn lint && yarn typecheck && yarn test && yarn build`; verificar `GET /api/docs`. Ejecutar `yarn cap:sync` y builds nativos solo si se toca código/configuración nativa (no previsto).
26. **Roadmaps** — Actualizar ambos roadmaps únicamente cuando toda la implementación y sus gates estén completos; no mover 020 a Hecho por crear esta spec.

> La documentación OpenAPI se corrige en el mismo cambio que cualquier ajuste de contrato; no se difiere al final.

## Matriz requisito → diseño → tareas

| Requisito | Diseño                                      | Tareas                   |
| --------- | ------------------------------------------- | ------------------------ |
| GPR-01    | ruta dedicada + acciones + guards all       | 17, 20–21, 23–24         |
| GPR-02    | detalle como snapshot completo              | 2, 11–13, 17, 23–24      |
| GPR-03    | catálogo persistido paginado/search/module  | 2, 10–15, 23–24          |
| GPR-04    | selector reutilizable + función diff        | 14, 16–19, 23–24         |
| GPR-05    | PATCH reemplazo + transacción               | 2, 4–6, 12–13, 23–24     |
| GPR-06    | schema strict + validación IDs              | 2–6, 9, 23–24            |
| GPR-07    | scope/subset/system + guards UI             | 2, 5–6, 17, 20–24        |
| GPR-08    | `expectedUpdatedAt` + UX 409                | 2, 4–6, 11–13, 18, 23–24 |
| GPR-09    | sesión resuelta desde DB + invalidación     | 7, 13, 23–24             |
| GPR-10    | auditoría en transacción                    | 4–5, 8–9, 24             |
| GPR-11    | estados/Ionic/dirty/doble submit/responsive | 14–19, 22–25             |
| GPR-12    | reutilización + suites de regresión         | 1–2, 10–15, 21, 23–26    |

## Decisiones

- **Feature 020 vive en `canchago` y planifica ambos repositorios** — El backend posee el contrato y las garantías de seguridad; Ionic aporta la superficie administrativa integrada.
- **Pantalla dedicada, contrato existente** — Se añade claridad de UX sin duplicar reglas ni endpoints. Se descarta reutilizar PATCH general del rol porque el subrecurso ya expresa mejor la intención.
- **Reemplazo completo** — Coincide con el backend, facilita diff/auditoría y mantiene atomicidad. Se descartan altas/bajas incrementales por riesgo de estados parciales.
- **Detalle como snapshot editable** — Incluye todas las asociaciones y `updatedAt`; evita perder un permiso asignado que no aparezca aún en una página del catálogo. El GET paginado del subrecurso permanece compatible.
- **Sin permiso administrativo nuevo** — `roles.manage` y `permisos.read` son las capacidades reales. Agregar `roles.permissions.manage` exigiría seed, migración operativa y política no aprobada.
- **Todo Permission persistido es potencialmente asignable** — El schema no tiene flags de protección/estado. La asignabilidad real se limita por rol system y subconjunto del actor; no se infieren listas ocultas.
- **`isSystem` es la protección crítica** — No hay niveles o IDs especiales. El super admin global queda además fuera del scope de roles organizacionales.
- **Propagación en el siguiente request** — La autorización no está embebida en el bearer/cookie; se reconstruye desde DB. La invalidación de `SESSION_QUERY_KEY` acelera coherencia visual, no reemplaza la seguridad servidor.
- **Catálogo cacheable, snapshot no obsoleto al guardar** — TanStack Query puede mantener el catálogo; el optimistic lock protege el agregado contra edición concurrente.
- **Sin migración ni dependencia** — Los modelos, PK, auditoría, transacción y componentes necesarios ya existen.

## Riesgos

- **Solapamiento con el editor de la feature 018** — Dos UIs podrían divergir. Mitigación: extraer un selector compartido y mantener tests de ambos consumidores.
- **Catálogo mayor a una página** — Una carga parcial puede omitir opciones o selecciones. Mitigación: snapshot completo del rol, infinite query, búsqueda remota y deduplicación por ID.
- **Permiso retirado operativamente entre carga y guardado** — Mitigación: validar todos los IDs dentro de la transacción, devolver error controlado y conservar borrador/estado previo.
- **Actor pierde capacidad durante la edición** — La sesión se recompone en cada request; el PATCH vuelve a autorizar y rechaza. La UI maneja 403/401 sin confiar en el snapshot local.
- **Rol propio y escalamiento indirecto** — Mitigación: subset de permisos actuales y solicitados, además de `roles.manage`, probado explícitamente.
- **El bypass Administrador depende de código de rol** — Es comportamiento central existente y no se amplía. Mitigación: nunca replicarlo en Ionic; pruebas de regresión de bootstrap/super admin.
- **Códigos HTTP históricos 400/422** — La taxonomía del handler puede diferir de specs antiguas. Mitigación: tests de caracterización y documentación del resultado real antes de ajustar UX.
- **Deuda OpenAPI/build preexistente** — Puede bloquear el gate global sin ser causada por 020. Mitigación: registrar evidencia y no declarar la feature terminada hasta que ambos builds estén verdes.
- **Worktree Ionic con cambios concurrentes** — Mitigación: preservar cambios ajenos, revisar diffs antes de editar y coordinar si coinciden con `RoleDetailPage`/componentes compartidos.
