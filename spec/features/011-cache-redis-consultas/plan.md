# 011 · Caché Redis para Consultas Frecuentes — Plan

_Cómo se implementará lo descrito en `spec.md`. Esta entrega crea únicamente el plan; no modifica código productivo._

## Enfoque

Adoptar **cache-aside en la capa de servicios**: cada servicio consulta el helper compartido antes de invocar su repositorio y llena Redis solo después de obtener un resultado exitoso. Este patrón encaja con el flujo `API Route → servicio → database → Prisma`, preserva PostgreSQL como fuente de verdad y permite que un error de Redis degrade de forma transparente.

No se elige read-through porque requeriría un proveedor que conozca cómo ejecutar cada consulta o una capa paralela de repositorios, inexistente hoy. Tampoco se elige write-through: las escrituras deben confirmar primero en PostgreSQL y después invalidar generaciones; escribir Redis dentro de la transacción no sería atómico entre ambos sistemas. No se usa middleware HTTP como dueño del caché porque las invalidaciones y dependencias entre roles, permisos y usuarios pertenecen al servicio. `middleware/cache.ts`, previsto por la constitución, puede limitarse en el futuro a política HTTP/diagnóstico, sin lógica de negocio ni claves específicas de dominio.

## Arquitectura objetivo

```text
API Route
  │ auth + access + Zod (siempre)
  ▼
Servicio ── cache-aside ──► lib/cache ──► Redis
  │               miss/error │
  ▼                          │ hit
database/ ──► Prisma ──► PostgreSQL
  │
  └─ escritura confirmada ──► servicio incrementa generaciones
```

Para autenticación se mantiene `database/sessions.findActive(sessionId)` en cada petición. Solo `database/users.getSessionUser(userId)`, que retorna identidad de presentación, roles y permisos, queda detrás de cache-aside mediante `sessionService.resolve()`. Redis nunca recibe `sealedTokens` ni `SessionPayload.tokens`.

## Implementación futura

1. **Baseline y selección final** — Instrumentar temporalmente o mediante tests/benchmarks las consultas objetivo: frecuencia, p50/p95, número de queries, tamaño de respuesta y cardinalidad de claves. Confirmar prioridad alta; habilitar prioridad media solo con beneficio medible.

2. **`lib/config/env.ts` y `.env.example`** — Agregar y validar las variables Redis/caché definidas en `spec.md`. `CACHE_ENABLED=false` debe ser un modo soportado. No acceder a `process.env` fuera de este módulo; al implementar, corregir el acceso directo actual de `lib/logger/index.ts` solo si resulta imprescindible y mediante una tarea separable.

3. **`lib/cache/client.ts`** — Crear una única instancia `ioredis` reutilizable, con lazy connection, timeouts acotados, listeners sin secretos, política que no reintente indefinidamente dentro de una solicitud y cierre controlado para tests/proceso. Reutilizar la dependencia existente; no agregar paquetes.

4. **`lib/cache/key.ts`** — Implementar canonicalización determinista, SHA-256 nativo de Node, prefijos versionados, variantes y lectura de generaciones. El builder recibe valores tipados ya validados; no recibe `NextApiRequest` ni query params crudos.

5. **`lib/cache/serializer.ts`** — Definir la envoltura versionada, serializar fechas como ISO UTC y validar con Zod al deserializar. No cachear `undefined`, errores, respuestas parciales ni instancias Prisma.

6. **`lib/cache/cache-aside.ts`** — Exponer una operación genérica tipada equivalente a:

   ```text
   getOrLoad(policy, context, load)
     si disabled/no-cacheable/circuit-open → bypass y load()
     construir clave canónica y leer Redis
     si entrada válida → hit
     si entrada inválida → borrar best effort y continuar como miss
     intentar SET lock token NX PX
       adquirido → load(), SET EX con TTL+jitter, liberar lock comparando token
       no adquirido → espera con jitter, relee; agotado → load() sin escribir o escritura condicionada
     cualquier error Redis → log/métrica y load()
   ```

   El lock se libera con comparación atómica de token (script Lua pequeño o comando equivalente) para no borrar el lock de otro proceso. La función `load()` conserva sus errores originales; nunca se cachean `404`, `401`, `403`, `409`, `422` ni `500`.

