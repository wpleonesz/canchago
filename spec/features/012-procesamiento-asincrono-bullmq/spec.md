# 012 · Procesamiento Asíncrono con BullMQ

**Estado:** propuesta

## Qué hace

Define la infraestructura y los contratos para trasladar a workers los procesos pesados, demorados, reintentables o que no necesitan finalizar durante la solicitud HTTP. Los endpoints elegibles registrarán un trabajo, responderán sin esperar su ejecución y permitirán consultar su estado con aislamiento por usuario y tenant.

La feature usa BullMQ sobre Redis, tecnologías ya declaradas en el proyecto. No introduce otra cola, no ejecuta trabajo pesado en API Routes y no convierte automáticamente operaciones síncronas en asíncronas sin demostrar que su resultado puede ser eventual.

## Por qué

El stack y `package.json` ya incluyen `bullmq`, `ioredis`, Nodemailer, pdfmake, ExcelJS y scripts `worker:email`, `worker:notification` y `worker:report`. Sin embargo, el código actual no contiene `lib/queue/`, `workers/`, productores, endpoints de reportes/notificaciones, importaciones, exportaciones ni generación de archivos.

Crear contratos antes del primer proceso pesado evita workers incompatibles, payloads con secretos, duplicados, trabajos perdidos entre PostgreSQL y Redis, estados inaccesibles o respuestas HTTP que prometan un resultado todavía no producido.

## Auditoría de procesos existentes

| Flujo real | Trabajo actual | Evaluación | Decisión |
|---|---|---|---|
| `GET /api/auth/callback` | Intercambia código OAuth, valida ID token, sincroniza usuario y crea sesión | Debe completarse antes de autenticar; el cliente necesita cookie/redirect válidos | Mantener síncrono |
| `POST /api/auth/refresh` | Renueva tokens y actualiza la sesión | El resultado es necesario para continuar usando la sesión | Mantener síncrono |
| `POST /api/auth/logout` | Llama al endpoint remoto de revocación y después revoca la sesión local | La llamada remota es demorada/reintentable, pero afecta seguridad y requiere token sellado | Candidato condicionado: primero revocar localmente; publicar revocación remota solo si se aprueba consistencia eventual y manejo seguro del token |
| CRUD de usuarios, roles, permisos, organizaciones y sedes | Consultas y escrituras Prisma pequeñas, varias transaccionales | El cliente necesita confirmación inmediata; no hay tarea pesada | Mantener síncrono |
| Eliminación de organización | `updateMany` de sedes + soft delete de organización en una transacción | Operación set-based y atómica; hacerla eventual alteraría visibilidad y contrato 204 | Mantener síncrono; medir antes de reconsiderar |
| Asignación de roles/permisos | Relaciones M:N y transacciones | Debe afectar autorización inmediatamente | Mantener síncrono |
| Seeds y `prisma/asignar-rol.ts` | Scripts administrativos fuera de HTTP | No son endpoints ni trabajos de usuario | Fuera de la cola HTTP |
| Documentación OpenAPI | Generación de spec con caché en memoria | No es proceso de negocio | Mantener síncrono |
| Email, notificaciones, reportes, PDF, Excel, importación/exportación | Dependencias/scripts declarados, pero no hay servicios, rutas ni workers implementados | No existe proceso que migrar | Definir políticas para futuros casos; no inventar productores actuales |

### Conclusión de alcance inicial

No hay hoy un endpoint pesado que pueda migrarse sin cambiar su semántica. La implementación de infraestructura debe activarse junto con el primer caso de negocio aprobado, no desplegar workers vacíos por sí solos. La revocación remota del IdP es el único candidato actual y queda detrás de una decisión explícita de seguridad.

## Criterios de elegibilidad

Un proceso puede convertirse en trabajo cuando cumple todos:

- El endpoint puede devolver aceptación sin necesitar el resultado final.
- La operación admite consistencia eventual y reintentos.
- Existe una clave de idempotencia y una forma de detectar el efecto ya aplicado.
- El payload puede limitarse a identificadores y contexto no sensible.
- El worker puede volver a cargar y autorizar los datos desde PostgreSQL.
- Un fallo definitivo puede observarse, reintentarse manualmente o compensarse.
- El tiempo, CPU, memoria, I/O externo o tamaño justifican separar el proceso.

