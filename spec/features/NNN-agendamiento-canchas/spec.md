# NNN · Agendamiento de canchas

**Estado:** implementada, en cierre técnico

## Qué hace

Incorpora el contrato funcional completo para que un Gestor de Cancha prepare, publique y administre horarios reservables de las canchas bajo su alcance, y para que un Futbolista autenticado —sin pertenecer administrativamente a ninguna cancha, sede u organización— descubra canchas habilitadas, consulte franjas realmente libres, reserve una para sí mismo y consulte sus propias reservas desde `canchago-ionic`.

La feature mantiene separados dos conceptos:

- **Alcance administrativo:** se deriva de los roles y asociaciones del gestor.
- **Agendamiento:** relaciona temporalmente a un futbolista con una cancha/franja, sin crear membresía, rol ni alcance administrativo.

## Por qué

El motor de reservas es parte de la misión y permanece en el backlog. La inspección confirmó que aún no existe persistencia, servicio, endpoint ni UI de canchas/recursos reservables, disponibilidad, horarios o reservas. También confirmó una inconsistencia previa que esta feature debe corregir sin romper el registro público: el CRUD administrativo de usuarios exige `organizationId` a todos, aunque `Futbolista` sea un rol global.

## Base verificada y dependencias

### Backend `canchago`

- Next.js Pages Router + `next-connect`: `pages/api/ → middleware → services/ → database/ → Prisma`.
- PostgreSQL y Prisma 7, con una única instancia en `database/client.ts` y migraciones SQL acumulativas en `prisma/migrations/`.
- `Organization` posee muchas `Venue`; todavía no existe una entidad reservable asociada a `Venue`.
- `User` no tiene FK directa a organización o sede. `UserRole` contiene `organizationId?` y `venueId?` como alcance opcional.
- `Role.organizationId = null` representa un rol global. El seed define `Futbolista` global y `Gestor de Cancha` por organización.
- El registro público ya crea al Futbolista con `UserRole` sin organización/sede. El gestor crea organización+sede pendientes y recibe el rol con alcance al aprobarse la solicitud.
- `createUserSchema` exige actualmente `organizationId`; `createWithRoles` lo copia a todas las asignaciones. Es la dependencia incorrecta para un Futbolista global.
- La sesión se resuelve en backend y entrega roles/permisos efectivos. `auth` acepta cookie o Bearer; `access(...)` valida permisos.
- Los servicios de organizaciones/sedes ya usan guardas de alcance, `expectedUpdatedAt`, errores 403/404/409, soft delete y auditoría.
- No existen modelos, enums, migraciones, endpoints, permisos ni reglas previas de disponibilidad/reserva que deban conservarse.

### Cliente `canchago-ionic`

- Ionic React 8 + React Router 5, TanStack Query, Zustand, Axios, React Hook Form y Zod.
- Capas verificadas: tipos API → `services/api/endpoints` → hooks de feature → componentes/páginas → rutas.
- Toda sesión autenticada entra a `/admin`; el menú lateral se filtra por permisos efectivos.
- Existen guards de ruta, taxonomía de errores, alertas Ionic y estados compartidos de carga, vacío y error.
- El registro ya separa `PlayerRegisterForm` (sin organización/sede) y `ManagerRegisterForm` (con ambas).
- El `UserForm` administrativo exige hoy una organización, reflejando el contrato generalizado del backend.
- No existen tipos, servicios, hooks, componentes, páginas ni rutas de canchas, disponibilidad o reservas.

## Alcance funcional

### Cancha o recurso reservable

La constitución exige una abstracción agnóstica denominada conceptualmente **recurso reservable**; “cancha” será el término de UI. La implementación posterior deberá cerrar el nombre físico siguiendo el inglés usado por Prisma y confirmar si adopta `Resource` en lugar de un modelo específico `Court`.

Cada recurso deberá:

- pertenecer a una única sede y, por esa relación, a una organización;
- tener identidad, descripción mínima, estado habilitado/deshabilitado y timestamps;
- aplicar soft delete si puede ser referenciado por reservas históricas;
- exponer solo registros habilitados al Futbolista;
- poder ser administrado únicamente desde un alcance de organización/sede compatible.

### Disponibilidad o franja

Una franja representa un intervalo concreto publicable para un recurso y deberá relacionarse con el gestor que la creó o modificó cuando el patrón de auditoría existente lo permita. Los nombres físicos y enums se decidirán en el plan de implementación después de validar la migración propuesta.

Estados mínimos conceptuales:

- **Borrador:** visible solo para gestores; puede editarse o publicarse.
- **Publicada/libre:** seleccionable por futbolistas.
- **Ocupada:** tiene una reserva activa y no es seleccionable.
- **Retirada/cancelada:** no es seleccionable; conserva trazabilidad.

