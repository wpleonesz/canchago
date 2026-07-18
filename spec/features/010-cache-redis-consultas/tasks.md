# 011 · Caché Redis para Consultas Frecuentes — Tareas

_Checklist accionable derivada del `plan.md`. Todas permanecen pendientes porque esta entrega es exclusivamente documental._

## Preparación y baseline

- [ ] Resolver o aislar los defectos de la feature 010 antes de implementar y registrar un baseline de lint, tipos, tests y build.
- [ ] Medir frecuencia, p50/p95, consultas SQL, tamaño y cardinalidad para snapshot de acceso, permisos, roles, organizaciones y sedes.
- [ ] Confirmar como candidatos los de prioridad alta y documentar la evidencia de inclusión/exclusión de cada candidato medio.
- [ ] Verificar que los listados de usuarios siguen excluidos hasta corregir el filtro `organizationId` y el alcance de `UserRole`.

## Configuración y cliente Redis

- [ ] Documentar variables `REDIS_*` y `CACHE_*` sin secretos en `.env.example`.
- [ ] Validar todas las variables con Zod en `lib/config/env.ts`, incluidos límites de TTL, jitter y timeouts.
- [ ] Crear `lib/cache/client.ts` con una sola conexión `ioredis`, lazy connect, timeouts, listeners redactados y cierre para tests.
- [ ] Garantizar que `CACHE_ENABLED=false` arranca y opera sin conexión Redis.
- [ ] Confirmar que no se agrega ninguna dependencia ni cliente Redis por petición.

## Claves, serialización y políticas

- [ ] Crear builder de claves con prefijo, entorno, versión, módulo, recurso, variante, generaciones y SHA-256 de contexto canónico.
- [ ] Canonicalizar filtros, arrays, roles, permisos, valores por defecto, orden, página y límite.
- [ ] Exigir por tipos `organizationId`, `venueId`, `userId` y/o `authorizationFingerprint` en las políticas que correspondan.
- [ ] Crear envoltura JSON versionada y schemas Zod para deserialización segura.
- [ ] Serializar fechas como ISO 8601 UTC y probar que el DTO conserva el contrato actual.
- [ ] Tratar JSON corrupto, versión desconocida o schema inválido como miss y eliminar la entrada best effort.
- [ ] Prohibir por política el almacenamiento de sesiones, tokens, cookies, credenciales, errores y payloads no aprobados.

## Cache-aside y resiliencia

- [ ] Implementar `getOrLoad()` tipado con hit, miss, bypass, write y fallback transparente.
- [ ] Aplicar TTL por política y jitter aleatorio de ±10 % con límites validados.
- [ ] Implementar lock `SET NX PX` con token único y liberación atómica por propietario.
- [ ] Implementar espera/relectura con jitter y máximo `CACHE_LOCK_WAIT_MS`; nunca bloquear indefinidamente.
- [ ] Verificar que fallos de GET, SET, INCR, lock, conexión o timeout recurren a la fuente original.
- [ ] No cachear errores, resultados parciales ni fallos del loader.
- [ ] Evaluar circuit breaker liviano solo si las pruebas muestran que timeouts repetidos afectan latencia.

## Invalidación

- [ ] Implementar generaciones globales y por organización, sede, rol y usuario sin `KEYS` ni `SCAN`.
- [ ] Invalidar únicamente después del commit exitoso de PostgreSQL.
- [ ] Invalidar colecciones/detalles de organizaciones tras POST, PATCH y DELETE.
- [ ] Invalidar colecciones/detalles de sedes tras POST, PATCH y DELETE; cubrir cascada por eliminación de organización.
- [ ] Invalidar colecciones/detalles/permisos de roles tras POST, PATCH, DELETE y reemplazo de permisos.
- [ ] Obtener e invalidar snapshots de todos los usuarios afectados por cambios de rol o permisos.
- [ ] Invalidar el snapshot del usuario tras crear, actualizar, desactivar, asignar, reemplazar o remover roles.
- [ ] Definir procedimiento de incremento de generación global RBAC después de cambios del catálogo por seed/despliegue.
- [ ] Registrar y medir fallos de invalidación sin revertir una escritura ya confirmada.

## Integración por capas

- [ ] Integrar caché del snapshot en `sessionService.resolve()` sin cachear `sessionDb.findActive()`, `sealedTokens` ni tokens desellados.
- [ ] Integrar catálogo paginado en `permissionService.getPermissions()`; mantener validaciones de escritura contra fuente confiable.
- [ ] Integrar listado y detalle en `roleService`, reutilizando el detalle para la proyección paginada de permisos cuando corresponda.
- [ ] Mover la asignación directa de permisos desde la API Route a un servicio antes de añadir invalidación.
- [ ] Centralizar mutaciones `UserRole` hoy reexportadas desde `database/users` para invalidar en servicios.
- [ ] Integrar organizaciones y sedes solo si cumplen los umbrales medidos.
- [ ] Mantener API Routes libres de consultas Prisma, claves, locks e invalidación de dominio.
- [ ] Mantener `auth` y `access()` antes de toda lectura cacheada.

## Observabilidad

- [ ] Registrar eventos Pino estructurados para hit, miss, bypass, error, write, invalidate y lock wait.
- [ ] Incluir `requestId`, política/recurso, latencias y key ID no reversible; excluir valores, filtros sensibles, cookies y tokens.
- [ ] Implementar contadores de hit/miss/bypass/error/write/invalidation/locks y histogramas de Redis, loader, espera y tamaño.
- [ ] Calcular hit ratio y beneficio por política para permitir deshabilitar candidatos ineficientes.
- [ ] Documentar un runbook mínimo para Redis caído, alta latencia, datos obsoletos e invalidación global.