Debe permanecer síncrono si crea una sesión, decide autorización, confirma una reserva/pago indivisible, devuelve el recurso recién creado necesario para el siguiente paso o depende de una transacción que no puede dividirse de manera segura.

## Arquitectura

```text
Cliente
  │ POST operación asíncrona
  ▼
API Route → auth → access → Zod → servicio
                                  │ transacción
                                  ▼
                          PostgreSQL: AsyncJob + OutboxEvent
                                  │
                                  ▼
                         publicador outbox → BullMQ/Redis
                                                   │
                                                   ▼
                                                worker
                                                   │
                                                   ▼
                                           servicio → database/

Cliente → GET /api/jobs/{jobId} → servicio → PostgreSQL
```

- La API Route valida HTTP, llama al servicio y responde.
- El servicio valida reglas, crea el registro de trabajo y coordina la transacción.
- `database/jobs/` encapsula Prisma y el outbox.
- `lib/queue/` contiene conexiones, factories, nombres y políticas BullMQ; no conoce HTTP.
- `workers/` ejecuta handlers que llaman servicios de aplicación y nunca sirve HTTP.
- PostgreSQL conserva el estado público y la propiedad del trabajo. Redis es el transporte, no la autoridad para autorización o consulta histórica.

## Contrato del trabajo

Cada tipo se registra en una lista cerrada y versionada:

```text
<módulo>.<acción>.v<versión>
```

Ejemplos reservados para cuando existan las features correspondientes: `reports.generate.v1`, `exports.users.v1`, `notifications.email.v1`. Estos nombres no crean por sí mismos endpoints o servicios.

### Envoltorio mínimo

```json
{
  "jobId": "uuid",
  "type": "module.action.v1",
  "organizationId": "uuid-or-null",
  "requestedByUserId": "uuid",
  "resourceId": "uuid-or-null",
  "correlationId": "request-id-or-business-id",
  "payloadVersion": 1
}
```

El payload no contiene tokens, cookies, contraseñas, credenciales SMTP/Redis/OAuth, archivos binarios, contenido completo de reportes, PII masiva ni DTO de base de datos. El worker recupera parámetros aprobados desde `AsyncJob` o recursos relacionados, valida el schema versionado y vuelve a comprobar que el recurso y tenant sigan vigentes.

Los artefactos grandes futuros se almacenan fuera de Redis mediante la infraestructura de archivos aprobada en su propia feature; la cola transporta solo el identificador. Hoy no existe almacenamiento de objetos y no se propone uno en esta feature.

## Modelo de estado público

Estados normalizados:

```text
PENDING → QUEUED/DELAYED → RUNNING → SUCCEEDED
                          ├───────→ RETRYING
                          ├───────→ FAILED
                          └───────→ CANCELLED (solo cooperativo y si el tipo lo permite)
```

- `PENDING`: transacción de PostgreSQL confirmada, todavía no publicada.
- `QUEUED`: BullMQ aceptó el trabajo.
- `DELAYED`: espera el retraso configurado.
- `RUNNING`: un worker adquirió el trabajo.
- `RETRYING`: falló un intento y quedan reintentos.
- `SUCCEEDED`: resultado confirmado.
- `FAILED`: intentos agotados o error no reintentable.
- `CANCELLED`: cancelación confirmada antes del efecto irreversible.

El progreso es un entero 0–100 y una fase de lista blanca, nunca mensajes arbitrarios con datos sensibles. El resultado público contiene identificadores, conteos y enlace lógico al recurso/artefacto autorizado; no incluye stack traces ni errores internos.

## Respuesta HTTP y consulta

Un endpoint que solo registra trabajo responde:

```http
HTTP/1.1 202 Accepted
Location: /api/jobs/{jobId}
Retry-After: 2
```

```json
{
  "data": {
    "id": "uuid",
    "type": "reports.generate.v1",
    "status": "PENDING",
    "createdAt": "2026-07-18T12:00:00.000Z",
    "statusUrl": "/api/jobs/uuid"
  }
}
```

