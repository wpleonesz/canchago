# 012 · Procesamiento Asíncrono con BullMQ — Plan

_Cómo se implementará lo descrito en `spec.md`. Esta entrega crea únicamente documentación._

## Enfoque

Construir la infraestructura junto al primer trabajo real aprobado. PostgreSQL conserva propiedad, estado e intención; BullMQ sobre Redis transporta el trabajo; los handlers llaman servicios existentes y son idempotentes. Para efectos que no pueden perderse, un outbox transaccional cierra la brecha PostgreSQL–Redis.

No se implementan workers vacíos ni se migran endpoints actuales por conveniencia. El único candidato real, la revocación remota de logout, requiere una decisión de seguridad separada antes de entrar al alcance ejecutable.

## Implementación futura

1. **Selección del primer trabajo** — Medir duración, tasa, reintentos, CPU/memoria/I/O y confirmar que admite 202 o efecto secundario eventual. Aprobar payload, SLA, idempotencia, permisos y compensación antes de crear código.

2. **`prisma/schema.prisma`** — Diseñar, solo cuando exista el primer productor, modelos equivalentes a:
   - `AsyncJob`: id, type/version, status, tenant, owner, resource, idempotencyKey, correlationId, progress/phase, attempts, error sanitizado, result mínimo y timestamps.
   - `OutboxEvent`: id, aggregate/type, asyncJobId, payload mínimo/version, attempts, availableAt, lockedAt/lockedBy, publishedAt, lastError sanitizado y timestamps.
   - Enums cerrados, índices de status/availableAt/owner/tenant y unicidad de idempotencyKey en la ventana definida.
   - `onDelete` explícito; un job histórico no debe desaparecer accidentalmente con el usuario/recurso.

3. **Migración Prisma** — Crear una migración nueva después de resolver la deriva registrada en la deuda técnica. Nunca editar migraciones aplicadas ni usar `db push`.

4. **`lib/config/env.ts` y `.env.example`** — Validar Redis/queue, concurrency, attempts, backoff, timeout, grace, poll, batch y retención. Centralizar acceso; ningún worker consulta `process.env` directamente.

5. **`lib/queue/connection.ts`** — Reutilizar ioredis con conexiones apropiadas para BullMQ y shutdown explícito. Coordinar con la feature de caché sin compartir una conexión cuando BullMQ requiera opciones incompatibles como `maxRetriesPerRequest: null`; reutilizar configuración/servidor, no necesariamente el mismo socket.

6. **`lib/queue/names.ts` y `policies.ts`** — Prefijos por app/entorno, registro cerrado de tipos versionados y políticas tipadas. Prohibir nombres, prioridad, delay, timeout o attempts provenientes directamente del request.

7. **`validations/jobs/`** — Schemas Zod para job ID/params, payload envelopes, estado y tipos registrados. Los schemas del productor permanecen en su módulo y generan tipos inferidos.

8. **`database/jobs/`** — Encapsular create/find-owned/update-state/outbox claim/publish/fail/cleanup. Reclamar outbox en lotes con transacción y bloqueo recuperable; nunca consultar Prisma desde el publicador o worker fuera de esta capa.

9. **`services/jobs/`** — Registrar intención, devolver DTO público, consultar por owner/tenant, cancelar cooperativamente y reintentar manualmente con autorización. Traducir estados BullMQ al enum público sin conocer HTTP.

10. **Productor de dominio** — Dentro de la transacción de negocio, crear `AsyncJob + OutboxEvent`. La API Route llama al servicio y devuelve 202 con `Location`; no instancia `Queue` ni publica directamente.

11. **`workers/outbox-publisher.worker.ts`** — Publicar eventos pendientes con jobId estable. Marcar `QUEUED` solo tras confirmación. Recuperar locks vencidos, aplicar backoff y soportar apagado.

12. **`workers/<modulo>.worker.ts`** — Factory común más processor específico. Validar payload/version, marcar RUNNING, recuperar datos por ID/tenant, comprobar idempotencia, ejecutar servicio, actualizar progreso acotado y persistir SUCCEEDED/FAILED.

13. **Dead-letter y re-drive** — Conservar failed jobs por política, registrar referencia mínima en una cola dead-letter BullMQ del módulo y ofrecer re-drive operativo autenticado fuera de endpoints públicos. Vincular nuevo intento con job original.

14. **`pages/api/jobs/[jobId].ts`** — GET autenticado para estado propio; DELETE únicamente para tipos cancelables. 404 para otro owner/tenant, 409 si no cancelable/terminal y respuestas estándar.

15. **Observabilidad** — Integrar Pino y métricas internas para productor, outbox, queue events, worker, stalled, retries, DLQ, latencia y cleanup. Redactar payloads/errores.

16. **Shutdown** — Helper reutilizable para señales, cierre de workers, QueueEvents, schedulers/componentes requeridos por la versión instalada, publicador y conexiones. Validar la API BullMQ actual antes de implementar.

