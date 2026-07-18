# 011 · Caché Redis para Consultas Frecuentes

**Estado:** propuesta

## Qué hace

Incorpora una capa de caché distribuida con Redis para reducir consultas repetidas a PostgreSQL en lecturas protegidas de alta frecuencia o costo comprobable. La respuesta HTTP conserva exactamente su contrato actual: ante un `cache hit` se devuelve el dato cacheado; ante un `cache miss`, un `cache bypass`, una entrada inválida o Redis no disponible se consulta la fuente original y el endpoint continúa funcionando.

La selección inicial se limita a rutas y consultas que existen hoy. No convierte automáticamente todos los `GET` en cacheables ni almacena cookies, tokens OAuth, sesiones selladas, credenciales o errores.

## Por qué

Cada petición protegida ejecuta `sessionService.resolve()`, que consulta la sesión activa y luego reconstruye el usuario con roles y permisos mediante relaciones anidadas. Además, los catálogos y listados RBAC ejecutan consultas repetidas y, en varios casos, un `findMany` más un `count`. Redis e `ioredis` ya forman parte del stack y de las dependencias, pero todavía no existen `lib/cache/` ni `middleware/cache.ts` en el código productivo.

Una estrategia explícita evita añadir caché de forma indiscriminada, servir datos entre tenants o usuarios incorrectos, congelar revocaciones y permisos, o convertir una caída de Redis en una caída de la API.

## Análisis de candidatos reales

| Prioridad | Ruta o lectura real | Costo y variabilidad observados | Decisión inicial |
|---|---|---|---|
| Alta | Snapshot de acceso generado por `database/users.getSessionUser(userId)` para toda ruta protegida | Relación `User → UserRole → Role → RolePermission → Permission` en cada petición | Cachear únicamente usuario, roles y permisos no sensibles por `userId`; no cachear la sesión ni sus tokens |
| Alta | `GET /api/permisos?page&pageSize` | Catálogo global, paginado, dos consultas (`findMany` + `count`) y baja frecuencia de cambio | Cachear por página y límite |
| Alta | `GET /api/roles?organizationId&page&pageSize` | Listado por tenant, paginado, `_count` de permisos y dos consultas | Cachear por organización, autorización, página y límite |
| Alta | `GET /api/roles/{roleId}?organizationId` | Incluye todos los permisos del rol | Cachear por organización, rol y autorización |
| Alta | `GET /api/roles/{roleId}/permisos?organizationId&page&pageSize` | Reutiliza el detalle completo del rol y pagina en memoria | Reutilizar la entrada de detalle del rol o una proyección derivada; no duplicar una fuente incoherente |
| Media | `GET /api/organizaciones` y `GET /api/organizaciones/{organizationId}` | Listado paginado con búsqueda/orden y detalle con soft delete | Cachear con TTL menor y contexto de autorización; medir antes y después |
| Media | `GET /api/organizaciones/{organizationId}/sedes` y detalle de sede | Listado paginado por tenant con búsqueda/orden y detalle con soft delete | Cachear por organización, sede, filtros y autorización; medir antes y después |
| Diferida | `GET /api/users`, detalle y roles del usuario | Contiene PII y roles; el filtro `organizationId` aceptado por Zod no se aplica en `database/users.getAll()` | No cachear listados ni detalles hasta corregir aislamiento/contrato en otra feature; el snapshot de acceso sí queda cubierto como estructura interna mínima |
| Excluida | `GET /api/auth/session` y `database/sessions.findActive()` | Contiene datos de sesión y gobierna revocación/expiración inmediata | No cachear sesión, `sealedTokens` ni tokens; PostgreSQL sigue siendo autoridad en cada petición |
| Excluida | `GET /api/docs/spec` | Ya mantiene un caché en memoria del proceso | No duplicar en Redis |

La inclusión definitiva de los candidatos de prioridad media requiere una medición reproducible de volumen, latencia y consultas. Si no se acredita beneficio, permanecen sin caché aunque la infraestructura esté disponible.

## Escenarios funcionales

### Cache hit