## Pruebas unitarias

- [ ] Claves iguales para contextos semánticamente iguales aunque cambie el orden de propiedades/arrays.
- [ ] Claves distintas por módulo, recurso, variante, versión, tenant, usuario, rol/permisos, filtros, orden y paginación.
- [ ] Los valores por defecto normalizados producen la misma clave que sus equivalentes explícitos.
- [ ] Serialización/deserialización conserva DTOs y fechas; corrupción/versionado inválido produce miss.
- [ ] Hit no invoca loader; miss lo invoca una vez y escribe; bypass lo invoca sin leer/escribir Redis.
- [ ] TTL y jitter permanecen dentro de límites.
- [ ] Errores de Redis recurren al loader y preservan su respuesta/error original.
- [ ] Solo el dueño libera el lock; lock expirado no queda huérfano.
- [ ] Invalidadores incrementan exactamente los ámbitos relacionados después de una escritura exitosa.
- [ ] Redacción de logs impide exponer tokens, cookies, password, email, búsqueda o valor cacheado.

## Pruebas de integración

- [ ] Primer GET elegible produce miss y consulta PostgreSQL; segundo GET equivalente produce hit y evita las consultas objetivo.
- [ ] Variaciones de filtros, orden, página y pageSize no comparten entradas incorrectas.
- [ ] Dos organizaciones con parámetros iguales reciben datos aislados.
- [ ] Dos usuarios/roles con permisos efectivos distintos no comparten respuestas dependientes de autorización.
- [ ] `PATCH`/`DELETE` de organización o sede impide servir detalles/listados anteriores.
- [ ] `POST` de organización, sede o rol aparece en colecciones previamente cacheadas.
- [ ] Cambio de permisos de rol invalida detalle, permisos paginados y snapshots de usuarios asignados.
- [ ] Asignar/remover rol a un usuario cambia su autorización sin esperar el TTL ni requerir re-login.
- [ ] Logout y sesión expirada siguen devolviendo 401 aunque exista snapshot de acceso cacheado.
- [ ] Una respuesta 404/403/422/500 no se almacena.
- [ ] Redis detenido antes o durante la solicitud conserva códigos y bodies de la fuente original.
- [ ] Redis recuperado vuelve a aceptar misses/writes sin reiniciar la API.

## Pruebas de concurrencia, expiración y rendimiento

- [ ] N solicitudes simultáneas sobre una clave fría provocan un único recomputador normal y ninguna espera indefinida.
- [ ] Si el recomputador falla o pierde el lock, las demás solicitudes degradan de forma acotada a PostgreSQL.
- [ ] Al expirar el TTL, la siguiente lectura refresca el dato; el jitter distribuye expiraciones masivas.
- [ ] Una invalidación concurrente con una carga no permite que una escritura tardía repueble una generación obsoleta como vigente.
- [ ] Benchmark antes/después demuestra reducción de queries y mejora de p95 para cada política activada.
- [ ] Prueba de cardinalidad/memoria confirma que búsquedas libres no consumen Redis sin beneficio.

## Documentación OpenAPI (obligatorio)

_El caché es transparente y no cambia los contratos de negocio._

- [ ] Mantener schemas y respuestas existentes sin agregar campos internos de caché.
- [ ] Si se aprueba un header diagnóstico, documentarlo en cada path afectado y restringirlo fuera de producción o a operadores.
- [ ] Confirmar las exportaciones existentes en `documentation/schemas/index.ts`.
- [ ] Verificar en `GET /api/docs` que auth, permisos, roles, organizaciones y sedes conservan ejemplos, security y códigos de respuesta.

## Despliegue y recuperación

- [ ] Desplegar con `CACHE_ENABLED=false` y validar configuración/conectividad sin afectar tráfico.
- [ ] Activar gradualmente snapshot de acceso, permisos, roles y después candidatos medios aprobados.
- [ ] Probar rollback mediante bypass/configuración sin borrar datos de PostgreSQL.
- [ ] Probar recuperación tras reinicio o pérdida completa de Redis: todas las lecturas se reconstruyen desde la fuente.
- [ ] Definir alertas operativas sobre error rate, hit ratio, latencia, locks e invalidación cuando exista backend de métricas.

## Cierre

- [ ] Ejecutar `yarn lint && yarn typecheck && yarn test && yarn build` y distinguir cualquier fallo preexistente de una regresión.
- [ ] Validar todos los criterios de aceptación de `spec.md`.
- [ ] Confirmar mediante revisión de seguridad que Redis no contiene sesiones, tokens, cookies, secretos ni respuestas sin aislamiento.
- [ ] Verificar que no se introdujeron rutas, modelos, migraciones o dependencias innecesarias.
- [ ] Mover la feature 011 a "Hecho" en `../../constitution/roadmap.md` solo después de implementar y verificar todo lo anterior.

## Mantenimiento (checklist recurrente)

- [ ] Revisar hit ratio, p95, cardinalidad, memoria y tasa de errores por política.
- [ ] Reevaluar TTL e invalidaciones al agregar filtros, relaciones, permisos o escrituras a un módulo cacheado.
- [ ] Incrementar versión de clave/schema antes de desplegar un DTO incompatible.
- [ ] Someter cada nuevo candidato a análisis de sensibilidad, costo, repetición, aislamiento e invalidación antes de habilitarlo.
