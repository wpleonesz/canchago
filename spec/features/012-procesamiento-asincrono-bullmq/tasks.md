# 012 · Procesamiento Asíncrono con BullMQ — Tareas

_Checklist accionable derivada del `plan.md`. Todas permanecen pendientes porque esta entrega es exclusivamente documental._

## Selección y contratos

- [ ] Medir endpoints actuales y confirmar el primer candidato real antes de implementar infraestructura.
- [ ] Documentar SLA, resultado eventual, idempotencia, compensación, permisos y criterios de cancelación del tipo.
- [ ] Mantener callback OAuth, refresh, autorización, CRUD y transacciones críticas síncronos.
- [ ] Obtener aprobación de seguridad antes de mover la revocación remota de logout.
- [ ] Definir type/version, payload/result Zod y política completa del primer trabajo.

## Modelo y migración

- [ ] Resolver la deriva de migraciones registrada antes de modificar Prisma.
- [ ] Diseñar `AsyncJob` con owner, tenant, tipo/version, estado, idempotencia, correlación, progreso, error/resultado mínimos y timestamps.
- [ ] Diseñar `OutboxEvent` con disponibilidad, claim, publicación, intentos y error sanitizado.
- [ ] Agregar enums cerrados, índices y constraints de deduplicación.
- [ ] Definir `onDelete` explícito y política de retención/auditoría.
- [ ] Crear migración nueva sin editar migraciones aplicadas ni usar `db push`.

## Configuración y BullMQ

- [ ] Documentar variables Redis/queue en `.env.example` sin secretos.
- [ ] Validar configuración con Zod en `lib/config/env.ts`.
- [ ] Crear conexiones BullMQ reutilizables con opciones compatibles con la versión instalada.
- [ ] Crear prefijos/nombres por aplicación, entorno y módulo.
- [ ] Crear registro cerrado de tipos y políticas; rechazar valores controlados por cliente.
- [ ] No añadir otra tecnología ni una conexión por request/job.

## Persistencia y outbox

- [ ] Crear `database/jobs/` con create, find-owned, transiciones, progreso y cleanup.
- [ ] Crear operación transaccional para `AsyncJob + OutboxEvent + cambio de negocio`.
- [ ] Reclamar eventos pendientes en lotes con lock recuperable.
- [ ] Publicar con jobId estable y marcar QUEUED solo tras confirmación.
- [ ] Recuperar claims vencidos y reintentar publicación con backoff.
- [ ] Reconciliar jobs PENDING sin outbox publicable y publicaciones duplicadas.
- [ ] Probar que Redis lento no mantiene abierta una transacción Prisma.

## Servicios y productores

- [ ] Crear `services/jobs/` para registro idempotente, consulta aislada, cancelación y re-drive autorizado.
- [ ] Integrar el primer productor dentro de su servicio de dominio.
- [ ] Mantener Queue/BullMQ fuera de API Routes y database.
- [ ] Responder 202 con Location, statusUrl y DTO persistido cuando el resultado está pendiente.
- [ ] Devolver la misma intención ante una idempotencyKey repetida dentro de la ventana.
- [ ] Devolver 503 antes de aceptar cuando cola/outbox estén deshabilitados y no pueda garantizarse el trabajo.

## Workers y processors

- [ ] Crear publicador outbox como proceso independiente.
- [ ] Crear factory común de worker con logs, métricas, validación y shutdown.
- [ ] Crear processor del primer tipo que recupere datos por IDs/tenant.
- [ ] Revalidar estado del recurso y versión del payload antes del efecto.
- [ ] Implementar checkpoint idempotente antes/después de efectos externos.
- [ ] Aplicar timeout, attempts, backoff+jitter, priority, delay y concurrency de la política.
- [ ] Limitar frecuencia y contenido de progreso.
- [ ] Clasificar errores reintentables y permanentes.

## Idempotencia, deduplicación y concurrencia

- [ ] Generar idempotencyKey estable desde intención normalizada.
- [ ] Usar jobId BullMQ opaco/estable compatible con restricciones de nombres.
- [ ] Probar request duplicado, publicación duplicada y entrega duplicada.
- [ ] Impedir dos efectos simultáneos incompatibles sobre el mismo recurso.
- [ ] Preferir constraints/transacción PostgreSQL para integridad y usar locks solo para coordinación.
- [ ] Renovar locks largos y recuperarlos tras caída del worker.
- [ ] Confirmar que el efecto permanece único si el worker muere después de ejecutarlo y antes del ack.

## Estado, permisos y cancelación

- [ ] Crear `GET /api/jobs/[jobId].ts` con auth y filtrado owner/tenant.
- [ ] Responder 404 para job ajeno o tenant distinto.
- [ ] Mapear estados BullMQ a estados públicos persistidos.
- [ ] Exponer solo resultado/error sanitizados.
- [ ] Implementar cancelación solo para tipos declarados cancelables.
- [ ] Responder 409 para estado terminal o punto irreversible.
- [ ] Comprobar marca de cancelación entre fases sin prometer interrupción inmediata.

## Fallos y dead-letter

- [ ] Persistir RETRYING/FAILED con attempt y código sanitizado.
- [ ] Conservar failed jobs durante la retención configurada.
- [ ] Registrar referencia mínima en dead-letter sin duplicar payload sensible.
- [ ] Emitir alerta cuando haya trabajos dead-letter o tasa de fallo excesiva.
- [ ] Diseñar re-drive operativo idempotente y vinculado al job original.
- [ ] Probar fallo parcial y compensación definida por el tipo.

## Apagado, recuperación y limpieza

