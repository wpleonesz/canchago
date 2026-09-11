# NNN · Agendamiento de canchas — Plan

_Este documento planifica una implementación posterior. No autoriza ni contiene código de producción._

## Enfoque

La implementación se dividirá en contratos pequeños pero coordinados. Primero se corrige el alcance de usuarios globales/tenant y se auditan datos. Luego se modelan recursos, franjas y reservas con integridad en PostgreSQL. Después se exponen endpoints por las capas obligatorias y, solo cuando el contrato real esté estable, se integra `canchago-ionic` siguiendo sus capas actuales.

La fuente de verdad de disponibilidad y autorización será siempre backend+base de datos. Ionic ofrecerá feedback y prevención de doble interacción, pero no decidirá disponibilidad ni scope.

## Implementación

### Fase 0 — Cierre del contrato y compatibilidad

1. **T01 · Auditoría previa** — consultar esquema/migraciones aplicadas y datos de `UserRole` para identificar Futbolistas con `organizationId`/`venueId`, gestores sin alcance y combinaciones heredadas.
2. **T02 · Contrato de usuarios** — definir `organizationId` opcional en creación/edición administrativa y reglas según roles resueltos, no según valores enviados.
3. **T03 · Validación/servicio de usuarios** — planificar cambios focalizados en `validations/users/`, `services/users/` y guardas existentes.
4. **T04 · Persistencia de roles** — planificar que `database/users/` derive el scope individual de cada rol y nunca copie ciegamente uno común a roles globales.

### Fase 1 — Persistencia del dominio

5. **T05 · Alcance del recurso** — relacionar conceptualmente cada recurso reservable con una `Venue`; reutilizar `Organization` mediante esa FK y `UserRole` para autorizar gestores, sin una relación gestor→cancha redundante.
6. **T06 · Modelo de recurso** — definir campos mínimos, estado cerrado, timestamps, soft delete, FK e índices.
7. **T07 · Modelo de franja** — definir recurso, intervalo UTC, estado mínimo, versión/timestamps y actor/auditoría.
8. **T08 · Modelo de reserva** — definir futbolista, recurso/franja, estado, timestamps y cancelación histórica.
9. **T09 · Idempotencia** — definir almacenamiento de clave, usuario, huella de request y respuesta/entidad resultante.
10. **T10 · Migración aditiva** — preparar una migración nueva con FKs, índices, checks y una garantía PostgreSQL de no solapamiento; verificar extensión/restricción en el mismo entorno real antes de fijar SQL.

### Fase 2 — Backend por capas

11. **T11 · Validaciones** — crear módulos Zod para parámetros, intervalos, estados, filtros, paginación, versión esperada e idempotencia.
12. **T12 · Acceso a datos** — crear repositorios separados para recursos/disponibilidad/reservas, con queries sin N+1 y filtros obligatorios de activo/soft delete/scope.
13. **T13 · Servicios de disponibilidad** — coordinar reglas, transiciones, solapes, concurrencia optimista, scope y auditoría sin conocer HTTP.
14. **T14 · Servicio de reserva** — revalidar recurso/franja, confirmar/cancelar en transacción, resolver idempotencia y mapear conflicto concurrente.
15. **T15 · Permisos y menús** — cerrar códigos consistentes con cada `access(...)`, incorporarlos al seed/auditoría y conceder mínimos al Futbolista y capacidades de scope al Gestor.
16. **T16 · API Routes** — crear rutas Pages Router con `auth → access → parsing → handler`, envelopes estándar y usuario tomado de `req.user`.
17. **T17 · OpenAPI** — registrar componentes y paths en `documentation/schemas/<módulo>.ts`, exportarlos y verificar `/api/docs` en paralelo con cada ruta.

### Fase 3 — Cliente Ionic después del backend estable

18. **T18 · Contrato móvil** — actualizar `canchago-ionic/spec/constitution/api-integration.md` leyendo rutas, schemas y respuestas implementadas.
19. **T19 · Tipos/validación** — crear DTOs estrictos y Zod solo para validación de entrada/UX; no duplicar disponibilidad.
20. **T20 · API client** — añadir endpoints en `src/services/api/endpoints/`, incluida propagación de idempotency key.
21. **T21 · Hooks** — implementar queries/mutations con TanStack Query, paginación, rangos acotados, invalidación focalizada y sin retry automático inseguro de POST.
22. **T22 · Gestión del Gestor** — selector de recurso, fecha, formulario/listado de franjas, acciones condicionadas y estados completos.
23. **T23 · Reserva del Futbolista** — catálogo, detalle, fecha, franja, resumen, confirmación, 409 con refetch y contexto preservado ante red.
24. **T24 · Mis reservas** — listado/detalle/cancelación propia con confirmación y estados reales.
25. **T25 · Navegación/guards/formulario de usuario** — adaptar menú y rutas por permisos, separar módulos del Futbolista y corregir la organización condicional del `UserForm`.

### Fase 4 — Verificación y cierre

26. **T26 · Pruebas backend** — unitarias junto a servicios/repositorios y de integración en `tests/integration/`, incluida concurrencia PostgreSQL real.
27. **T27 · Pruebas Ionic** — Vitest/Testing Library para servicios, hooks, componentes, navegación y errores; Cypress solo para flujos que la infraestructura existente pueda ejecutar.
28. **T28 · Gates reales** — backend: `yarn generate`, `yarn lint`, `yarn typecheck`, `yarn test`, `yarn build`; móvil: `yarn lint`, `yarn typecheck`, `yarn test`, `yarn build`, `yarn cap:sync` y build nativo disponible.
29. **T29 · Cierre documental** — actualizar roadmaps y contrato móvil únicamente al completar la implementación y distinguir fallos preexistentes de regresiones nuevas.

