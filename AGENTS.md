<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

---

# Agent Constitution — Canchago

> **Leer esto antes de tocar cualquier archivo.** Este documento es la ley para agentes IA en este repositorio. Si algo aquí contradice tu conocimiento general de Next.js, Node o TypeScript — **este documento gana**.

---

## 1. Contexto del proyecto

Canchago es un **backend SaaS multi-tenant** para gestión y agendamiento de espacios deportivos. Exclusivamente API REST — **cero frontend, cero páginas visuales, cero React fuera de lo que Next.js exige internamente**.

Lee `spec/constitution/mission.md` para entender qué construimos y para quién.  
Lee `spec/constitution/tech-stack.md` para las reglas técnicas completas.  
Lee `spec/constitution/roadmap.md` para saber qué está hecho y qué sigue.

---

## 2. Spec-Driven Development (SDD) — la ley del proyecto

**Este proyecto trabaja siempre bajo SDD.** El desarrollador (y cualquier agente IA) opera bajo el principio: **primero la spec, luego el plan, luego el código**. Nunca al revés.

> "El Contrato es la Ley" — ningún endpoint se programa, ni ninguna validación se escribe, sin antes haber definido y aprobado el contrato en la spec. Esto aplica a ti también.

### Flujo obligatorio para cualquier tarea

```
PASO 1 — Entiende la constitución
  Lee spec/constitution/tech-stack.md   → ¿la tarea choca con alguna convención o límite duro?
  Lee spec/constitution/mission.md      → ¿encaja con lo que construimos?

PASO 2 — Lee la spec de la feature
  Lee spec/features/<NNN>/spec.md       → qué debe hacer, criterios de aceptación medibles
  Lee spec/features/<NNN>/plan.md       → enfoque técnico y decisiones ya tomadas
  Lee spec/features/<NNN>/tasks.md      → qué queda pendiente, qué ya está hecho

PASO 3 — Implementa respetando las capas (ver §4)

PASO 4 — Verifica antes de declarar terminado
  yarn lint && yarn typecheck && yarn test && yarn build

PASO 5 — Actualiza el roadmap (OBLIGATORIO al completar una feature)
  En spec/constitution/roadmap.md:
  · Mueve la feature de "Siguiente 🔜" a "Hecho ✅" con su descripción final.
  · Si hay features en el backlog que ahora sean "Siguiente", promueve la adecuada.
  · Nunca declares una feature terminada sin haber actualizado el roadmap.
```

### Si no existe spec para la tarea — créala primero

Si el usuario pide algo sin spec, **no empieces a codear**. Crea la carpeta y los tres archivos:

```
spec/features/<NNN>-<nombre>/
├── spec.md     ← qué hace, por qué, criterios de aceptación
├── plan.md     ← cómo se implementa técnicamente
└── tasks.md    ← checklist granular de tareas
```

Usa la plantilla de `spec/features/NNN-nombre-feature/`. Confirma con el usuario antes de implementar.

### La constitución manda

Si una feature choca con `mission.md` o `tech-stack.md`, se replantea la feature — nunca la constitución. Si detectas un conflicto, señálalo explícitamente antes de continuar.

---

## 3. Stack — lo que hay, lo que no hay

| Capa | Tecnología |
|---|---|
| Runtime | Node.js ≥ 22 |
| Framework | Next.js 16.2.9 — **Pages Router únicamente** |
| Router de API | `next-connect` |
| ORM | Prisma 7 + PostgreSQL |
| Validación | Zod 4 |
| Auth | OAuth 2.0 + OIDC + PKCE — cookies cifradas con `@hapi/iron` |
| Cache | Redis via `ioredis` |
| Colas | BullMQ |
| Rate limit | `rate-limiter-flexible` |
| Logging | Pino (pino-pretty solo en dev) |
| Tests | Vitest |
| Paquetes | Yarn (único gestor autorizado) |

**No existe App Router. No existe `src/app/`. No existe frontend.** No agregues dependencias sin necesidad comprobada.

---

## 4. Capas y responsabilidades

El flujo de una solicitud es estrictamente unidireccional:

```
HTTP → API Route (pages/api/) → next-connect → Middlewares → Handler → Servicio → database/ → Prisma → PostgreSQL
```

Cada capa tiene una sola responsabilidad:

| Capa | Hace | No hace |
|---|---|---|
| `pages/api/` | Encadena middlewares, valida método HTTP, llama servicio, devuelve respuesta | Lógica de negocio, queries Prisma, instancias externas |
| `middleware/` | Auth, acceso, parsing, rate limit, cache, contexto, respuesta estándar | Reglas de negocio |
| `services/<modulo>/` | Reglas de negocio, coordina DB/cache/colas/integraciones | Conocer HTTP, cookies, `NextApiRequest` |
| `database/<modulo>/` | Queries Prisma encapsuladas | Conocer HTTP, permisos, sesiones |
| `validations/<modulo>/` | Schemas Zod para entradas | Lógica |
| `workers/` | Procesos BullMQ independientes | Servir HTTP |

Viola estas fronteras y el PR se rechaza.

---

## 5. Convenciones de código — resumen ejecutivo

