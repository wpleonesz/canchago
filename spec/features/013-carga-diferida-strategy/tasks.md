# 013 · Carga Diferida mediante Strategy — Tareas

_Checklist accionable derivada del `plan.md`. Todas permanecen pendientes porque esta entrega es exclusivamente documental._

## Baseline y contratos

- [ ] Capturar responses actuales de list/detail/create/update para usuarios y roles.
- [ ] Medir queries, filas, memoria, bytes y p50/p95 con 1, 20 y 100 relaciones.
- [ ] Confirmar que `detailed` predeterminado reproduce exactamente cada detalle actual.
- [ ] Inventariar campos de UserResponse, Role, RoleDetail y subrecursos.
- [ ] Confirmar que no existen bloques de estadísticas, archivos o cálculos que justifiquen estrategias adicionales.
- [ ] Crear fixtures contractuales del default actual con claves, nulabilidad, arrays, orden, status y errores.

## Validaciones

- [ ] Crear enum compartido `basic | detailed` con default `detailed`.
- [ ] Integrarlo en schema de GET usuario por ID.
- [ ] Integrarlo en schema de GET rol por ID junto con organizationId.
- [ ] Rechazar valor desconocido, array, duplicado o nombre arbitrario con 422 estándar.
- [ ] No aceptar detailLevel en POST/PATCH/DELETE si el método no lo documenta.
- [ ] Inferir tipos desde Zod y evitar strings duplicados sin tipo.

## DTO y proyecciones de usuarios

- [ ] Definir UserBasic y UserDetailed sin campos sensibles.
- [ ] Separar `selectUserBasicFields` de `selectUserDetailedFields`.
- [ ] Basic carga User + Profile y omite UserRole.
- [ ] Detailed carga roles con id/code/name y omite permisos/sesiones/AuthAccount.
- [ ] `GET /api/users` usa proyección basic y deja de recuperar roles omitidos.
- [ ] Create/update mantienen DTO detailed vigente.
- [ ] Crear consulta específica para subrecurso de roles sin cargar usuario completo.

## Strategy de usuarios

- [ ] Crear contrato tipado sin HTTP ni Prisma.
- [ ] Crear `userBasicStrategy` y `userDetailedStrategy`.
- [ ] Crear registry readonly/exhaustivo por DetailLevel.
- [ ] Autorizar contexto y tenant antes de cargar.
- [ ] Mapear a objetos planos; no retornar records Prisma.
- [ ] Seleccionar en userService y conservar NotFoundError vigente.
- [ ] Mantener una estrategia interna fija para escrituras/subrecursos.

## DTO y proyecciones de roles

- [ ] Definir RoleBasicDetail y RoleDetailed según OpenAPI real.
- [ ] Basic filtra roleId, organizationId, deletedAt y selecciona escalares.
- [ ] Detailed añade RolePermission/Permission con campos exactos.
- [ ] Omitir users, organization completa, menus y otras relaciones.
- [ ] Mantener `_count.permissions` únicamente en listado.
- [ ] Mantener detailed fijo para create/update mientras el contrato lo requiera.
- [ ] Coordinar subrecurso paginado de permisos con la feature N+1.

## Strategy de roles

- [ ] Crear `roleBasicStrategy` y `roleDetailedStrategy`.
- [ ] Crear registry readonly/exhaustivo.
- [ ] Exigir roles.read y mismo organizationId.
- [ ] Mover cualquier Prisma directo necesario desde service a database antes de integrar Strategy.
- [ ] Seleccionar estrategia solo en GET detalle.
- [ ] Conservar 404 para rol borrado, inexistente o fuera del tenant.

## API Routes y autorización

- [ ] GET user detail valida path/query, construye accessContext y llama servicio.
- [ ] GET role detail valida roleId/organizationId/detailLevel con Zod.
- [ ] Mantener auth y access antes de estrategias.
- [ ] No pasar NextApiRequest/Response al servicio o estrategia.
- [ ] Sin permiso base, devolver 403 antes de cargar datos.
- [ ] Bloque conocido no permitido devuelve 403 sin fallback silencioso.
- [ ] Recurso ajeno/tenant distinto devuelve 404 sin filtrar existencia.
- [ ] Confirmar que una estrategia rechazada no ejecuta su consulta detallada.

## Composición y límites

- [ ] No implementar expand/fields/include/full en el alcance inicial.
- [ ] Mantener profundidad máxima 1.
- [ ] Mantener listados basic y pageSize ≤ 100.
- [ ] Usar subrecursos paginados para relaciones crecientes.
- [ ] Definir extensión futura con máximo 2 bloques allowlisted solo cuando existan.
- [ ] Cargar relaciones futuras por lote usando IDs de página.
- [ ] Ejecutar Promise.all solo para consultas independientes y dentro del presupuesto.
- [ ] Materializar todas las lecturas antes de cerrar transacción/responder.

## Consultas y serialización

- [ ] User basic y Role basic usan máximo 1 llamada Prisma de dominio.
- [ ] Detailed usa máximo 2 y mantiene conteo constante con 1/20/100 relaciones.
- [ ] No ejecutar queries dentro de loops, mappers o serializers.
- [ ] No repetir consulta base al cargar detalle.
- [ ] No acceder a Prisma después de cerrar `$transaction`.
- [ ] No serializar accidentalmente relaciones/campos fuera del DTO.
- [ ] Medir filas/materialización para detectar producto cartesiano.

## Caché, observabilidad y rendimiento

