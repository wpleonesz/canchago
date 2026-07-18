# 012 · Prevención de Consultas N+1 — Tareas

_Checklist accionable derivada del `plan.md`. Todas las tareas permanecen pendientes porque esta entrega es solo documental._

## Baseline e inventario

- [ ] Registrar versión/configuración de Prisma y estrategia de carga de relaciones aplicable.
- [ ] Crear helper de tests que separe `Q_auth` de `Q_domain` usando la única instancia de Prisma.
- [ ] Medir llamadas Prisma, SQL, tiempo DB, filas/materialización y memoria con 1, 20 y 100 elementos.
- [ ] Inventariar todos los `await` dentro de bucles, `map(async)`, consultas por ID y relaciones anidadas de API, servicios y database.
- [ ] Clasificar cada caso como constante sano, N+1 confirmado, sobreconsulta o riesgo futuro.
- [ ] Guardar un presupuesto explícito por endpoint y justificar cualquier excepción.

## Caso confirmado: roles de usuario

- [ ] Definir en Zod el límite máximo del lote y comportamiento de `roleIds` duplicados.
- [ ] Crear consulta agrupada de roles por `id in (...)` y alcance aprobado.
- [ ] Comparar IDs solicitados/encontrados y conservar errores 404/422/409 definidos.
- [ ] Crear inserción `createMany` transaccional que agregue sin reemplazar roles existentes.
- [ ] Exponer `addRolesToUser` desde el servicio, sin reexportar la operación DB unitaria.
- [ ] Eliminar el bucle con `await userService.addRoleToUser()` de la API Route.
- [ ] Recargar una sola vez la proyección exacta de respuesta.
- [ ] Verificar máximo de 4 operaciones de dominio para 1, 20 y 100 IDs.

## Listados y DTO de usuarios

- [ ] Verificar que `GET /api/users` mantiene `findMany + count` constante.
- [ ] Comparar `selectUserFields` con `UserResponseSchema` y eliminar solo campos realmente sobrantes.
- [ ] Mantener carga 1:1 de perfil y roles solo en endpoints cuyo DTO los necesita.
- [ ] Crear proyección específica de roles de usuario si reduce amplitud sin duplicar lógica.
- [ ] Verificar que serializers/mappers no realizan acceso a base de datos.
- [ ] Mantener paginación, búsqueda, ordenamiento, permisos y formato de respuesta.

## Roles y permisos

- [ ] Mantener `_count.permissions` en `GET /api/roles`; no cargar permisos completos.
- [ ] Proyectar en detalle de rol únicamente campos de `RoleDetailSchema`.
- [ ] Crear consulta paginada `RolePermission` por `roleId` con relación `Permission` selectiva.
- [ ] Añadir `count` filtrado y orden estable para metadata del subrecurso.
- [ ] Sustituir `.slice()` sobre todos los permisos por paginación en PostgreSQL.
- [ ] Mover el PATCH de permisos detrás del servicio antes de tocar su consulta directa a database.
- [ ] Verificar que asignación de permisos conserva `deleteMany + createMany` transaccional y constante.

## Autenticación y relaciones profundas

- [ ] Medir `getSessionUser()` por separado como `Q_auth` y confirmar pendiente cero por número de roles/permisos.
- [ ] Seleccionar solo campos necesarios de User, Profile, Role y Permission para `SessionUser`.
- [ ] Verificar que la estrategia no genera una consulta por rol o permiso.
- [ ] Medir filas y memoria para detectar producto cartesiano aunque el query count sea constante.
- [ ] Si se separan cargas, agrupar por IDs y ensamblar mediante `Map` en O(n + r).
- [ ] Mantener comprobación de sesión, revocación y permisos sin cambios funcionales.

## Organizaciones y sedes

- [ ] Confirmar `findMany + count` constante en ambos listados para páginas 1, 20 y 100.
- [ ] Mantener `organizationId`, soft delete, filtros y orden en las consultas.
- [ ] Evitar incluir sedes en organizaciones o organización en sedes mientras el DTO no lo requiera.
- [ ] Añadir pruebas de presupuesto que fallen ante futuras consultas por elemento.

## Límites y consistencia

- [ ] Mantener `pageSize <= 100` en todos los listados existentes.
- [ ] Limitar y deduplicar explícitamente arrays usados en `in`/`createMany` según contrato.
- [ ] No cargar más de una colección no acotada en una consulta sin análisis del plan/filas.
- [ ] No paginar en memoria relaciones potencialmente crecientes.
- [ ] Ejecutar escrituras indivisibles dentro de `prisma.$transaction`.
- [ ] Decidir por endpoint si colección + count requieren snapshot transaccional consistente.
- [ ] Confirmar que no se agrega SQL crudo, dependencia, PrismaClient o acceso DB fuera de `database/`.

