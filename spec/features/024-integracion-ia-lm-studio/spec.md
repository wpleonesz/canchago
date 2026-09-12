# 024 · Integración de IA con LM Studio

**Estado:** implementado ✅

**Verificación del entorno local (2026-09-12):** LM Studio confirmó su servidor compatible en la URL mostrada por su CLI, `GET /v1/models` respondió `200` y `POST /v1/chat/completions` respondió el error esperado de “modelo no cargado”. El servidor se detuvo al terminar. No se cargó un modelo de varios GB; la ejecución generativa real permanece como prueba manual optativa y toda la suite automatizada usa un proveedor falso.

## Qué hace

Incorpora en Canchago una capacidad de asistencia de lenguaje respaldada inicialmente por un modelo local servido por LM Studio. La aplicación móvil nunca se conecta a LM Studio: envía solicitudes acotadas al backend de Canchago, el backend obtiene primero los datos autorizados desde PostgreSQL, construye un contexto mínimo, consulta al proveedor, normaliza la salida y devuelve una respuesta segura y tipada.

La primera versión ofrece dos casos de uso pequeños, útiles y demostrables con datos que ya existen:

1. **Recomendación asistida de horarios para futbolistas.** El usuario indica un rango futuro y, opcionalmente, una franja del día y un precio máximo. El backend consulta recursos `ACTIVE` y franjas `PUBLISHED` realmente disponibles, limita el conjunto candidato y pide al modelo explicar y ordenar esas opciones. Cada sugerencia referencia identificadores reales devueltos por el backend. La IA no declara disponibilidad por sí sola ni crea la reserva; al elegir una sugerencia, la app continúa con `POST /api/bookings` y sus reglas actuales.
2. **Resumen de reservas propias próximas.** El backend consulta únicamente reservas `CONFIRMED` del usuario autenticado dentro de un horizonte limitado y solicita una síntesis en español. No acepta un `userId` del cliente y no incluye reservas de terceros. Una colección vacía produce un estado `empty` determinista sin invocar al modelo.

La app incorpora una sección móvil llamada **Asistente IA** dentro del grupo real “Agendamiento”, visible solo cuando la sesión posee los permisos requeridos. El flujo pedagógico principal permite observar: preferencias estructuradas → petición HTTP a Canchago → consulta autorizada de datos → llamada backend a LM Studio → normalización → presentación como recomendación no vinculante.

## Por qué

La recomendación reduce el trabajo de revisar manualmente canchas y horarios, mientras que el resumen convierte reservas propias ya disponibles en una explicación breve. Los dos casos usan `Resource`, `Venue`, `Organization`, `AvailabilitySlot` y `Booking`; no requieren inventar perfiles deportivos, clima, estadísticas ni datos nuevos.

La feature también funciona como ejemplo académico integrado a la arquitectura real. Permite enseñar separación de responsabilidades, DTOs validados, autenticación Bearer/cookie, RBAC, minimización de datos, timeout, errores normalizados y consumo de un servicio externo desde Ionic React sin distribuir secretos ni acoplar el cliente móvil al proveedor.

## Alcance funcional y contrato

### Operaciones mínimas

- `POST /api/ai/slot-recommendations`: requiere sesión, `resources.read` y `availability.read`. Recibe exclusivamente preferencias estructuradas: `from`, `to`, `preferredTimeOfDay?` (`MORNING | AFTERNOON | EVENING`) y `maxHourlyPrice?`. El rango es futuro, `from < to` y no supera siete días. El precio, cuando se envía, es no negativo y se compara como decimal en backend. No acepta prompt, instrucciones de sistema, `userId`, texto libre ni campos de ordenamiento dinámico.
- `POST /api/ai/upcoming-bookings-summary`: requiere sesión y `bookings.read.own`. Recibe como máximo un horizonte futuro acotado en días; nunca recibe `userId`. El backend selecciona las reservas propias confirmadas y sus datos mínimos de recurso, sede, inicio, fin y estado.

Las respuestas exitosas usan `{ data: ... }`. Una recomendación contiene un texto breve marcado como generado por IA y una lista limitada de referencias a candidatos reales (`resourceId`, `availabilitySlotId`) con los datos objetivos que el backend ya verificó. El resumen contiene el texto generado y la cantidad de reservas consideradas. La respuesta no incluye URL, modelo, instrucciones internas, prompt completo ni respuesta cruda del proveedor.

Los límites numéricos definitivos de candidatos, caracteres de entrada/salida, tokens y horizonte del resumen se fijarán como constantes backend documentadas durante implementación; deben ser finitos, cubiertos por Zod y pruebas, y no configurables desde Ionic. El límite de siete días de recomendaciones forma parte del contrato inicial para controlar volumen y obsolescencia.

### Información permitida y fuente de verdad

