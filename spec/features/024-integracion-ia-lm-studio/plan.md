# 024 · Integración de IA con LM Studio — Plan

_Cómo se implementa lo descrito en `spec.md`. Debe respetar la `constitution/` de `canchago` y la de `canchago-ionic`._

## Enfoque

La integración se implementará como adaptador externo detrás de un contrato interno. Las API Routes autentican, autorizan y validan; `services/ai/` orquesta casos de uso; `database/ai/` contiene consultas de solo lectura y alcance estricto; `lib/ai/` encapsula el protocolo compatible con LM Studio. El modelo recibe únicamente un snapshot autorizado y limitado, y su salida se valida antes de abandonar el backend.

Ionic añadirá un módulo `features/ai/` integrado en “Agendamiento”. La página usa tipos espejo, Zod, una función endpoint en la instancia Axios existente y mutaciones TanStack Query sin reintento automático. No conoce proveedor, modelo ni prompt.

### Flujo principal

```text
Usuario → Asistente IA (Ionic) → apiClient + Bearer/cookie
       → POST /api/ai/slot-recommendations
       → auth → access(resources.read, availability.read) → Zod
       → services/ai → database/ai (candidatos reales autorizados)
       → AiProvider → adaptador LM Studio (timeout)
       → Zod de respuesta externa + filtro contra candidatos
       → { data } normalizado → TanStack Query → texto + opciones reales
       → selección explícita → flujo existente POST /api/bookings
```

El resumen propio repite el flujo con `bookings.read.own` y una consulta que fija `userId` desde `req.user.id`.

## Implementación