- [ ] Manejar SIGTERM/SIGINT y dejar de tomar jobs nuevos.
- [ ] Esperar jobs activos dentro de `QUEUE_SHUTDOWN_GRACE_MS`.
- [ ] Cerrar workers, queue events, publicador y conexiones en orden.
- [ ] Recuperar stalled jobs sin repetir efectos.
- [ ] Configurar límites de stalled para evitar ciclos infinitos.
- [ ] Configurar removeOnComplete/removeOnFail por edad/conteo.
- [ ] Limpiar registros PostgreSQL solo según retención y auditoría.
- [ ] Nunca eliminar jobs activos, outbox pendiente o evidencia requerida.

## Observabilidad

- [ ] Logs Pino con correlationId, jobId, tipo, cola, estado, attempt y duración.
- [ ] Redactar payload, tokens, cookies, emails, archivos, errores internos y secretos.
- [ ] Medir added/started/completed/retried/failed/cancelled/dead-letter.
- [ ] Medir profundidad, edad, wait/run/end-to-end latency y concurrency.
- [ ] Medir stalled, duplicados evitados, outbox pending/age y publish errors.
- [ ] Configurar alertas por DLQ, outbox atrasado, backlog, retries, fallos y Redis caído.
- [ ] Crear runbook para pausa, re-drive, Redis, worker caído y outbox acumulado.

## Pruebas unitarias

- [ ] Validación acepta payload mínimo versionado y rechaza campos/versión desconocidos.
- [ ] Políticas no aceptan priority/delay/attempts/timeout del cliente.
- [ ] Idempotency key es estable para intención equivalente y distinta para otra intención.
- [ ] Clasificador separa errores transitorios de permanentes.
- [ ] Mapper de estado/error no expone información interna.
- [ ] Processor completado no repite efecto al ejecutarse de nuevo.
- [ ] Cancelación solo avanza en checkpoints seguros.
- [ ] Backoff, jitter, timeout y retención permanecen dentro de límites.

## Pruebas de integración

- [ ] Registrar trabajo confirma AsyncJob y OutboxEvent en la misma transacción.
- [ ] 202 incluye Location/statusUrl y trabajo PENDING/QUEUED válido.
- [ ] Publicador mueve PENDING a QUEUED y marca outbox publicado.
- [ ] Caída del publicador deja outbox recuperable por otra instancia.
- [ ] Redis indisponible no pierde intención confirmada ni corrompe DB.
- [ ] Redis recuperado publica backlog pendiente automáticamente.
- [ ] Worker completa una vez y persiste resultado mínimo.
- [ ] Request/job duplicado no duplica efecto.
- [ ] Error transitorio reintenta con backoff hasta éxito.
- [ ] Error permanente falla una vez y llega a dead-letter.
- [ ] Intentos agotados generan FAILED, retención y alerta.
- [ ] Dos workers respetan concurrency/lock e idempotencia.
- [ ] GET de owner devuelve estado; otro usuario/tenant recibe 404.
- [ ] Cancelación válida termina CANCELLED; tardía devuelve 409.

## Pruebas de fallo y recuperación

- [ ] Worker cae antes del efecto: otro lo recupera.
- [ ] Worker cae después del efecto y antes del ack: reintento no duplica.
- [ ] PostgreSQL falla antes del commit: no se publica trabajo.
- [ ] Publicación falla después del commit: outbox permanece pendiente.
- [ ] Confirmación BullMQ se repite: jobId estable evita duplicado.
- [ ] Timeout externo, 429 y 5xx respetan clasificación/Retry-After.
- [ ] Shutdown drena dentro de gracia y deja el resto recuperable.
- [ ] Limpieza no elimina jobs activos, fallidos no vencidos ni outbox pendiente.

## Candidato logout (condicionado)

- [ ] Aprobar SLA de revocación remota eventual y política de tokens sellados.
- [ ] Revocar sesión local y crear outbox en una transacción.
- [ ] Payload contiene sessionId, nunca token.
- [ ] Worker recupera/desella token sin registrarlo.
- [ ] Invalid token/404 del IdP es éxito idempotente; timeout/429/5xx reintentan.
- [ ] Logout local funciona aunque Redis/IdP estén caídos.
- [ ] Mantener 204 si el efecto contractual de logout local ya terminó.

## Documentación OpenAPI (obligatorio)

- [ ] Crear `documentation/schemas/jobs.ts` con AsyncJobAccepted, AsyncJobStatus y errores.
- [ ] Registrar GET `/api/jobs/{jobId}` y cancelación si existe.
- [ ] Registrar 202, Location, schemas, ejemplos, security y errores en cada productor.
- [ ] Documentar estados, Retry-After y semántica eventual.
- [ ] Exportar desde `documentation/schemas/index.ts`.
- [ ] Verificar todos los contratos en `GET /api/docs`.

## Cierre

- [ ] Ejecutar `yarn lint && yarn typecheck && yarn test && yarn build`, separando deuda previa de regresiones.
- [ ] Validar todos los criterios de aceptación de `spec.md`.
- [ ] Ejecutar prueba de carga y calibrar concurrencia contra pool DB/CPU/memoria/proveedor.
- [ ] Confirmar revisión de seguridad de payloads, permisos, status y logs.
- [ ] Actualizar `../../constitution/roadmap.md` solo después de implementar y verificar la feature.

## Mantenimiento (checklist recurrente)

- [ ] Revisar backlog, edad, retry/failure rate, stalled, DLQ y outbox pendiente.
- [ ] Versionar payload/tipo ante cambios incompatibles y mantener consumidores durante el despliegue.
- [ ] Reevaluar timeout, concurrency, retention e idempotencia por cada nuevo tipo.
- [ ] Auditar periódicamente que ningún payload/log contenga secretos o datos excesivos.