17. **Limpieza** — Configurar removeOnComplete/removeOnFail por tipo y tarea idempotente para registros PostgreSQL. Conservar estados/fallos según auditoría y soporte.

18. **OpenAPI** — Crear `documentation/schemas/jobs.ts` en paralelo con el primer endpoint; registrar schemas, 202/status/cancelación y exportar desde index.

19. **Despliegue** — Aplicar migración, desplegar código con productores deshabilitados, iniciar publicador/workers, verificar health/observabilidad, activar un tipo y aumentar concurrencia gradualmente.

## Contratos internos propuestos

- `JobDefinition<TPayload, TResult>` — type/version, payload schema, queue, priority, attempts, backoff, timeout, concurrency, cancellable, retention y processor.
- `JobEnvelope` — IDs, tenant, owner, recurso, correlación y versión; sin secretos.
- `JobContext` — jobId, attempt, logger, progress/cancellation e idempotency helpers.
- `JobRepository` — persistencia pública/outbox mediante Prisma.
- `QueuePublisher` — publica envelope a BullMQ sin conocer HTTP o reglas de dominio.
- `JobProcessor` — recibe IDs validados y llama servicios; nunca recibe `NextApiRequest`.

## Pseudoflujos

### Registro y publicación confiable

```text
API → auth/access/Zod → domainService.requestAsync(input, actor)
transaction:
  aplicar cambio de negocio si corresponde
  encontrar/crear AsyncJob por idempotencyKey
  crear OutboxEvent si no existe
commit
responder 202

publisher:
  claim batch pending availableAt <= now
  queue.add(type, envelope, { jobId, policy })
  marcar outbox published + job QUEUED
```

### Ejecución idempotente

```text
worker recibe envelope
validar type/version
si AsyncJob SUCCEEDED → terminar sin repetir efecto
marcar RUNNING/attempt
cargar recurso por resourceId + organizationId
si cancelación solicitada y es segura → CANCELLED
ejecutar efecto con idempotencyKey
persistir resultado mínimo y SUCCEEDED
si error transitorio → RETRYING + throw para BullMQ
si permanente/agotado → FAILED + dead-letter
```

### Redis no disponible

```text
si el endpoint depende del trabajo y no puede persistir intención → 503
si AsyncJob + Outbox ya hicieron commit → mantener PENDING y responder según contrato
publisher reintentará cuando Redis vuelva
worker interrumpido → BullMQ recupera stalled; handler evita duplicar efecto
```

## Decisiones

- **BullMQ + Redis existentes** — Evita infraestructura paralela y coincide con la constitución.
- **Estado público en PostgreSQL** — Permite autorización, consulta histórica y recuperación aunque Redis esté temporalmente caído.
- **Transactional Outbox para efectos obligatorios** — Evita trabajos perdidos después del commit. Se descarta Redis dentro de la transacción por no ser atómico.
- **Entrega al menos una vez** — Es el modelo realista; idempotencia y deduplicación protegen efectos.
- **Payload por identificadores** — Minimiza tamaño/sensibilidad y fuerza al worker a leer datos vigentes.
- **Política por tipo** — Concurrencia, timeout y reintentos no pueden ser defaults universales ni inputs del cliente.
- **Status aislado por owner/tenant** — PostgreSQL aplica propiedad; BullMQ no se expone al consumidor.
- **Cancelación cooperativa** — No promete detener efectos ya confirmados.
- **Sin productor inicial obligatorio** — La infraestructura solo se justifica junto a un candidato aprobado.

## Riesgos

- **Trabajo perdido o fantasma** — Mitigación: outbox, jobId estable, locks recuperables y reconciliación.
- **Efecto duplicado** — Un worker puede morir tras ejecutar. Mitigación: idempotencyKey persistente, constraints y claves externas.
- **Datos obsoletos** — El recurso cambia antes de ejecutar. Mitigación: cargar desde DB, validar versión/estado y definir si falla, cancela o procesa snapshot.
- **Fuga cross-tenant** — Mitigación: owner/organization en registro, consultas filtradas y 404 cruzado.
- **Payload sensible** — Mitigación: IDs mínimos, Zod y redacción; tokens solo se recuperan desde almacenamiento sellado en el candidato de logout.
- **Backlog incontrolado** — Mitigación: concurrencia/pool calibrados, métricas de edad, prioridad cerrada y alertas.
- **Retry storm** — Mitigación: exponencial+jitter, Retry-After, límites y clasificación de errores.
- **Shutdown incompleto** — Mitigación: drain con grace, close ordenado y handlers idempotentes para stalled.
- **Outbox creciente** — Mitigación: índices, lotes, alertas y limpieza solo de publicados retenidos.
- **Complejidad prematura** — Hoy no hay trabajo pesado. Mitigación: no implementar hasta aprobar el primer caso y su SLA.
