# 024 · Integración de IA con LM Studio — Tareas

_Checklist accionable derivada del `plan.md`. Nada de esta lista se implementa como parte de la creación de la spec._

## Preparación y contrato

- [x] Aprobar `spec.md`, `plan.md` y este checklist antes de escribir código.
- [x] Capturar línea base de `lint`, `typecheck`, `test` y `build` en ambos repositorios y registrar fallos preexistentes reproducibles.
- [x] Verificar en la instalación local de LM Studio la ruta y el shape exactos de su API compatible, sin fijar puerto o modelo por suposición.
- [x] Cerrar límites definitivos de candidatos, caracteres, tokens, horizonte del resumen, timeout y cuota por usuario; documentarlos en contrato y pruebas.
- [x] Definir ejemplos exactos de request/response y errores para ambas operaciones, conservando `{ data }` y `{ error }`.

## Backend: configuración y proveedor

- [x] Extender `lib/config/env.ts` con configuración IA validada y opcional para el arranque general.
- [x] Documentar variables IA en `.env.example` sin secretos, URL/modelo reales ni exposición `VITE_*`.
- [x] Crear el contrato `AiProvider` y tipos neutrales bajo `lib/ai/`.
- [x] Implementar el adaptador LM Studio con transporte Node 22, `AbortController`, timeout y respuesta no streaming.
- [x] Validar con Zod toda respuesta externa y limitar tamaño antes de consumirla.
- [x] Mapear conexión, modelo ausente, timeout, saturación y respuesta inválida a errores de aplicación seguros.
- [x] Añadir tests del adaptador con transporte simulado; cubrir éxito y todas las fallas anteriores sin LM Studio real.

## Backend: datos, servicio y seguridad

- [x] Crear `database/ai/index.ts` con proyecciones mínimas para candidatos publicables/libres.
- [x] Crear consulta de reservas próximas filtrada obligatoriamente por `req.user.id`, estado confirmado y horizonte.
- [x] Probar exclusión de recursos/sedes/organizaciones inactivos, slots ocupados/no publicados y reservas ajenas.
- [x] Crear schemas estrictos y tipos inferidos en `validations/ai/index.ts`.
- [x] Probar claves desconocidas, rango pasado/invertido/>7 días, enum inválido, precio inválido y ausencia de `userId`/prompt.
- [x] Crear `services/ai/index.ts` con proveedor inyectable y sin tipos HTTP.
- [x] Construir instrucciones de sistema únicamente en backend y serializar input/contexto como datos delimitados.
- [x] Implementar salida vacía determinista sin invocar proveedor.
- [x] Normalizar texto, aplicar límite y validar cada referencia contra el conjunto candidato.
- [x] Probar minimización exacta del payload: sin tokens, sesión, email, perfil, roles, permisos, coordenadas ni datos de terceros.
- [x] Probar prompt injection y referencias inventadas/malformadas.
- [x] Confirmar que ningún camino escribe en Prisma o llama operaciones de reserva.
- [x] Confirmar que logs Pino contienen solo metadatos técnicos permitidos.

## Backend: HTTP, límites y errores

- [x] Crear errores IA tipados y ampliar el manejo HTTP para 502, 503 y 504 sin detalles internos.
- [x] Añadir rate limiter por usuario y operación en `middleware/rate-limit.ts` después de `auth`.
- [x] Probar cuota, claves por usuario y no invocación del proveedor ante 400/401/403/429.
- [x] Crear `POST /api/ai/slot-recommendations` con `auth`, rate limit, `access('resources.read', 'availability.read')`, Zod y servicio.
- [x] Crear `POST /api/ai/upcoming-bookings-summary` con `auth`, rate limit, `access('bookings.read.own')`, Zod y servicio.
- [x] Probar envelopes/códigos 200, 400, 401, 403, 429, 502, 503 y 504.
- [x] Añadir pruebas de aislamiento entre dos usuarios y comprobar que no se consulta/incluye información cruzada.
- [x] Verificar que fallos IA no cambian recursos, slots, reservas, usuarios, roles u organizaciones.

## Documentación Swagger (obligatorio)

_Debe completarse en paralelo con los endpoints, no como paso final._

- [x] Crear `documentation/schemas/ai.ts` con schemas Zod de entrada, salida y errores registrados vía `registry.register()`.
- [x] Registrar los dos endpoints con `registry.registerPath()` (método, path, tag, summary, security, requestBody y responses).
- [x] Importar el módulo desde `documentation/schemas/index.ts`.
- [x] Verificar que ambos endpoints aparecen en `GET /api/docs` con schemas, ejemplos y códigos correctos.
- [x] Añadir una prueba de generación OpenAPI que detecte omisiones o envelopes incorrectos.