## Observabilidad

- [ ] Emitir métricas `queryCount`, `queryDurationMs`, `dbDurationMs`, filas seguras y `pageSize` por request/módulo.
- [ ] Incluir `requestId`, ruta normalizada y operación en logs diagnósticos.
- [ ] Emitir warning al superar el presupuesto o detectar crecimiento con `pageSize`.
- [ ] No registrar parámetros SQL, emails, tokens, cookies, credenciales ni payloads sensibles.
- [ ] Limitar instrumentación detallada a tests/desarrollo o muestreo seguro en producción.
- [ ] Documentar cómo actualizar un baseline después de cambiar Prisma.

## Pruebas unitarias

- [ ] Ensamblaje por lotes conserva orden y representa padres sin relaciones.
- [ ] Agrupación con `Map` no duplica padres ni hijos.
- [ ] Proyecciones contienen exactamente los campos requeridos por DTO.
- [ ] Validación de lote rechaza límite excedido, UUID inválido y duplicados según contrato.
- [ ] IDs inexistentes se detectan en una consulta agrupada.
- [ ] Errores Prisma de integridad se traducen a errores controlados.
- [ ] Ningún mapper/serializer invoca repositorios o Prisma.

## Pruebas de integración

- [ ] `GET /api/users` usa un número constante de consultas con 1, 20 y 100 registros.
- [ ] `GET /api/organizaciones` y sedes mantienen conteo constante con filtros/orden/paginación.
- [ ] `GET /api/roles` mantiene `_count` y no carga permisos completos.
- [ ] Detalle de rol carga permisos sin una consulta por permiso.
- [ ] Subrecurso de permisos materializa como máximo `pageSize` registros y devuelve total correcto.
- [ ] Roles de usuario se leen sin consulta por rol.
- [ ] Asignar 1, 20 y 100 roles mantiene máximo 4 operaciones de dominio y atomicidad.
- [ ] Un rol inválido provoca rollback completo, sin asignaciones parciales.
- [ ] Usuarios/organizaciones distintos conservan aislamiento y permisos.
- [ ] Respuestas 401, 403, 404, 409 y 422 mantienen formato vigente.

## Pruebas de rendimiento

- [ ] Crear datasets controlados de 1, 20 y 100 padres con relaciones 1:1, 1:N y M:N.
- [ ] Comparar p50/p95, SQL count, tiempo DB, filas y memoria antes/después.
- [ ] Afirmar `Q_domain(1) = Q_domain(20) = Q_domain(100)` para cada flujo optimizado.
- [ ] Verificar ausencia de 100 viajes adicionales al aumentar la colección a 100.
- [ ] Detectar productos cartesianos mediante filas transferidas/materializadas.
- [ ] Usar query count como gate determinista y latencia con tolerancia documentada de CI.

## Documentación OpenAPI (obligatorio)

_La optimización es interna y no añade contratos._

- [ ] Verificar schemas existentes en `documentation/schemas/users.ts`.
- [ ] Verificar schemas existentes en `documentation/schemas/roles-permisos.ts`.
- [ ] Verificar schemas existentes en `documentation/schemas/organizaciones-sedes.ts`.
- [ ] Confirmar que no se exponen métricas ni campos internos en responses.
- [ ] Confirmar exportaciones desde `documentation/schemas/index.ts`.
- [ ] Verificar paths, schemas, ejemplos, security y errores en `GET /api/docs`.

## Cierre

- [ ] Ejecutar `yarn lint && yarn typecheck && yarn test && yarn build`, separando fallos preexistentes de regresiones.
- [ ] Validar todos los criterios de aceptación de `spec.md`.
- [ ] Comparar contratos HTTP/OpenAPI antes y después.
- [ ] Confirmar que no se cambiaron paginación, filtros, orden, permisos o aislamiento.
- [ ] Actualizar `../../constitution/roadmap.md` y mover 012 a "Hecho" únicamente después de implementar y verificar.

## Mantenimiento (checklist recurrente)

- [ ] Auditar cada nuevo listado o relación con tamaños 1, 20 y máximo permitido.
- [ ] Revisar todo nuevo `await` dentro de bucles y justificarlo o agruparlo.
- [ ] Actualizar presupuestos solo con evidencia al cambiar Prisma, DTO o estrategia de carga.
- [ ] Vigilar simultáneamente query count, filas, memoria y p95; no optimizar una métrica degradando las demás.