`GET /api/jobs/{jobId}` requiere autenticación. El servicio filtra por `requestedByUserId` y alcance de organización; un usuario distinto recibe 404 para no confirmar la existencia. Un operador con acceso cruzado solo podrá consultar si una feature posterior define y siembra un permiso compatible y valida el mismo tenant. No se inventa un permiso `jobs.*` dentro de esta documentación.

La consulta devuelve 200 para cualquier estado conocido. El endpoint creador puede devolver 201 únicamente si su efecto principal ya terminó y el trabajo es un efecto secundario no contractual; no debe devolver 202 y al mismo tiempo presentar el resultado como completado.

Cancelación, cuando el tipo lo soporte, usa `DELETE /api/jobs/{jobId}` o una acción contractual aprobada antes de implementar. Requiere propiedad/alcance, responde 202 mientras la cancelación es cooperativa y 409 si el trabajo ya terminó o cruzó un punto irreversible.

## Configuración por tipo de trabajo

Cada tipo declara una política inmutable en código:

| Campo | Regla |
|---|---|
| Cola | Nombre versionado y prefijado por aplicación/entorno/módulo |
| Prioridad | Lista cerrada; trabajos interactivos por delante de lotes, sin permitir que el cliente envíe números arbitrarios |
| Delay | Solo calculado por servicio o política; máximo validado |
| Concurrencia | Por worker y tipo, calibrada contra pool DB, CPU, memoria y límites externos |
| Timeout | Tiempo máximo por intento; debe ser menor que la ventana operacional y producir error clasificable |
| Attempts | 1 para errores no reintentables; valor acotado para fallos transitorios |
| Backoff | Exponencial con jitter para red/429/5xx; respetar `Retry-After` cuando aplique |
| Idempotency key | Determinista por operación, recurso, versión y parámetros normalizados |
| Deduplicación | `jobId` BullMQ derivado de clave opaca/hash; PostgreSQL con constraint único para la misma intención activa |
| Retención | Conteo/edad configurables para completados y fallidos |

Valores iniciales deben validarse mediante Zod en `lib/config/env.ts`. No se aceptan prioridad, reintentos, delay, timeout o concurrencia directamente desde el cliente.

## Idempotencia, deduplicación y bloqueo

- El productor genera `idempotencyKey` a partir de actor/tenant, tipo/version, recurso y parámetros normalizados, o acepta un header idempotente validado cuando el contrato lo requiera.
- Repetir la misma intención devuelve el mismo trabajo activo/completado mientras dure la ventana, sin publicar duplicados.
- El `jobId` de BullMQ es estable y no contiene `:` si la versión instalada lo restringe; se usa UUID o hash seguro.
- El worker comprueba primero en PostgreSQL si el efecto ya fue aplicado. Los efectos externos usan una clave idempotente del proveedor cuando exista.
- BullMQ garantiza que un job normal sea adquirido por un worker, pero el diseño asume entrega al menos una vez: un worker puede completar el efecto y morir antes de confirmarlo.
- Para recursos mutuamente excluyentes se usa lock BullMQ/Redis con TTL renovable o, preferentemente, constraint/transacción PostgreSQL. El lock nunca sustituye una restricción de integridad.

## Reintentos y errores

Errores reintentables: timeout, desconexión temporal, 429, 5xx externo y bloqueo recuperable. Errores no reintentables: validación, recurso inexistente definitivo, autorización/tenant inválido, versión de payload desconocida y regla de negocio.

El worker registra una versión sanitizada del error (`code`, mensaje operativo, attempt, timestamp) en `AsyncJob`; no persiste tokens, payloads sensibles ni stack trace público. El endpoint de estado expone un código/mensaje genérico.

Al agotar intentos:

1. `AsyncJob` pasa a `FAILED`.
2. El job permanece en el conjunto de fallidos de BullMQ durante la retención configurada.
3. Se registra una referencia mínima en una cola BullMQ dead-letter del módulo o tabla de incidentes aprobada; no se copia un payload sensible.
4. Se emite métrica/alerta.
5. La reejecución manual crea un nuevo intento vinculado al trabajo original o reencola de forma idempotente después de corregir la causa.

## Consistencia PostgreSQL–Redis

No existe una transacción atómica entre Prisma/PostgreSQL y BullMQ/Redis:

- DB primero y publicación después puede dejar un trabajo `PENDING` sin publicar.
- Cola primero y DB después puede ejecutar un trabajo sin registro, autorización o transacción confirmada.

Para operaciones donde perder el trabajo altera el resultado funcional se adopta **Transactional Outbox**:

1. La transacción de negocio crea `AsyncJob` y `OutboxEvent` junto con cualquier cambio de dominio.
2. Un publicador reclama eventos pendientes en lotes con bloqueo seguro y publica a BullMQ usando `jobId` estable.
3. Solo después de confirmación de BullMQ marca el evento publicado y el trabajo `QUEUED`.
4. Si el publicador cae, otro proceso recupera eventos vencidos.
5. Una publicación duplicada se neutraliza por `jobId`/idempotencia.

El outbox encaja porque PostgreSQL y Prisma ya son la fuente transaccional. Se descarta publicar directamente desde una transacción Prisma: mantiene una conexión abierta durante I/O Redis y aun así no es atómico. Para efectos best effort explícitos que pueden perderse se podría publicar directamente, pero esa excepción debe constar en la spec del tipo de trabajo.

## Candidato condicionado: revocación remota en logout

Si seguridad aprueba consistencia eventual:

1. El endpoint revoca la sesión local en PostgreSQL como efecto principal inmediato.
2. En la misma transacción crea trabajo/outbox con `sessionId`, nunca con el refresh/access token.
3. Responde 204 porque el logout local terminó; no se expone como trabajo interactivo.
4. El worker recupera por ID la sesión revocada y el token sellado, lo desella dentro del proceso, llama al IdP y nunca lo registra.
5. 404/invalid token del IdP se trata como éxito idempotente; timeout/429/5xx se reintentan.
6. Tras éxito o expiración definitiva se aplica la política aprobada de minimización/retención del blob sellado.

No se implementará este candidato hasta definir el SLA de revocación remota, el acceso a sesiones revocadas, la retención de tokens y el comportamiento cuando Redis no esté disponible. La revocación local nunca depende de Redis.

## Apagado, recuperación y cancelación

- Cada worker escucha `SIGTERM`/`SIGINT`, deja de aceptar trabajos y espera los activos hasta un período de gracia menor al timeout del orquestador.
- `worker.close()` y las conexiones se cierran sin `process.exit()` prematuro.
- Si expira la gracia, el trabajo queda recuperable como stalled; el handler idempotente permite repetirlo.
- Se configuran detección de stalled jobs y límites para evitar ciclos infinitos.
- Cancelar es cooperativo: el worker comprueba una marca entre fases y antes de efectos irreversibles. No se promete cancelación para emails enviados, llamadas externas confirmadas o transacciones ya aplicadas.
- El progreso se actualiza con frecuencia limitada para no saturar Redis.

## Observabilidad y operación

Logs Pino estructurados incluyen `requestId`/`correlationId`, `jobId`, tipo/version, cola, tenant no sensible, attempt, estado, duración, delay, wait time y worker; no incluyen payload completo, tokens, cookies, emails, archivos ni secretos.

Métricas mínimas:

- Jobs agregados, iniciados, completados, reintentados, fallidos, cancelados y enviados a dead-letter.
- Profundidad y edad del trabajo más antiguo por estado/cola.
- Queue wait time, run duration y end-to-end latency p50/p95/p99.
- Stalled jobs, duplicados evitados, outbox pendientes/atrasados y fallos de publicación.
- Concurrencia activa, uso del worker y fallos por código/tipo.

Alertas: dead-letter > 0, outbox pendiente por encima del SLA, edad de cola excesiva, tasa de fallo/reintento, stalled repetido y Redis no disponible.

La limpieza usa `removeOnComplete` y `removeOnFail` por edad/conteo, más mantenimiento de registros PostgreSQL según política de auditoría. Nunca se eliminan trabajos activos, outbox no publicados ni evidencia requerida para soporte. La limpieza es un job de mantenimiento idempotente o proceso programado aprobado, no un barrido síncrono en endpoints.

## Variables de entorno

La implementación futura reutilizará la configuración Redis central y añadirá valores validados, por ejemplo:

```env
QUEUE_ENABLED=true
QUEUE_PREFIX=canchago
QUEUE_DEFAULT_ATTEMPTS=5
QUEUE_DEFAULT_BACKOFF_MS=1000
QUEUE_DEFAULT_TIMEOUT_MS=30000
QUEUE_WORKER_CONCURRENCY=5
QUEUE_SHUTDOWN_GRACE_MS=25000
QUEUE_COMPLETED_RETENTION_SECONDS=86400
QUEUE_FAILED_RETENTION_SECONDS=604800
QUEUE_OUTBOX_POLL_MS=1000
QUEUE_OUTBOX_BATCH_SIZE=50
QUEUE_STALLED_MAX_COUNT=2
```

Los límites varían por tipo cuando sea necesario. `QUEUE_ENABLED=false` impide aceptar endpoints cuyo resultado dependa del job y debe devolver 503 antes de crear una intención imposible; los efectos best effort pueden completar el efecto principal y registrar el evento pendiente para publicación posterior.

## Criterios de aceptación

- [ ] El inventario distingue procesos síncronos obligatorios, candidatos condicionados y procesos futuros inexistentes, sin asumir endpoints o workers actuales.
- [ ] BullMQ/ioredis se reutilizan mediante una conexión/factory central; no se incorpora una segunda tecnología de cola.
- [ ] Cada tipo declara payload Zod versionado, productor, cola, prioridad, delay, concurrencia, timeout, attempts, backoff, idempotencia, deduplicación, cancelación y retención.
- [ ] Los payloads contienen identificadores y contexto mínimo; nunca tokens, cookies, credenciales, archivos o PII masiva.
- [ ] Los endpoints asíncronos responden 202 con `Location`, `statusUrl` y trabajo persistido cuando el efecto queda pendiente.
- [ ] La consulta de estado requiere auth y solo devuelve trabajos del usuario/tenant autorizado; accesos cruzados responden 404.
- [ ] El número de publicaciones y efectos permanece idempotente ante requests duplicados, reintentos y recuperación de stalled jobs.
- [ ] Los cambios de negocio y la intención de trabajo se confirman atómicamente mediante outbox cuando perder el job afectaría el resultado.
- [ ] Un publicador caído recupera eventos pendientes sin duplicar el efecto.
- [ ] Errores transitorios se reintentan con backoff/jitter; errores permanentes fallan sin reintentos inútiles.
- [ ] Los intentos agotados quedan observables mediante estado FAILED, retención y mecanismo dead-letter sanitizado.
- [ ] Workers soportan apagado controlado, recuperación, concurrencia acotada y progreso limitado.
- [ ] Redis no disponible no corrompe PostgreSQL ni pierde una intención confirmada; el contrato diferencia 503 de aceptación persistida.
- [ ] Logs, métricas y alertas cubren productor, outbox, cola y worker sin exponer datos sensibles.
- [ ] La limpieza conserva trabajos activos, outbox pendiente y evidencia mínima de fallos.
- [ ] La revocación remota de logout no se mueve a cola sin aprobación explícita de seguridad y pruebas de revocación local inmediata.

### Documentación (obligatorio)

- [ ] Los schemas `AsyncJobAccepted`, `AsyncJobStatus` y errores se registran mediante `registry.registerComponent()` cuando exista el primer productor.
- [ ] `GET /api/jobs/{jobId}` y cualquier cancelación aprobada se registran con `registry.registerPath()` y security.
- [ ] Cada endpoint productor documenta 202, `Location`, ejemplos, estados y errores 400/401/403/404/409/422/503.
- [ ] El módulo se exporta desde `documentation/schemas/index.ts` y aparece correctamente en `GET /api/docs`.

## Fuera de alcance

- Implementar productores, workers, modelos, migraciones, conexiones Redis o cambios de endpoints en esta entrega.
- Inventar reportes, notificaciones, emails, importaciones, exportaciones o almacenamiento de archivos que no existen.
- Mover callback OAuth, refresh, autorización, CRUD o transacciones críticas a ejecución eventual.
- Añadir Kafka, RabbitMQ, SQS u otra infraestructura paralela.
- Exponer BullMQ Board, payloads, stack traces o administración de colas a usuarios finales.
- Garantizar exactly-once; el contrato es entrega al menos una vez con handlers idempotentes.
- Resolver permisos/deuda técnica, caché o N+1 documentados en otras features.