7. **`lib/cache/invalidation.ts`** — Implementar generaciones por ámbito (`global`, `organization`, `venue`, `role`, `user`) mediante `INCR`, sin `KEYS`/`SCAN`. Definir invalidación best effort posterior al commit y métricas específicas. Las generaciones tendrán una vida superior al TTL máximo o persistencia explícita con un procedimiento documentado de reinicio.

8. **`lib/cache/metrics.ts` y `lib/logger/index.ts`** — Añadir una interfaz interna de contadores/histogramas y eventos Pino estructurados. Sin incorporar un backend de métricas nuevo. Redactar clave, valores, filtros, identidad y secretos.

9. **`services/auth/session.service.ts` y `database/users/index.ts`** — Envolver únicamente `getSessionUser(userId)` con política `access-snapshot`. Mantener `sessionDb.findActive()` y `unsealTokens()` fuera de Redis. Invalidar el namespace del usuario después de cambios de perfil/estado, asignación o revocación de roles, cambios de rol y cambios de permisos.

10. **`services/roles-permisos/permission.service.ts`** — Aplicar cache-aside a `getPermissions(page, pageSize)` con namespace global RBAC y TTL de catálogo. `validatePermissionIds()` permanece directa por defecto porque participa en escrituras; solo se cacheará si una medición separada lo justifica y nunca aceptará datos obsoletos para validar integridad.

11. **`services/roles-permisos/role.service.ts`** — Aplicar cache-aside a `getRoles()` y `getRoleById()`. Hacer que la proyección paginada de permisos reutilice el DTO de detalle o una política explícita. Tras create/update/delete/asignación de permisos, incrementar las generaciones de organización/rol y las de usuarios afectados.

12. **`pages/api/roles/[roleId]/permisos/index.ts`** — Antes de cachear esta ruta, mover el acceso directo actual a `rolePermissionDb.assignPermissionsToRole()` detrás de un servicio del dominio, de acuerdo con la constitución. La API Route solo valida, llama al servicio y responde.

13. **`services/organizaciones-sedes/organizacion.service.ts` y `sede.service.ts`** — Habilitar prioridad media únicamente si el baseline lo aprueba. Aplicar claves con organización, autorización, búsqueda, orden y paginación efectivos. Invalidar detalle, colecciones y relaciones después de create/update/remove; el borrado de organización invalida también sus sedes.

14. **`services/users/`** — Centralizar las operaciones de asignación/revocación hoy reexportadas directamente desde `database/users` para que toda mutación de `UserRole` invalide el snapshot de acceso. No habilitar caché para endpoints GET de usuarios hasta resolver el filtro `organizationId` ignorado y el alcance multi-tenant en una feature aprobada.

15. **API Routes y permisos** — Mantener `auth` y `access()` antes de cualquier servicio cacheado. El contexto de claves se deriva de `req.user` ya autenticado y de datos Zod, pero se transforma en un objeto de dominio antes de llegar al helper. No agregar rutas nuevas ni cambiar respuestas.

16. **`documentation/schemas/auth.ts`, `roles-permisos.ts`, `organizaciones-sedes.ts` e `index.ts`** — No cambiar schemas de negocio. Documentar solo cualquier header diagnóstico que se apruebe; debe estar deshabilitado en producción o restringido a operadores. Verificar todos los paths existentes en `GET /api/docs`.

17. **Tests** — Añadir unitarios junto a `lib/cache/` y servicios, e integración en `tests/integration/cache/` o archivos de módulo existentes. Usar un Redis aislado para integración y dobles controlables para fallos; no depender de datos o DB compartidos.

18. **Despliegue gradual** — Desplegar primero con `CACHE_ENABLED=false`, validar conexión y observabilidad, activar snapshot de acceso y catálogo RBAC, luego roles y finalmente candidatos medios. Cada política debe poder deshabilitarse sin despliegue destructivo si se detectan datos obsoletos o baja efectividad.

## Pseudoflujos de invalidación

### Escritura simple

```text
service.update(resourceId, input)
  result = database.record(resourceId).update(input)
  try increment generations(resource, collection, tenant)
  catch log cache_invalidation_error
  return result
```

### Cambio RBAC con usuarios derivados