1. **Configuración backend — `lib/config/env.ts` y `.env.example`.** Añadir variables validadas para URL base, identificador del modelo y timeout. Definir límites operativos como constantes internas salvo que exista una necesidad real de configuración. Las variables requeridas para IA deben permitir que el resto del backend arranque cuando la capacidad esté deshabilitada/no configurada; el endpoint devuelve indisponibilidad controlada.
2. **Contrato de proveedor — `lib/ai/`.** Definir `AiProvider` y tipos independientes del proveedor; implementar el adaptador LM Studio con la API compatible confirmada contra la versión instalada durante implementación. Usar APIs HTTP disponibles en Node 22 antes de añadir dependencias. Aplicar `AbortController`, headers mínimos, respuesta no streaming y Zod para datos externos. Traducir conexión, timeout, modelo y payload inválido a errores de aplicación específicos.
3. **Acceso a datos — `database/ai/index.ts`.** Crear consultas de solo lectura que devuelvan proyecciones mínimas: candidatos activos/publicados/libres dentro del rango y reservas propias confirmadas futuras. Reutilizar los filtros/invariantes de `database/reservas/index.ts` sin importar servicios ni duplicar reglas transaccionales. Ordenar y limitar antes de construir contexto; no consultar datos de terceros.
4. **Validaciones — `validations/ai/index.ts`.** Definir schemas estrictos para ambos requests, respuestas internas y respuesta externa estructurada. Rechazar claves desconocidas, rangos pasados/invertidos/mayores a siete días, límites fuera de rango y valores no enumerados. Exportar tipos inferidos.
5. **Casos de uso — `services/ai/index.ts`.** Orquestar obtención de datos, retorno vacío determinista, construcción de instrucciones backend, serialización de contexto, invocación del proveedor, normalización de texto y validación de referencias. No importar tipos HTTP. Inyectar el proveedor o una factory reemplazable para pruebas y sustitución futura.
6. **Errores — `errors/` y `lib/api/router-config.ts` si fuera necesario.** Añadir errores tipados con códigos `AI_PROVIDER_UNAVAILABLE`, `AI_MODEL_UNAVAILABLE`, `AI_PROVIDER_TIMEOUT` y `AI_INVALID_RESPONSE`, conservando el envelope actual. Incorporar 502/503/504 al mapeo/documentación sin exponer URL, modelo ni cuerpo del proveedor.
7. **Rate limiting — `middleware/rate-limit.ts`.** Añadir un middleware específico por `req.user.id` y operación, ubicado después de `auth`. Mantener `rate-limiter-flexible`; documentar la limitación por proceso del backend actual y diseñar la clave para migración futura a Redis. No consumir cuota del proveedor ante validación/autorización fallida.
8. **API Routes — `pages/api/ai/slot-recommendations.ts` y `pages/api/ai/upcoming-bookings-summary.ts`.** Encadenar `auth`, rate limit, `access(...)`, validación y servicio según convenciones reales. Responder `{ data }`; nunca aceptar `userId` o prompt. No contener consultas Prisma ni lógica de negocio.
9. **OpenAPI en paralelo — `documentation/schemas/ai.ts` y `documentation/schemas/index.ts`.** Registrar schemas y rutas al crear los endpoints, con contratos, ejemplos, permisos conceptuales y todos los errores. Verificar también Bearer/cookie según los esquemas de seguridad existentes y no copiar envelopes Swagger conocidos como incorrectos.
10. **Tipos y validación Ionic — `canchago-ionic/src/types/api/ai.ts` y `src/validation/ai.ts`.** Reflejar exactamente el OpenAPI verificado y validar las preferencias antes de enviar. No incluir configuración ni tipos específicos de LM Studio.
11. **Capa HTTP Ionic — `src/services/api/endpoints/ai.ts`.** Añadir las dos funciones `POST` mediante `apiClient`; sin Axios disperso, reintentos automáticos ni acceso directo a LM Studio. Ampliar `errorMapper.ts` para los códigos 429/502/503/504 con mensajes UX seguros, preservando los tipos actuales.
12. **Hooks — `src/features/ai/hooks/useAiAssistant.ts`.** Implementar mutaciones TanStack Query con `retry: false`, estado derivado y cancelación al desmontar cuando el patrón existente lo permita. La bandera `isPending` será la fuente para impedir solicitudes concurrentes.
13. **Experiencia móvil — `src/features/ai/pages/AiAssistantPage.tsx` y componentes mínimos bajo `features/ai/components/`.** Crear una sola página “Asistente IA”, en español y orientada a móvil, con selector de modo, formulario estructurado y resultados. Reutilizar `AppButton`, `AppInput`/controles Ionic, `AppSelect`, `AppSkeleton`, `AppEmptyState`, `AppErrorState` y `AppInteractionAlert`; evitar tarjetas anidadas y HTML generado. Las opciones muestran hechos del backend y la explicación como asistencia. Una acción “Ver y reservar” navega/traslada la selección al flujo existente sin confirmar automáticamente.
14. **Navegación — `src/features/admin/navigation/admin-navigation.ts` y `src/layouts/AdminLayout.tsx`.** Agregar “Asistente IA” al grupo “Agendamiento” y ruta `/admin/ai-assistant`. La visibilidad exige los permisos del modo disponible; la ruta queda protegida por al menos `resources.read` + `availability.read`, mientras el modo resumen comprueba `bookings.read.own`. Ajustar la filtración solo si la navegación actual no admite capacidades alternativas, con pruebas explícitas.
15. **Documentación académica — ubicación a decidir dentro de la documentación real del repositorio durante implementación.** Describir preparación de LM Studio sin valores inventados, configuración backend, red, recorrido de solicitud, mocks, prueba manual y diagnóstico. No crear un tutorial con arquitectura paralela.
16. **Contrato móvil — `canchago-ionic/spec/constitution/api-integration.md`.** Tras implementar y verificar el contrato backend real, registrar endpoints, envelopes y errores consumidos. No actualizarlo anticipadamente con un contrato aún no ejecutable.
17. **Verificación y cierre.** Ejecutar gates completos en ambos repositorios, comparar fallos con la línea base, probar OpenAPI y realizar una prueba manual optativa con LM Studio. Solo entonces actualizar ambos roadmaps según su constitución.

## Estrategia de pruebas

### Automatizadas, sin LM Studio