La implementación puede derivar “ocupada” de una reserva bloqueante en vez de almacenarlo, si eso evita estados duplicados. No se aceptarán más estados sin una transición y un caso de negocio demostrables.

El gestor podrá crear una franja individual. La creación múltiple o repetitiva solo se incluirá si puede resolverse transaccionalmente, sin duplicados y sin introducir un motor de recurrencia innecesario.

### Reserva o agendamiento

Una reserva deberá relacionar:

- al Futbolista autenticado que confirma;
- al recurso/cancha;
- a la franja concreta o, si el diseño final usa intervalos directamente, al intervalo inmutable reservado;
- su estado, timestamps y trazabilidad de cancelación.

El ID del futbolista se obtiene exclusivamente de la sesión. Nunca se acepta un `userId` arbitrario en el body. Crear una reserva no crea ni actualiza `UserRole`.

Estados mínimos conceptuales: **confirmada** y **cancelada**. No se incorpora pago ni un estado pendiente sin una necesidad transaccional real.

## Reglas de negocio

### Gestión de disponibilidad

- Inicio y fin son timestamps UTC válidos y `inicio < fin`.
- La duración debe ser positiva y respetar límites que se definan explícitamente para el recurso; no se inventará un límite global sin decisión de negocio.
- No se crean franjas para recursos, sedes u organizaciones inactivas o eliminadas.
- Dos franjas activas/publicables del mismo recurso no pueden solaparse ni duplicarse.
- El gestor solo opera sobre recursos alcanzados por su `UserRole.organizationId` y, si existe, `venueId`.
- Una franja sin reserva puede editarse o retirarse conforme a su estado y concurrencia optimista.
- Una franja reservada no puede mover su intervalo, cambiar de recurso ni eliminarse físicamente.
- Retirar/cancelar una franja reservada requiere cancelar coherentemente la reserva en la misma transacción o rechazarse; la política exacta debe cerrarse antes de implementar y notificarse al usuario.
- Listados con volumen creciente usan paginación; la consulta por fecha puede limitarse por rango validado.
- La programación habitual es mensual: el Gestor selecciona un mes, uno o varios días de la semana y uno o varios bloques de hora. El cliente presenta la plantilla como franjas UTC concretas y el backend las valida y persiste en una sola transacción.
- La operación mensual es todo-o-nada: si cualquier franja resulta inválida, duplicada o solapada, no se crea ninguna.
- El Gestor puede omitir un día de la plantilla mensual, retirar una franja futura sin reserva y volver a publicar una franja retirada.

### Consulta y reserva del Futbolista

- El Futbolista consulta recursos habilitados de distintas organizaciones sin pertenecer a ellas.
- Puede reservar de lunes a domingo y tantas franjas distintas como considere; no existe un cupo diario, semanal ni total por usuario.
- La ausencia de cupo personal nunca permite ocupar una franja no disponible ni crear reservas solapadas para el mismo recurso.
- Solo ve como seleccionables franjas publicadas, futuras, no retiradas y sin reserva bloqueante.
- La disponibilidad mostrada no garantiza la reserva: el backend revalida todos los invariantes al confirmar.
- La operación de confirmación es atómica y la base de datos arbitra la concurrencia.
- Una clave de idempotencia por usuario/operación evita duplicados por doble toque o reintento de red; reutilizar la misma clave con otro payload se rechaza.
- Una cancelación propia, si se permite por política temporal/estado, conserva la reserva como histórica y libera la franja atómicamente.
- Un Futbolista solo lista, consulta o cancela reservas cuyo usuario sea el de sesión.

## Autorización y seguridad

- Todas las rutas de gestión usan `auth`, permisos específicos y una guarda de alcance en servicio; validar solo el permiso no basta.
- Las rutas del Futbolista usan permisos mínimos de lectura de recursos/disponibilidad y creación/lectura propia de reservas.
- Los IDs de organización, sede, recurso, franja o reserva se validan con Zod y vuelven a contrastarse con relaciones reales en backend.
- Un Gestor no administra recursos o franjas de otra organización/sede mediante IDs manipulados.
- Un Futbolista no administra disponibilidad, no reserva por otro usuario y no consulta/modifica reservas ajenas.
- Los controles ocultos en Ionic son UX; la decisión definitiva siempre pertenece al backend.
- Errores internos de Prisma/PostgreSQL se transforman a los envelopes existentes y nunca se exponen.

## Operaciones API requeridas

Los nombres definitivos deberán registrarse primero en OpenAPI. Según la convención Pages Router real, la implementación requerirá operaciones equivalentes a:

| Operación | Entrada principal | Salida | Seguridad/errores |
|---|---|---|---|
| Listar canchas/recursos habilitados | paginación y filtros en lista blanca | colección paginada | sesión + permiso de lectura; 400/401/403 |
| Consultar detalle reservable | ID de recurso | recurso habilitado | 401/403/404 |
| Gestionar recursos del gestor | IDs de organización/sede, body validado | recurso | permiso + scope; 400/403/404/409 |
| Listar franjas del gestor | recurso, fecha/rango, paginación cuando aplique | franjas libres/ocupadas/retiradas | permiso + scope |
| Crear/publicar/editar/retirar franja | recurso, intervalo, estado y versión esperada | franja | permiso + scope; 400/403/404/409/422 |
| Consultar disponibilidad seleccionable | recurso y fecha/rango acotado | solo franjas libres | sesión + lectura; 400/401/403/404 |
| Confirmar reserva propia | recurso/franja e idempotency key | reserva creada | usuario desde sesión; 401/403/404/409/422 |
| Listar/consultar reservas propias | paginación/filtros permitidos | reservas del usuario de sesión | 401/403/404 |
| Cancelar reserva propia | ID y versión esperada si aplica | reserva cancelada o 204 | ownership; 403/404/409 |
| Consultar reservas administradas | alcance y filtros | colección paginada | permiso administrativo + scope |

No se reutilizarán endpoints de organizaciones/sedes para lógica de reserva; solo se usarán sus IDs y relaciones verificadas. Las rutas finales deben seguir `pages/api/<recurso>/index.ts`, `[resourceId].ts` y subrecursos anidados de un nivel.

## Persistencia y migración

- Crear una migración nueva; nunca alterar migraciones aplicadas.
- Incorporar conceptualmente recurso reservable, franja de disponibilidad, reserva e idempotencia, o una estructura equivalente mínima que satisfaga las reglas.
- Usar UUID, UTC (`Timestamptz`), enums Prisma para estados, `onDelete` explícito, índices de FKs/estado/intervalo y soft delete donde exista histórico.
- Preservar todas las organizaciones, sedes, usuarios y roles existentes; las tablas nuevas parten vacías y no requieren backfill destructivo.
- Auditar Futbolistas existentes con alcance heredado. Normalizar únicamente asociaciones incompatibles con el rol global, sin borrar usuarios ni reservas y con respaldo/diagnóstico previo.
- La exclusión de solapamientos deberá resolverse con capacidades reales de PostgreSQL. El diseño preferido es una restricción de exclusión por recurso e intervalo para estados bloqueantes, expresada en la migración SQL si Prisma no puede representarla. Si el entorno no soporta esa opción, deberá justificarse un bloqueo transaccional equivalente y probarse contra PostgreSQL real.
- La reserva se confirma en transacción; las violaciones de concurrencia se traducen a 409.
- La idempotencia tendrá unicidad por usuario y clave, conservará una huella del payload y devolverá el resultado previo ante una repetición idéntica.
- La auditoría existente se ampliará solo con acciones necesarias para creación/cambio/retiro de franja y creación/cancelación de reserva; además se conservarán `createdAt`/`updatedAt` y actor.

## Experiencia Ionic React

### Gestor de Cancha

- Sección de disponibilidad visible solo con permisos efectivos.
- Selector de cancha cuando el alcance contenga más de una; no se confía en ese selector para autorizar.
- Flujo guiado y minimalista: cancha/mes, días activos y bloques horarios. No se solicitan timestamps ni un rango técnico de inicio/fin.
- Vista previa del número de jornadas y franjas antes de publicar el mes.
- Distinción visual accesible entre libre, ocupada y retirada/cancelada, sin depender solo del color.
- Edición/retiro condicionados por estado y versión; confirmaciones con alertas Ionic.
- Estados `loading`, `empty`, `error` y `success`, incluidos ausencia de canchas y falta de permisos.

### Futbolista

- Navegación dedicada para “Canchas” y “Mis reservas”, separada de módulos administrativos pero compatible con el shell actual.
- Catálogo paginado/remoto de canchas habilitadas, selección de cancha y fecha.
- Visualización exclusiva de franjas seleccionables devueltas por backend.
- Resumen antes de confirmar, botón bloqueado durante envío e idempotency key estable durante el intento.
- Ante 409 por franja tomada: mensaje comprensible, deselección y actualización inmediata de disponibilidad.
- Ante error de red: mantener contexto y permitir reintento con la misma clave, sin asumir que la reserva falló.
- Ante sesión expirada: usar el flujo 401 existente. Ante 403: estado de acceso denegado.
- “Mis reservas” muestra estados reales, detalle y cancelación solo cuando backend la permita.