- Para recomendaciones: nombre y descripción opcional del recurso, nombre de sede y organización, dirección, precio/hora, moneda, inicio y fin de franjas publicadas libres. Coordenadas no se envían al modelo porque no se necesita cálculo geográfico; la app puede conservar su enlace existente “Cómo llegar” desde el DTO objetivo.
- Para resúmenes: nombre del recurso y sede, inicio, fin y estado de reservas propias confirmadas. No se envían email, nombre del usuario, perfil, redes sociales, tokens, roles, permisos, identificadores de sesión, precios si no aportan al resumen, ni reservas de terceros.
- El backend consulta y filtra antes de invocar al proveedor. El modelo no consulta la base de datos, no determina alcance, permisos, disponibilidad o precio, no modifica entidades y no llama operaciones administrativas.
- La respuesta del modelo es contenido no confiable. El backend exige una estructura validable, descarta referencias que no pertenezcan al conjunto candidato, limita longitud, normaliza espacios y trata respuestas vacías, inválidas o fuera de contexto como fallo del proveedor.
- Las instrucciones de sistema son construidas por el backend. Las preferencias del usuario se serializan como datos delimitados y no pueden reemplazar instrucciones, pedir secretos, ampliar el contexto o ejecutar herramientas.

### Roles y autorización

- **Futbolista:** puede usar recomendaciones con `resources.read` + `availability.read` y resúmenes con `bookings.read.own`; esos permisos ya están asignados por `prisma/seed-dev.ts`. Solo recibe opciones públicas/autorizadas y sus propias reservas.
- **Gestor de Cancha:** puede acceder únicamente a las operaciones cuyos permisos ya posea. La recomendación usa el mismo catálogo público de recursos; el resumen sigue siendo de sus propias reservas, no de “reservas recibidas”. No se incluye en esta versión un asistente de gestión porque no añade suficiente valor frente al listado existente.
- **Administrador u otros roles:** el acceso deriva de permisos efectivos, nunca del nombre del rol. No se introduce un permiso `ai.*` en esta primera versión; la API combina los permisos de dominio que protegen los datos usados. Si producto requiere habilitación independiente, será una decisión de RBAC posterior con su propia migración/seed y revisión de menús.

## Seguridad, privacidad y operación

- LM Studio se configura solo en `canchago` mediante `lib/config/env.ts` y `.env.example`: URL base, identificador de modelo, timeout y límites técnicos explícitos. No se fija puerto ni modelo en la spec y ninguna variable `VITE_*` contiene configuración del proveedor.
- La integración usa una interfaz de proveedor interna y un adaptador LM Studio compatible con su API. Los casos de uso dependen de la interfaz, no de LM Studio, para permitir sustituirlo por otro proveedor compatible sin cambiar rutas, DTOs ni UI.
- Se aplica rate limit por usuario autenticado y operación. El patrón actual es `rate-limiter-flexible` en memoria; la implementación debe documentar que al escalar horizontalmente el límite es por proceso y migrar a Redis antes de depender de un límite global.
- No se persisten prompts, conversaciones ni respuestas. Los logs Pino incluyen `requestId`, operación, proveedor lógico, duración, resultado y categoría de error, pero no prompt, respuesta generada, secretos, tokens ni contexto personal.
- No se renderiza HTML generado ni se usa `dangerouslySetInnerHTML`; Ionic presenta la respuesta como texto. No se interpreta texto libre como acción. Una reserva solo ocurre tras selección explícita y mediante el endpoint transaccional existente.
- La funcionalidad de IA es opcional y aislada: errores del proveedor nunca alteran recursos, disponibilidad, reservas, usuarios, roles u organizaciones.
- El backend es el único equipo que necesita alcanzar LM Studio. `localhost` en un teléfono/emulador no representa necesariamente la máquina del backend y nunca se usará desde Ionic. Si backend y LM Studio viven en equipos distintos, se debe validar bind address, firewall, red confiable y controles de acceso antes de habilitar la conexión; LM Studio no debe exponerse directamente a Internet.

### Errores y degradación

El backend distingue y normaliza, sin filtrar detalles internos:

- LM Studio apagado, URL inalcanzable o error de conexión → `503 AI_PROVIDER_UNAVAILABLE`.
- Modelo no cargado/no encontrado o respuesta HTTP equivalente → `503 AI_MODEL_UNAVAILABLE`.
- Timeout → `504 AI_PROVIDER_TIMEOUT`.
- Saturación/rate limit local o del proveedor → `429 TOO_MANY_REQUESTS` con mensaje reintentable.
- Respuesta vacía, malformada, demasiado larga o con referencias ajenas → `502 AI_INVALID_RESPONSE`.
- Sin candidatos o sin reservas → `200` con resultado vacío tipado; no es un fallo y no invoca al modelo.

Los mensajes al usuario están en español y dejan claro que el resto de Canchago continúa disponible. La app representa `idle`, `loading`, `success`, `empty` y `error`, deshabilita el envío durante `loading`, no reintenta automáticamente los `POST` y ofrece “Reintentar” en fallos recuperables.

## Objetivo educativo y documentación futura

La implementación deberá acompañarse de una guía técnica que muestre, dentro de esta misma arquitectura:

1. cómo levantar LM Studio y cargar un modelo compatible elegido localmente;
2. cómo obtener y configurar URL/modelo en variables exclusivas del backend sin asumir valores;
3. cómo verificar conectividad backend → LM Studio y la red cuando están en equipos distintos;
4. cómo una pantalla Ionic envía el DTO al endpoint controlado;
5. cómo `auth` + `access` + Zod preceden a la consulta de datos y a la invocación externa;
6. cómo el servicio arma contexto mínimo, aplica timeout, valida la respuesta y mapea errores;
7. cómo Axios/TanStack Query muestran la respuesta normalizada y sus cinco estados;
8. cómo ejecutar pruebas automatizadas con un proveedor simulado y una prueba manual optativa con LM Studio real.

La guía no será un segundo ejemplo aislado ni propondrá conectar Ionic directamente al proveedor.

## Criterios de aceptación

- [x] Existe una arquitectura documentada y ejecutable `Ionic → canchago → proveedor de IA (LM Studio)` sin conexión directa entre Ionic y LM Studio.
- [x] La URL, el modelo, timeout y límites del proveedor permanecen en la configuración validada del backend y no aparecen en el bundle ni en variables `VITE_*`.
- [x] La recomendación usa exclusivamente recursos activos y franjas futuras `PUBLISHED` libres obtenidas por backend, y el resumen usa exclusivamente reservas confirmadas propias.
- [x] Los DTOs no aceptan prompts arbitrarios, `userId`, instrucciones del sistema ni campos adicionales.
- [x] Antes de invocar al modelo, el backend valida sesión, permisos y entrada Zod; una solicitud no autorizada no llega al proveedor.
- [x] Un futbolista nunca obtiene por IA reservas ni información privada de otro usuario.
- [x] Solo se envían al proveedor los campos mínimos enumerados en esta spec; pruebas inspeccionan el payload saliente.
- [x] El modelo no concede permisos, no declara disponibilidad por sí mismo y no crea, cancela o modifica ninguna entidad.
- [x] Toda referencia generada se valida contra candidatos reales; una referencia inventada provoca respuesta inválida, no se muestra como opción.
- [x] Elegir una recomendación lleva al flujo normal de reserva y `POST /api/bookings` vuelve a comprobar disponibilidad de forma atómica.
- [x] Los fallos de LM Studio no interrumpen autenticación, roles, recursos, disponibilidad ni reservas.
- [x] Conexión fallida, modelo no disponible, timeout, saturación y respuesta vacía/inválida tienen códigos y mensajes explícitos.
- [x] Una colección sin candidatos/reservas devuelve un estado vacío estable sin invocar LM Studio.
- [x] La app muestra `idle`, `loading`, `success`, `empty` y `error`, bloquea pulsaciones simultáneas y permite reintentar errores recuperables.
- [x] La salida se presenta como texto escapado y como asistencia generada por IA, con advertencia de verificar disponibilidad antes de reservar.
- [x] No se persisten prompts o conversaciones y los logs no contienen secretos, contexto personal ni respuesta generada.
- [x] Sustituir LM Studio por otro adaptador compatible no requiere cambiar la UI, los DTOs ni los servicios de dominio de reservas.
- [x] La documentación pedagógica explica el recorrido completo, la configuración local y la diferencia de red entre backend, emulador y dispositivo.
- [x] Pruebas automatizadas no dependen de un modelo real y existe una comprobación manual separada, optativa, con LM Studio levantado.
- [x] `yarn lint`, `yarn typecheck`, `yarn test` y `yarn build` pasan en ambos repositorios, descontando únicamente deudas preexistentes reproducidas y documentadas antes de la implementación.
- [x] No existen regresiones en autenticación, autorización, aislamiento multi-tenant, recursos, disponibilidad o agendamiento.

### Documentación (obligatorio)

- [x] Los dos endpoints están registrados en `documentation/schemas/ai.ts` mediante `registry.registerPath()` con cookie/Bearer auth, requests y respuestas completas.
- [x] Los schemas de entrada, salida y errores de IA están registrados con el mecanismo real `registry.register()` usado por el proyecto.
- [x] El módulo está importado desde `documentation/schemas/index.ts`.
- [x] Los endpoints y schemas son visibles y correctos en `GET /api/docs` (Swagger UI), incluyendo 200, 400, 401, 403, 429, 502, 503 y 504.

## Fuera de alcance

- Chat libre, proxy genérico de prompts, streaming, voz, imágenes, tools/function calling o agentes autónomos.
- Persistencia de conversaciones, prompts, respuestas, embeddings, RAG o base vectorial.
- Decisiones automáticas, reservas automáticas, modificación de disponibilidad o acciones administrativas mediante IA.
- Recomendaciones basadas en clima, distancia calculada, perfil deportivo, estadísticas, popularidad o datos externos no existentes.
- Casos de uso para gestionar canchas o resumir reservas de terceros.
- Exponer LM Studio a Internet, configurar LM Studio desde Ionic o soportar formalmente proveedores adicionales en esta entrega.
- Migraciones Prisma y cambios al modelo de datos.