```text
service.replaceRolePermissions(roleId, permissionIds)
  transaction:
    validar rol y organización
    obtener userIds asignados al rol
    reemplazar RolePermission
  después del commit:
    incrementar generation(roleId, organizationId)
    incrementar generation de cada userId afectado
  return rol actualizado desde fuente o repoblar mediante lectura normal
```

### Lectura con protección anti-stampede

```text
service.get(query, authorizationContext)
  context = normalize(query defaults + tenant + auth fingerprint)
  return cache.getOrLoad(policy, context, () => database.get(query))
```

## Contratos internos propuestos

- `CachePolicy<T>` — nombre, variante, versión de schema, TTL, ámbitos de generación, schema Zod y regla `isCacheable`.
- `CacheContext` — identificadores de dominio, tenant, usuario, fingerprint de autorización y query normalizada; nunca contiene tokens.
- `CacheResult` — valor de dominio más estado interno `hit | miss | bypass`; el estado no forma parte del body HTTP.
- `CacheInvalidator` — operaciones tipadas para incrementar generaciones globales y por entidad.
- `CacheMetrics` — contadores e histogramas desacoplados de un proveedor externo.

Estos contratos viven en `lib/cache/` y no conocen HTTP, Prisma ni servicios concretos.

## Decisiones

- **Cache-aside en servicios** — Encaja con las capas existentes, permite fallback y mantiene las reglas/invalidation cerca del dominio. Se descartan read-through y write-through por requerir infraestructura paralela o coordinación no atómica.
- **Sesión activa siempre en PostgreSQL** — Conserva logout y expiración inmediatos. Solo se cachea el snapshot no sensible de acceso, con invalidación dirigida.
- **Autorización antes del caché** — Un hit nunca evita `auth` ni `access`; el fingerprint y tenant protegen respuestas dependientes del contexto.
- **Generaciones en lugar de borrado por patrón** — Evitan `KEYS`/`SCAN`, reducen colisiones e invalidan colecciones de cardinalidad desconocida en O(1) por ámbito.
- **Hash canónico SHA-256** — Previene claves ambiguas, oculta filtros/PII y evita dependencias nuevas. La versión y variante permanecen legibles para operar.
- **TTL con jitter y lock distribuido** — Reduce expiraciones sincronizadas y stampede. La espera es corta; la disponibilidad de la API tiene prioridad sobre maximizar el hit ratio.
- **No negative caching inicial** — Evita prolongar errores y estados 404 tras una creación; podrá evaluarse posteriormente con contrato e invalidación propios.
- **Sin headers públicos obligatorios** — El caché es transparente. La observabilidad vive en logs/métricas; cualquier header diagnóstico requiere control explícito y OpenAPI.

## Riesgos

- **Autorización obsoleta** — Un usuario podría conservar permisos revocados. Mitigación: invalidación de snapshots para todos los usuarios afectados, verificación de sesión en DB, TTL de 30 s y pruebas de revocación concurrente.
- **Aislamiento multi-tenant incompleto** — Una clave sin organización o alcance podría filtrar datos. Mitigación: builders tipados que exigen tenant/fingerprint según política, pruebas cruzadas y exclusión temporal de usuarios.
- **Invalidación parcial tras commit** — Redis puede fallar después de una escritura exitosa. Mitigación: no revertir DB, log/métrica de severidad, TTL acotado y runbook para incrementar generación global.
- **Stampede o lock huérfano** — Un proceso puede morir durante recomputación. Mitigación: `SET NX PX`, token de propietario, liberación atómica, TTL corto, espera limitada y fallback.
- **Alta cardinalidad** — Búsquedas libres y fingerprints pueden producir pocas reutilizaciones. Mitigación: métricas por política, límites Zod existentes, no cachear consultas de baja repetición y presupuestos de memoria.
- **Payload incompatible** — Un despliegue puede leer datos de otra versión. Mitigación: prefijo/versionado, schema Zod y miss seguro.
- **Redis lento amplifica latencia** — Mitigación: connect/command timeout cortos, lazy connection, bypass y circuit breaker simple basado en fallos consecutivos si las mediciones lo requieren.
- **Baseline del repositorio** — La feature 010 registra permisos inconsistentes, deriva de migraciones y build roto. Mitigación: no mezclar esas correcciones; resolverlas antes de declarar 011 implementada y comparar resultados contra un baseline conocido.