Se reutilizarán `apiClient`, `errorMapper`, TanStack Query, Zod/React Hook Form, guards, `AppButton`, `AppDataList`, `AppEmptyState`, `AppErrorState`, `AppSkeleton`, `AppInteractionAlert` y navegación Ionic existente. Se evitarán tarjetas anidadas y lógica de negocio duplicada.

## Criterios de aceptación

- [ ] Un Gestor autorizado prepara y publica horarios únicamente para recursos dentro de su alcance real.
- [ ] El Gestor no puede crear intervalos inválidos, duplicados o solapados en un mismo recurso.
- [ ] Un Futbolista sin organización, sede o cancha puede registrarse, autenticarse y acceder al flujo.
- [ ] Crear o editar un Futbolista no exige organización; asignar un rol tenant sí exige alcance compatible.
- [ ] El Futbolista consulta canchas habilitadas de diferentes organizaciones y sus horarios disponibles.
- [ ] Solo las franjas publicadas, futuras, vigentes y libres aparecen como seleccionables.
- [ ] El Futbolista confirma una reserva válida para sí mismo.
- [ ] El Futbolista puede reservar cualquier día de lunes a domingo y múltiples veces, siempre que cada franja continúe disponible.
- [ ] La reserva relaciona futbolista, recurso y franja/intervalo sin crear membresía administrativa.
- [ ] Dos confirmaciones concurrentes no pueden ocupar la misma franja; solo una termina creada.
- [ ] Un doble toque, retry o retransmisión con la misma clave no crea una segunda reserva.
- [ ] El Futbolista no suplanta otro usuario ni consulta, cancela o modifica reservas ajenas.
- [ ] El Gestor no administra horarios o reservas fuera de su alcance alterando IDs.
- [ ] Una franja reservada no puede modificarse o retirarse dejando datos inconsistentes.
- [ ] Cancelar una reserva, cuando esté permitido, libera la franja de manera atómica y conserva historial.
- [ ] Cancha, sede u organización deshabilitada impiden publicar disponibilidad y confirmar reservas.
- [ ] Backend y app presentan errores de validación, permiso, conflicto y red en español y de forma consistente.
- [ ] La app cubre `loading`, `empty`, `error` y `success` en gestión, disponibilidad y reservas propias.
- [ ] La app no muestra controles administrativos al Futbolista y todos los accesos directos quedan protegidos.
- [ ] Listados crecientes están paginados y las consultas evitan N+1 mediante selecciones/relaciones agregadas.
- [ ] Usuarios, autenticación, roles, permisos, organizaciones, sedes, perfil y registro existentes no sufren regresiones.
- [ ] Las migraciones se aplican sobre una copia/base compatible con datos existentes sin pérdida ni FKs inválidas.
- [ ] Las suites y gates reales de ambos repositorios terminan sin regresiones atribuibles a la feature.

### Documentación (obligatorio)

- [ ] Todos los endpoints finales están registrados en `documentation/schemas/<módulo>.ts` con `registry.registerPath()`.
- [ ] Todos los schemas de entrada/salida están registrados con `registry.registerComponent()`.
- [ ] El módulo se exporta desde `documentation/schemas/index.ts`.
- [ ] `GET /api/docs` muestra correctamente seguridad, entradas, envelopes, ejemplos y errores.
- [ ] `canchago-ionic/spec/constitution/api-integration.md` refleja el contrato verificado, no un supuesto.

## Matriz de trazabilidad

| Requisito | Diseño | Tareas | Pruebas previstas |
|---|---|---|---|
| Scope de Gestor | Guardas por organización/sede en servicio | T05, T12 | P07–P09 |
| Futbolista sin afiliación | Rol global y alcance derivado por rol | T02–T04 | P01–P06 |
| Disponibilidad válida | Intervalos UTC + estado + exclusión de solapes | T06–T10 | P10–P17 |
| Reserva propia atómica | Usuario de sesión + transacción + restricción DB | T11–T14 | P18–P24 |
| Idempotencia | Clave única y huella del payload | T13 | P25–P27 |
| Cancelación consistente | Transición transaccional e histórico | T14 | P28–P30 |
| Experiencia móvil por rol | Permisos, rutas, hooks y estados compartidos | T18–T25 | P31–P41 |
| Compatibilidad | Migración aditiva y suites completas | T01, T26–T29 | P42–P46 |

## Fuera de alcance

- Pagos, facturación, precios dinámicos, promociones, torneos, chat, reseñas, mapas y notificaciones push.
- Reservas recurrentes y listas de espera.
- Un motor genérico de recurrencia para disponibilidades salvo aprobación posterior.
- Cambiar el proveedor o flujo de autenticación existente.
- Refactorizaciones globales de navegación/UI o de módulos ajenos.
- Implementar cualquier código, componente o migración como parte de esta tarea documental.