1. La solicitud supera autenticación, autorización y validación existentes.
2. Se construye una clave con los parámetros normalizados y el contexto de acceso.
3. Redis devuelve una envoltura válida y compatible con la versión actual.
4. La API responde con el mismo cuerpo y código HTTP que la fuente original, sin ejecutar la consulta cacheada a PostgreSQL.

### Cache miss

1. Redis no contiene una entrada utilizable.
2. Un único solicitante adquiere un lock corto por clave y consulta el servicio/repositorio actual.
3. El resultado exitoso se serializa, se guarda con TTL y jitter, y se devuelve.
4. Los solicitantes concurrentes esperan de forma acotada y releen; si no aparece el dato, consultan la fuente original sin bloquear indefinidamente.

### Cache bypass

La aplicación omite lectura y escritura de caché cuando la feature está deshabilitada, Redis está en período de recuperación, la operación no es cacheable, el contexto de autorización está incompleto o una política interna de diagnóstico activa el bypass. El bypass no se expone como query param público ni permite al cliente alterar claves o TTL.

### Redis no disponible

Los timeouts, errores de conexión, deserialización o escritura se registran y contabilizan. La solicitud continúa contra PostgreSQL. Un fallo de caché nunca cambia una respuesta exitosa por `500`, nunca relaja autenticación/autorización y nunca devuelve una entrada corrupta.

## Contrato de clave

Formato lógico versionado:

```text
canchago:<entorno>:v1:<módulo>:<recurso>:<variante>:<generation>:<sha256(canonicalContext)>
```

`canonicalContext` es JSON estable, con propiedades ordenadas y valores ya normalizados por Zod. Según el recurso incluye:

- `resourceId`, `organizationId` y `venueId` cuando existan.
- `userId` para snapshots personales o respuestas cuyo contenido sea específico del usuario.
- IDs/códigos de roles ordenados y un hash de permisos efectivos ordenados (`authorizationFingerprint`) cuando la respuesta dependa del acceso.
- `search` normalizado, filtros explícitos, `orderBy`, `order`, `page` y `pageSize` efectivos, incluidos sus valores por defecto.
- Una `variant` para diferenciar colección, detalle, proyección o snapshot de acceso.

El hash SHA-256 evita claves extensas y no expone búsquedas, correos ni contexto de autorización en texto claro. El prefijo, versión, módulo, recurso y variante evitan colisiones semánticas. Nunca se usa el orden recibido de objetos o arrays como fuente de identidad sin canonicalizar.

Las generaciones son contadores de namespace en Redis, por ejemplo globales, por organización, por usuario o por recurso. Una escritura incrementa las generaciones afectadas y vuelve inalcanzables las entradas anteriores sin usar `KEYS` ni `SCAN` en el camino de la solicitud. Su TTL debe ser mayor que el máximo TTL de datos; si una generación falta, se inicializa de forma segura.

## Expiración

Todos los TTL se configuran y validan desde `lib/config/env.ts`; ningún endpoint define valores arbitrarios. Valores iniciales propuestos, sujetos a medición:

| Grupo | TTL base | Motivo |
|---|---:|---|
| Snapshot de roles/permisos del usuario | 30 s | Alta frecuencia, pero impacto directo en autorización |
| Catálogo global de permisos | 10 min | Baja mutabilidad |
| Roles y permisos de rol | 2 min | Lectura frecuente y cambios administrativos poco frecuentes |
| Organizaciones y sedes | 60 s | Datos administrativos con cambios ocasionales |
| Lock anti-stampede | 3 s | Solo coordinación; nunca almacena el dato |

Cada entrada aplica jitter aleatorio de ±10 % para evitar expiraciones simultáneas. No hay TTL infinito. La expiración natural complementa, pero no sustituye, la invalidación después de escrituras exitosas.

## Serialización y deserialización

La entrada usa una envoltura JSON versionada con `schemaVersion`, `storedAt`, `expiresAt` y `data`. Solo se cachean DTOs de respuesta o snapshots explícitos, no instancias Prisma ni errores. Las fechas se serializan como ISO 8601 UTC y el consumidor conserva el contrato HTTP vigente. Al leer, Zod valida la envoltura y el payload esperado; una versión desconocida, JSON inválido o estructura incompatible se trata como `cache miss`, se elimina de forma best effort y se consulta la fuente original.