- **TypeScript estricto**: nunca `any`; usa `unknown` y valida antes de consumir.
- **Funciones flecha** por defecto.
- Nombrado: `camelCase` (vars/fns) · `PascalCase` (tipos/clases/modelos) · `UPPER_SNAKE_CASE` (constantes globales) · `kebab-case.ts` (archivos) · `kebab-case/` (directorios).
- `const` por defecto; `let` solo si hay reasignación; nunca `var`.
- `import type` para importaciones de solo tipo.
- Retornos tempranos para evitar anidamiento.
- Declarar tipos de retorno en funciones públicas y servicios.
- Inferir tipos desde Zod y reutilizar tipos generados por Prisma.
- Sin aserciones `as` innecesarias.
- Sin comentarios que expliquen *qué* hace el código — solo el *por qué* no obvio.
- 2 espacios de indentación, punto y coma, comillas simples.

---

## 6. Convención de API Routes

```
pages/api/<recurso>/index.ts              → GET (listar) + POST (crear)
pages/api/<recurso>/[resourceId].ts       → GET + PATCH + DELETE
pages/api/<recurso>/[resourceId]/<sub>/   → sub-recursos anidados de un nivel
pages/api/<recurso>/[...slug].ts          → catch-all solo cuando sea inevitable
```

Parámetros descriptivos: `[userId].ts`, `[roleId].ts` — nunca `[id].ts`.

Cadena de middlewares (usa solo los que el endpoint necesita):

```
[requestContext] → [rateLimit] → [auth] → [access] → [parser] → [cache] → [apiResponse] → [handler]
```

Los endpoints públicos no ejecutan auth/access.

---

## 7. Documentación OpenAPI — obligatorio en cada feature

Cada módulo nuevo debe registrar sus endpoints y schemas en `documentation/schemas/<módulo>.ts` usando `registry.registerPath()` y `registry.registerComponent()`, y exportarse desde `documentation/schemas/index.ts`. Verificar que `GET /api/docs` los muestre correctamente antes de marcar la feature como terminada.

---

## 8. Respuestas de API

```json
// Éxito individual
{ "data": { "id": "uuid" } }

// Colección
{ "data": [], "meta": { "page": 1, "pageSize": 20, "total": 100, "totalPages": 5 } }

// Error
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [] } }
```

Códigos HTTP relevantes: 200, 201, 204, 400, 401, 403, 404, 405, 409, 422, 429, 500. Nunca 200 para operaciones fallidas.

---

## 9. Modelo de datos — invariantes clave

- Campos monetarios: `Decimal`, nunca `Float`.
- Fechas: UTC siempre; transformar solo en los límites de entrada/salida.
- Estados cerrados: enums de Prisma.
- Restricciones únicas: `@unique` o `@@unique` en el schema.
- Índices: explícitos para filtros frecuentes.
- Operaciones indivisibles: transacciones Prisma.
- Eliminaciones: `onDelete` explícito siempre.
- Soft delete: campo `deletedAt`; todas las queries normales excluyen registros borrados.
- Listados: paginación obligatoria cuando el volumen puede crecer.
- `PrismaClient`: una sola instancia desde `database/client.ts`.

---

## 10. Seguridad — reglas no negociables

- OAuth 2.0 Authorization Code Flow + PKCE. Nunca Implicit Flow ni Resource Owner Password.
- Validar `state`, `nonce`, firma, issuer, audience y expiración de tokens.
- Cookies: `HttpOnly`, `Secure`, `SameSite`, `Path` y expiración definidos siempre.
- Autorización basada en permisos (`usuarios.read`), no solo en roles.
- No registrar access tokens, refresh tokens, cookies, passwords ni códigos OAuth.
- No exponer trazas SQL, errores de Prisma ni detalles internos al cliente.
- No aceptar campos de ordenamiento/filtros dinámicos sin lista blanca validada con Zod.
- No usar SQL crudo con concatenación de entradas externas.

---

## 11. Límites duros — lo que nunca se hace

- No usar App Router (`app/api/` o `src/app/api/`).
- No implementar frontend, componentes React, CSS ni librerías UI.
- No instanciar `PrismaClient` fuera de `database/client.ts`.
- No ejecutar queries Prisma desde API Routes ni servicios HTTP.
- No poner lógica de negocio en API Routes.
- No recibir `NextApiRequest` o `NextApiResponse` en servicios o `database/`.
- No acceder a `process.env` fuera del módulo central de configuración.
- No versionar `.env`, `.env.local`, ni `prisma/seed/vars.ts`.
- No modificar migraciones ya aplicadas en entornos compartidos.
- No correr `prisma migrate dev` en producción; nunca `prisma db push` como sustituto.
- No mezclar npm/pnpm/Yarn: solo `yarn.lock`.
- No silenciar errores de TypeScript o ESLint sin justificación técnica documentada.
- No procesar síncronamente tareas pesadas (PDF, Excel, correos masivos) — delegar a BullMQ.
- No crear endpoints sin validación de entrada con Zod.
- No crear endpoints protegidos sin autenticación y autorización.
- No crear listados sin paginación.
- No introducir dependencias circulares vía `index.ts`.

---

## 12. Comandos clave

```bash
# Setup inicial
yarn install && yarn generate && yarn migrate-dev && yarn seed && yarn dev

# Antes de integrar cualquier cambio
yarn lint && yarn typecheck && yarn test && yarn build

# Otros
yarn migrate-dev       # nueva migración en desarrollo
yarn seed-dev          # datos de prueba
yarn prisma-studio     # explorar DB
yarn worker:email      # worker de correos
```

---

## 13. Tests

- Tests unitarios junto al archivo: `services/users/user.service.test.ts`
- Tests de integración en `tests/integration/`
- Cubrir: reglas de negocio, validaciones, auth, autorización, permisos, errores esperados, paginación, filtros, transacciones, invalidación de caché, jobs, endpoints críticos.