## Ionic: contrato y consumo

- [x] Crear `src/types/api/ai.ts` como espejo exacto del contrato backend verificado.
- [x] Crear `src/validation/ai.ts` con mensajes en español y los mismos límites de entrada.
- [x] Crear `src/services/api/endpoints/ai.ts` usando exclusivamente `apiClient`.
- [x] Ampliar `errorMapper.ts` para `TOO_MANY_REQUESTS` y códigos IA 502/503/504.
- [x] Probar funciones endpoint, autenticación heredada, shapes y mapeo de errores con el mecanismo existente.
- [x] Crear `src/features/ai/hooks/useAiAssistant.ts` con mutaciones `retry: false` y cancelación/estado coherentes.
- [x] Probar que una doble pulsación durante `isPending` solo inicia una solicitud.

## Ionic: experiencia y navegación

- [x] Crear `AiAssistantPage.tsx` y solo los componentes de dominio necesarios.
- [x] Implementar modos “Recomendar horario” y “Resumir mis reservas” según permisos efectivos.
- [x] Reutilizar componentes Ionic y comunes existentes; no crear tarjetas anidadas.
- [x] Cubrir visualmente y con Testing Library los estados `idle`, `loading`, `success`, `empty` y `error`.
- [x] Mostrar errores recuperables con “Reintentar” y conservar preferencias seguras.
- [x] Renderizar la salida como texto escapado, identificada como generada por IA y no como fuente de verdad.
- [x] Mostrar datos objetivos de cada opción y validar navegación “Ver y reservar” sin crear una reserva automática.
- [x] Agregar “Asistente IA” al grupo “Agendamiento” y `/admin/ai-assistant` con guards reales.
- [x] Probar combinaciones de permisos para futbolista, gestor y usuario sin capacidades.
- [x] Confirmar que no existe URL, modelo, secreto ni llamada a LM Studio en el bundle móvil.
- [x] Probar layout móvil, responsive y accesibilidad básica de labels, estados y foco.

## Documentación académica y operación

- [x] Escribir la guía de preparación de LM Studio y selección/configuración explícita del modelo sin inventar valores.
- [x] Documentar el recorrido Ionic → backend → LM Studio → backend → Ionic y las responsabilidades de cada capa.
- [x] Documentar timeout, rate limit, errores, minimización, prompt injection y ausencia de persistencia.
- [x] Documentar que `localhost` del dispositivo/emulador no es la máquina del backend ni de LM Studio.
- [x] Documentar controles de bind address/firewall/red confiable si backend y LM Studio viven en equipos distintos.
- [x] Documentar cómo ejecutar tests con fake y la prueba manual optativa con proveedor real.
- [x] Tras verificar el backend real, actualizar `canchago-ionic/spec/constitution/api-integration.md`.

## Verificación

- [x] Ejecutar pruebas backend focalizadas sin LM Studio.
- [x] Ejecutar pruebas Ionic focalizadas sin LM Studio.
- [ ] Ejecutar opcionalmente ambos flujos con LM Studio real y datos autorizados (no había un modelo cargado durante la implementación).
- [ ] Descargar un modelo durante una solicitud para verificar manualmente la degradación (cubierta automáticamente con fakes).
- [x] Verificar que Ionic nunca intenta alcanzar LM Studio desde navegador, emulador o dispositivo.
- [x] Ejecutar en `canchago`: `yarn lint && yarn typecheck && yarn test && yarn build`.
- [x] Ejecutar en `canchago-ionic`: `yarn lint && yarn typecheck && yarn test && yarn build`.
- [x] Comparar cualquier fallo con la línea base y documentar solo deudas preexistentes reproducidas.
- [x] Validar uno a uno todos los criterios de aceptación de `spec.md`.

## Cierre

- [x] Confirmar que no se añadieron migraciones ni persistencia de interacciones IA.
- [x] Confirmar que autenticación, roles, recursos, disponibilidad y reservas no presentan regresiones.
- [x] Mover la feature a “Hecho” en `../../constitution/roadmap.md` solo cuando backend, Ionic, documentación y gates estén completos.
- [x] Actualizar el roadmap de `canchago-ionic` en el mismo cierre coordinado.

## Mantenimiento (checklist recurrente)

- [x] Ante un cambio de modelo/proveedor, repetir tests de contrato externo, límites, seguridad y respuesta inválida.
- [x] Revisar periódicamente latencia, timeouts y cuota sin registrar prompts o respuestas.
- [x] Antes de escalar a múltiples procesos, sustituir o reevaluar el rate limit en memoria por Redis.
- [x] Verificar que nuevos campos de dominio no se incorporen al contexto IA sin revisión de minimización y permisos.