## Invalidación

La invalidación ocurre únicamente después de que la escritura o transacción en PostgreSQL finaliza con éxito. Si la invalidación falla, la escritura no se revierte: se registra el incidente y el TTL limita la inconsistencia.

| Escritura existente | Namespaces que se invalidan |
|---|---|
| `POST /api/organizaciones` | Colecciones de organizaciones |
| `PATCH` o `DELETE /api/organizaciones/{organizationId}` | Detalle de organización, colecciones de organizaciones, colecciones/detalles de sus sedes; en delete también cualquier namespace dependiente del tenant |
| `POST /api/organizaciones/{organizationId}/sedes` | Colecciones de sedes de la organización |
| `PATCH` o `DELETE /api/organizaciones/{organizationId}/sedes/{sedeId}` | Detalle de sede y colecciones de sedes de la organización |
| `POST /api/roles` | Colecciones de roles de la organización |
| `PATCH` o `DELETE /api/roles/{roleId}` | Detalle/permisos del rol, colecciones de roles de la organización y snapshots de los usuarios que tengan ese rol |
| `PATCH /api/roles/{roleId}/permisos` | Detalle/permisos del rol y snapshots de todos los usuarios asignados a ese rol |
| Crear, actualizar, desactivar o eliminar usuario | Colecciones/detalle del usuario si se habilitan en el futuro y snapshot de acceso del usuario |
| Asignar, reemplazar o remover roles de usuario | Snapshot de acceso y proyecciones de roles de ese usuario |
| Cambios futuros de estado o relaciones | Detalle del recurso, todas las colecciones donde pueda aparecer y snapshots de autorización derivados |
| Cambios al catálogo global de permisos mediante seed/despliegue | Catálogo global, roles afectados y snapshots de usuarios afectados; alternativamente incrementar la generación global RBAC |

Las operaciones que necesitan conocer usuarios afectados deben resolver sus IDs en la capa `database/` dentro de la operación transaccional o antes de cerrarla y pasar el resultado al servicio; la API Route no consulta Prisma ni invalida directamente.

## Seguridad y aislamiento

- Autenticación, autorización y validación se ejecutan antes de entregar datos cacheados.
- No se almacenan `sealedTokens`, access/refresh/id tokens, cookies, secretos, contraseñas, cabeceras de autorización ni payloads de error.
- El snapshot cacheable de acceso contiene solo `id`, identidad de presentación, roles y permisos efectivos; la sesión activa sigue comprobándose en PostgreSQL.
- Toda respuesta dependiente de permisos incluye `organizationId`/`venueId` y `authorizationFingerprint`; cuando el resultado es personal incluye además `userId`.
- Un cambio de rol o permiso invalida el snapshot antes de que se considere completada la coordinación del servicio. El TTL corto es defensa adicional, no el mecanismo principal.
- Una clave nunca se construye desde query params sin validar ni desde datos de sesión proporcionados por el cliente.

## Observabilidad

Los logs Pino estructurados incluyen `requestId`, módulo, recurso, variante, resultado (`hit`, `miss`, `bypass`, `error`, `write`, `invalidate`, `lock_wait`), latencia de Redis y un identificador de clave truncado/no reversible. No incluyen el valor cacheado, parámetros sensibles, cookies ni tokens.

Se definen contadores y histogramas independientes del proveedor: hits, misses, bypasses, errores, escrituras, invalidaciones, locks adquiridos/no adquiridos, espera por lock, latencia Redis, latencia de fuente y tamaño serializado. Se calcula `hit ratio` por recurso. Esta feature define una interfaz/instrumentación compatible con el logging actual; no incorpora una plataforma externa de métricas.

## Variables de entorno