## Diseño de pruebas

### Backend

- **P01:** registro público de Futbolista sin organización/sede permanece válido.
- **P02:** creación administrativa de Futbolista global sin organización es válida.
- **P03:** edición/asignación del rol global no añade scope.
- **P04:** scope enviado para rol global se ignora de forma segura o se rechaza según contrato cerrado.
- **P05:** rol tenant sin organización se rechaza.
- **P06:** rol tenant de otra organización se rechaza.
- **P07:** Gestor administra un recurso dentro de su organización/sede.
- **P08:** ID de recurso de otra organización produce 403 sin escritura.
- **P09:** permiso funcional sin scope suficiente produce 403.
- **P10:** inicio igual/posterior al fin se rechaza.
- **P11:** intervalo fuera de reglas configuradas se rechaza.
- **P12:** recurso/sede/organización inactiva impide publicar.
- **P13:** franja duplicada se rechaza con 409.
- **P14:** franja parcialmente solapada se rechaza.
- **P15:** franja contenida/continente se rechaza.
- **P16:** franjas adyacentes se aceptan si la política las considera no solapadas.
- **P17:** franja reservada no se mueve/elimina físicamente.
- **P18:** Futbolista sin scope lista recursos habilitados de varias organizaciones.
- **P19:** disponibilidad devuelve solo franjas seleccionables.
- **P20:** reserva usa el usuario de sesión y no acepta suplantación.
- **P21:** reserva válida queda ligada a usuario, recurso y franja.
- **P22:** confirmar sobre franja ocupada/retirada responde 409.
- **P23:** dos transacciones concurrentes sobre la misma franja crean una sola reserva.
- **P24:** recursos distintos pueden reservarse simultáneamente.
- **P25:** repetir clave+payload devuelve la misma reserva sin duplicado.
- **P26:** repetir clave con otro payload se rechaza.
- **P27:** claves de usuarios distintos no colisionan.
- **P28:** usuario cancela una reserva propia permitida y libera la franja.
- **P29:** usuario no cancela una reserva ajena.
- **P30:** cancelación repetida conserva consistencia y respuesta contractual.

### Ionic

- **P31:** navegación del Futbolista muestra Canchas/Mis reservas y no administración.
- **P32:** navegación del Gestor muestra disponibilidad solo con permiso real.
- **P33:** acceso directo sin permiso presenta denegación.
- **P34:** catálogo cubre loading/empty/error/success y retry.
- **P35:** fecha sin horarios muestra empty state.
- **P36:** solo una franja libre puede seleccionarse.
- **P37:** confirmación bloquea doble toque y conserva una clave estable.
- **P38:** 409 informa franja tomada, limpia selección y refresca.
- **P39:** error de red preserva el contexto y reintenta de forma idempotente.
- **P40:** 401 activa el flujo de autenticación y 403 muestra acceso denegado.
- **P41:** Mis reservas y cancelación reflejan el estado confirmado por backend.

### Compatibilidad e integración

- **P42:** migración sobre copia con datos existentes no pierde usuarios/roles/organizaciones/sedes.
- **P43:** auditoría de scopes heredados produce resultado trazable antes de normalizar.
- **P44:** endpoints existentes conservan contratos y suites.
- **P45:** OpenAPI renderiza todos los endpoints y errores nuevos.
- **P46:** flujo integrado backend→API→Ionic funciona en navegador de desarrollo y target nativo disponible.

## Decisiones

- **Recurso agnóstico como entidad raíz** — deriva de `mission.md`; “cancha” queda en la presentación.
- **Scope por `UserRole`, no membresía del futbolista** — reutiliza el modelo real y evita una FK usuario→cancha injustificada.
- **Franja concreta antes que recurrencia compleja** — satisface publicación y reserva con menor riesgo; generación múltiple puede expandirse a franjas concretas dentro de una transacción.
- **Estado ocupado preferentemente derivado** — evita sincronizar dos fuentes de verdad; la decisión final dependerá del modelo de restricción elegido.
- **Integridad en PostgreSQL** — una comprobación previa de aplicación no elimina carreras. Se preferirá exclusión por rango/recurso o un mecanismo transaccional equivalente probado.
- **Idempotencia explícita** — deshabilitar el botón no cubre reintentos de red o retransmisión.
- **Sin cuota por futbolista** — la única limitación es la disponibilidad e integridad de cada franja; no se añade contador diario/semanal.
- **Cancelación lógica** — conserva trazabilidad y vuelve a habilitar la franja solo dentro de la misma transacción.
- **Permisos más scope y ownership** — RBAC define capacidad; las relaciones reales delimitan el objeto concreto.
- **Backend antes que móvil** — Ionic no consumirá contratos inventados.

## Riesgos

- **No hay dominio previo de reservas** — mantener MVP mínimo y no introducir pagos/recurrencia.
- **Nombre físico aún no aprobado** — cerrar modelos, enums, rutas y permisos en OpenAPI/esquema antes de código.
- **Scopes heredados incoherentes** — auditar y migrar de forma aditiva, con respaldo y sin borrar usuarios.
- **Solapamiento concurrente** — probar la garantía contra PostgreSQL real, no solo mocks.
- **Estados duplicados entre franja/reserva** — derivar ocupación cuando sea posible y probar todas las transiciones.
- **Zona horaria/DST** — API y persistencia UTC; cliente solo transforma en los límites.
- **Retry incierto** — idempotencia persistente y estado “resultado desconocido” en UI ante corte de red.
- **N+1/listados grandes** — selects/includes agregados controlados y paginación donde crezca el volumen.
- **Deuda preexistente de build/tests** — registrar línea base antes de implementar; no atribuirla a la feature ni declarar cierre con regresiones propias.