- Backend: tests unitarios del adaptador con `fetch`/transporte simulado para éxito, conexión, timeout, HTTP de modelo ausente, saturación, cuerpo vacío, JSON inválido, longitud excesiva y referencias inventadas.
- Backend: tests de servicio con proveedor inyectado para verificar early return vacío, instrucciones fuera del control del cliente, minimización exacta del payload y normalización.
- Backend: tests de validación Zod para claves extra, fechas, horizonte, enum y precio.
- Backend: tests de autorización/ruta para 401, permisos incompletos, rate limit y garantía de que proveedor/DB no se invocan antes de superar guardas.
- Backend: tests de datos con Prisma simulado y, donde la infraestructura existente lo permita, integración PostgreSQL para recursos inactivos, sedes/organizaciones inactivas, slots no publicados/ocupados y aislamiento `userId`.
- Ionic: tests del endpoint y `errorMapper` con Axios/MSW o el mecanismo ya usado por el repositorio; no añadir otra herramienta.
- Ionic: tests del hook/página con Testing Library para `idle`, `loading`, `success`, `empty`, cada familia de error, reintento, bloqueo de doble envío, escape de texto y permisos de modos.
- Ionic: pruebas de navegación/capacidades para que el ítem solo aparezca cuando corresponda y para que una sugerencia no reserve por sí sola.
- Regresión: suites existentes de auth, roles, recursos, disponibilidad y reservas en ambos repositorios.

### Manuales, con LM Studio real

- Confirmar la API compatible y el identificador del modelo desde la instalación local, configurar únicamente el backend y verificar conectividad.
- Ejecutar ambos casos con datos semilla reales, observar logs sin contenido sensible y apagar LM Studio durante una solicitud para comprobar degradación.
- Probar navegador mediante proxy Vite y al menos un target móvil disponible; confirmar que ninguna petición de Ionic apunta a LM Studio.
- Intentar prompt injection mediante cualquier campo textual permitido y comprobar que no altera instrucciones, contexto, permisos ni acciones.

La suite automatizada nunca requiere descargar/cargar un modelo; el proveedor se sustituye por un fake determinista.

## Decisiones

- **Dos casos acotados, no chat libre.** Cubren utilidad real y docencia sin convertir el backend en proxy arbitrario.
- **Recomendación basada en candidatos del backend.** Se descarta pedir al modelo que “busque disponibilidad”; PostgreSQL y los servicios de reservas conservan la autoridad.
- **Permisos de dominio existentes.** Se combinan `resources.read`, `availability.read` y `bookings.read.own`; se evita ampliar RBAC sin una necesidad de negocio confirmada.
- **Interacciones efímeras.** No existe necesidad actual de historial/auditoría de conversación que justifique datos personales, migración o retención.
- **Proveedor inyectable detrás de `AiProvider`.** LM Studio es el primer adaptador, no una dependencia de UI ni de reglas de negocio.
- **Respuesta estructurada y referencias verificadas.** Se descarta mostrar texto crudo o confiar en IDs generados.
- **POST para ambas operaciones.** Son generaciones no cacheables con cuerpo validado; el cliente no las reintenta automáticamente aunque no muten dominio.
- **No se añade SDK de IA inicialmente.** Node 22 ya ofrece transporte HTTP y cancelación; cualquier dependencia futura requerirá justificar valor y revisar mantenimiento.

## Riesgos

- **Alucinación o prompt injection.** Contexto mínimo, input estructurado, instrucciones backend, output schema, allowlist de IDs y etiqueta de asistencia.
- **Datos obsoletos entre recomendación y reserva.** La UI no promete disponibilidad y `POST /api/bookings` vuelve a validar atómicamente.
- **Modelo local lento o indisponible.** Timeout, límites, rate limit, sin reintento de POST y degradación 502/503/504 aislada.
- **Fuga de datos en prompts/logs.** Proyecciones mínimas, pruebas del payload, ausencia de persistencia y logs solo técnicos.
- **Rate limit inconsistente con múltiples procesos.** Documentar el límite actual en memoria y migrar a Redis antes de escalado horizontal.
- **Diferencias entre APIs compatibles/modelos.** Confirmar el contrato real de LM Studio instalado, validar toda respuesta y aislarlo en el adaptador.
- **Configuración opcional que rompa el arranque.** Separar configuración core de configuración IA y fallar solo en los endpoints de IA.
- **Deuda OpenAPI/Zod preexistente.** Capturar línea base antes de implementar, no ampliar `@ts-nocheck` y resolver/registrar cualquier bloqueo sin atribuirlo a esta feature.
- **Navegación actual basada en todos los permisos.** Diseñar claramente disponibilidad por modo y cubrir combinaciones para no ocultar el resumen ni exponer recomendaciones sin permisos.