- [ ] Incluir detailLevel en claves/namespaces si la caché se implementa.
- [ ] Evitar compartir entradas basic/detailed.
- [ ] Loguear requestId, módulo, estrategia, query count, filas, duración y bytes.
- [ ] No registrar DTO, email, cookies, tokens o permisos completos.
- [ ] Medir selección por estrategia y rechazos 403/422.
- [ ] Comparar p50/p95/p99 y response size basic vs detailed.
- [ ] Confirmar que basic reduce relaciones/bytes sin degradar el default detailed.

## Pruebas unitarias

- [ ] Selector usa detailed al faltar detailLevel.
- [ ] Selector resuelve basic/detailed correctos y nunca imports/nombres arbitrarios.
- [ ] Registry es exhaustivo y falla de forma controlada si falta configuración interna.
- [ ] Basic DTO omite roles/permisos.
- [ ] Detailed DTO contiene solo campos documentados.
- [ ] authorize bloquea permiso/tenant incorrectos.
- [ ] Mappers no invocan repositorio ni mutan records.
- [ ] Estrategias propagan NotFound/AppError controlados.

## Pruebas de integración

- [ ] GET user sin selector conserva response detallada actual.
- [ ] GET user basic omite roles y no consulta UserRole.
- [ ] GET user detailed incluye roles mínimos.
- [ ] List users no carga ni serializa roles.
- [ ] GET role sin selector conserva RoleDetail actual.
- [ ] GET role basic omite permissions.
- [ ] GET role detailed incluye permisos autorizados del tenant.
- [ ] Selector inválido devuelve 422 con details Zod.
- [ ] Sin auth devuelve 401; sin permiso 403; tenant ajeno 404.
- [ ] POST/PATCH/DELETE conservan contrato y no aceptan selección accidental.
- [ ] Basic/detailed no exponen sesiones, AuthAccount, passwordHash u otras relaciones.

## Pruebas de consultas y rendimiento

- [ ] Contar Q_domain separado de auth/cache.
- [ ] Verificar conteo constante con 1, 20 y 100 roles de usuario.
- [ ] Verificar conteo constante con 1, 20 y 100 permisos de rol.
- [ ] Confirmar ausencia de N+1 y consultas duplicadas.
- [ ] Confirmar que list users reduce filas/bytes frente al baseline sobrecargado.
- [ ] Comparar p95 y memoria con tolerancia documentada de CI.
- [ ] Detectar consultas equivalentes duplicadas entre carga base y detallada.
- [ ] Verificar crecimiento proporcional de filas y ausencia de producto cartesiano.
- [ ] Verificar cero consultas después de cerrar una transacción o iniciar serialización.

## Gates de riesgos y dependencias

- [ ] Compatibilidad: detailLevel omitido coincide exactamente con fixtures JSON/OpenAPI previos.
- [ ] Autorización: completar matriz actor × permiso × tenant × estrategia con 401/403/404 esperados.
- [ ] N+1: cumplir `Q_domain(1) = Q_domain(20) = Q_domain(100)` por estrategia.
- [ ] Sobreconsulta: basic reduce relaciones, filas y bytes sin alterar campos obligatorios.
- [ ] Duplicación: ninguna estrategia vuelve a consultar un recurso ya materializado innecesariamente.
- [ ] Consistencia: bloques que requieren snapshot común se materializan dentro de la misma transacción.
- [ ] Escalabilidad: rechazar nuevas estrategias sin consumidor, DTO, permiso, costo y presupuesto aprobados.
- [ ] Feature N+1: no componer subrecursos hasta que paginen en DB y cumplan presupuesto.
- [ ] Caché: si está activa, separar claves/schema por detailLevel, tenant y autorización.
- [ ] Colas: excluir del registry cualquier cálculo o archivo que exceda el SLA síncrono.
- [ ] Deuda técnica: resolver o aislar permisos inconsistentes, organizationId y Prisma directo en service.
- [ ] Registrar evidencia de cierre para cada riesgo crítico antes de marcar la feature como implementada.

## Documentación OpenAPI (obligatorio)

- [ ] Registrar UserBasic y UserDetailed en `documentation/schemas/users.ts`.
- [ ] Registrar RoleBasicDetail y RoleDetailed en `documentation/schemas/roles-permisos.ts`.
- [ ] Documentar detailLevel enum/default/ejemplos en ambos GET de detalle.
- [ ] Documentar respuestas basic/detailed de forma explícita sin cambiar default.
- [ ] Mantener listados, escrituras y subrecursos sin expansiones inexistentes.
- [ ] Confirmar exportaciones desde `documentation/schemas/index.ts`.
- [ ] Verificar schemas, security y errores en `GET /api/docs`.

## Cierre

- [ ] Ejecutar `yarn lint && yarn typecheck && yarn test && yarn build`, separando deuda previa de regresiones.
- [ ] Validar todos los criterios de aceptación de `spec.md`.
- [ ] Ejecutar comparación de contratos antes/después con detailLevel omitido.
- [ ] Confirmar revisión de autorización, tenant, consultas y campos sensibles.
- [ ] Revisar la tabla de riesgos de `spec.md` y adjuntar evidencia de cada condición de cierre.
- [ ] Confirmar que ninguna dependencia bloqueante quedó implícita o diferida sin aislamiento probado.
- [ ] Actualizar `../../constitution/roadmap.md` solo tras implementar y verificar.

## Mantenimiento (checklist recurrente)

- [ ] Toda nueva estrategia declara DTO, permiso, tenant, queries, profundidad y presupuesto.
- [ ] No añadir bloque/expand hasta confirmar fuente y consumidor reales.
- [ ] Reevaluar límites al crecer relaciones o cambiar Prisma/OpenAPI.
- [ ] Vigilar distribución de estrategias, p95, query count, filas y response bytes.