La implementación futura documentará en `.env.example` y validará centralmente:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
CACHE_ENABLED=true
CACHE_KEY_PREFIX=canchago
CACHE_CONNECT_TIMEOUT_MS=500
CACHE_COMMAND_TIMEOUT_MS=200
CACHE_TTL_ACCESS_SECONDS=30
CACHE_TTL_PERMISSIONS_SECONDS=600
CACHE_TTL_ROLES_SECONDS=120
CACHE_TTL_ORGANIZATIONS_SECONDS=60
CACHE_TTL_VENUES_SECONDS=60
CACHE_TTL_JITTER_PERCENT=10
CACHE_LOCK_TTL_MS=3000
CACHE_LOCK_WAIT_MS=150
```

`REDIS_PASSWORD` es opcional pero, si existe, nunca se registra. Puertos, TTL, porcentajes y timeouts deben tener límites Zod positivos y razonables. `CACHE_ENABLED=false` produce bypass total sin impedir el arranque de la API.

## Criterios de aceptación

- [ ] Existe una única conexión Redis reutilizable para caché en `lib/cache/`; no se instancia un cliente por petición ni una infraestructura Redis paralela.
- [ ] Los endpoints seleccionados conservan códigos, bodies, paginación, validaciones y permisos actuales con caché habilitada, deshabilitada o caída.
- [ ] La sesión activa y sus tokens nunca se almacenan en Redis; la revocación y expiración continúan verificándose contra PostgreSQL en cada petición.
- [ ] El snapshot de acceso evita la consulta relacional repetida en un `cache hit` y se invalida al cambiar usuario, rol, permiso o asignación relacionada.
- [ ] Las claves incluyen módulo, recurso, variante, versión, entorno, generaciones y un hash canónico de identificadores, tenant, usuario, roles/permisos, filtros, orden y paginación aplicables.
- [ ] Dos tenants, usuarios o contextos de autorización distintos nunca comparten una respuesta protegida dependiente de su contexto.
- [ ] Un `cache hit` evita las consultas objetivo; un `cache miss` consulta la fuente y escribe solo resultados exitosos; un bypass no lee ni escribe Redis.
- [ ] Una entrada expirada, corrupta o de versión desconocida nunca se devuelve al cliente.
- [ ] Las escrituras y cambios de relaciones/estado invalidan todos los namespaces afectados después del commit exitoso.
- [ ] La protección anti-stampede garantiza un único recomputador normal por clave y espera acotada; la pérdida del lock degrada a la fuente original sin bloqueo indefinido.
- [ ] Una indisponibilidad o timeout de Redis no provoca `500`, no omite auth/access y no altera el contrato de respuesta.
- [ ] TTL, jitter, timeouts, prefijo y habilitación están documentados, validados con Zod y centralizados en configuración.
- [ ] Logs y métricas distinguen hit, miss, bypass, error, invalidación y coordinación sin exponer datos sensibles.
- [ ] Benchmarks reproducibles demuestran reducción de consultas y latencia para cada candidato habilitado; los candidatos sin beneficio medible se mantienen fuera.
- [ ] Hay pruebas unitarias, integración, concurrencia, expiración, invalidación, aislamiento y recuperación ante fallos descritas en `tasks.md`.

### Documentación (obligatorio)

- [ ] La documentación interna explica la semántica opcional de observabilidad de caché sin alterar los schemas de respuesta de negocio.
- [ ] Si se expone un header diagnóstico, solo se habilita fuera de producción o para operadores autorizados y se registra en los paths existentes de `documentation/schemas/`.
- [ ] Los módulos OpenAPI existentes continúan exportados desde `documentation/schemas/index.ts`.
- [ ] Los endpoints siguen visibles y correctos en `GET /api/docs` con caché habilitada y deshabilitada.

## Fuera de alcance

- Implementar código productivo, migraciones, nuevos endpoints o cambios OpenAPI dentro de esta entrega documental.
- Cachear sesiones, tokens OAuth, cookies, credenciales, respuestas de error o datos sin contrato de serialización.
- Cachear `GET /api/users`, detalles o roles expuestos hasta que otra feature corrija y pruebe el aislamiento por `organizationId` y alcance de `UserRole`.
- Reemplazar PostgreSQL como fuente de verdad o relajar la revocación inmediata de sesiones.
- Añadir un segundo proveedor de caché, una cola para invalidación o una plataforma externa de métricas.
- Cachear automáticamente futuros endpoints sin análisis de costo, sensibilidad, cardinalidad e invalidación.
- Resolver la inconsistencia de códigos de permisos, la deriva de migraciones o el error de build registrados para la feature 010.
