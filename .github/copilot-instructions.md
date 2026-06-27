# Copilot Instructions — Canchago

Canchago es un backend SaaS multi-tenant para gestión de espacios deportivos. Es **exclusivamente API REST** — sin frontend, sin páginas React, sin CSS, sin componentes UI.

## Stack obligatorio

- **Runtime:** Node.js ≥ 22
- **Framework:** Next.js 16.2.9 con **Pages Router únicamente** — nunca App Router
- **API routing:** `next-connect` dentro de `pages/api/`
- **ORM:** Prisma 7 + PostgreSQL
- **Validación:** Zod 4 — toda entrada externa se valida con Zod
- **Auth:** OAuth 2.0 Authorization Code Flow + PKCE + cookies cifradas con `@hapi/iron`
- **Cache:** Redis via `ioredis`
- **Colas:** BullMQ para tareas asíncronas
- **Rate limiting:** `rate-limiter-flexible`
- **Logging:** Pino (pino-pretty solo en desarrollo)
- **Tests:** Vitest
- **Gestor de paquetes:** Yarn — nunca npm ni pnpm

## Arquitectura en capas — nunca la violes

El flujo de una solicitud es unidireccional y estricto:

```
HTTP → pages/api/ → next-connect → Middlewares → Handler → services/ → database/ → Prisma → PostgreSQL
```

- `pages/api/` — solo encadena middlewares y llama al servicio. Nunca queries Prisma, nunca lógica de negocio.
- `services/<modulo>/` — toda la lógica de negocio. Nunca recibe `NextApiRequest` ni `NextApiResponse`.
- `database/<modulo>/` — solo queries Prisma encapsuladas. Nunca conoce HTTP ni permisos.
- `middleware/` — auth, autorización, parsing, rate limit, cache, respuesta estándar.
- `validations/<modulo>/` — solo schemas Zod.
- `workers/` — procesos BullMQ independientes del servidor HTTP.

## Convenciones de código

- TypeScript estricto: nunca `any`; usa `unknown` y valida antes de consumir.
- Funciones flecha siempre.
- `const` por defecto; `let` solo si hay reasignación; nunca `var`.
- `import type` para importaciones usadas únicamente como tipos.
- Retornos tempranos para reducir anidamiento.
- Declarar tipo de retorno en funciones públicas y servicios.
- Inferir tipos desde Zod; reutilizar tipos generados por Prisma.
- Nunca aserciones `as` innecesarias.
- Nombrado: `camelCase` (vars/fns) · `PascalCase` (tipos/clases/modelos Prisma) · `UPPER_SNAKE_CASE` (constantes globales) · `kebab-case.ts` (archivos) · `kebab-case/` (directorios).
- Indentación: 2 espacios. Punto y coma. Comillas simples.
- Sin comentarios que expliquen qué hace el código — solo el por qué no obvio.

## Estructura de API Routes

```
pages/api/<recurso>/index.ts              → GET (listar) + POST (crear)
pages/api/<recurso>/[resourceId].ts       → GET + PATCH + DELETE
pages/api/<recurso>/[resourceId]/<sub>/   → sub-recursos anidados de un nivel
pages/api/<recurso>/[...slug].ts          → catch-all solo cuando sea inevitable
```

Parámetros descriptivos: `[userId].ts`, `[roleId].ts` — nunca `[id].ts`.

Cadena de middlewares (solo los que el endpoint necesita):

```
[requestContext] → [rateLimit] → [auth] → [access] → [parser] → [cache] → [apiResponse] → [handler]
```

## Formato de respuestas de API

```ts
// Éxito individual → 200
{ "data": { "id": "uuid" } }

// Colección → 200
{ "data": [], "meta": { "page": 1, "pageSize": 20, "total": 100, "totalPages": 5 } }

// Creación → 201
{ "data": { "id": "uuid" } }

// Error
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [] } }
```

Nunca responder 200 cuando la operación falló. Nunca exponer trazas SQL, stack traces ni detalles internos al cliente.

## Modelo de datos — invariantes

- Campos monetarios: `Decimal`, nunca `Float`.
- Fechas: UTC siempre; transformar solo en los límites de entrada/salida.
- Estados cerrados: enums de Prisma.
- Restricciones únicas: `@unique` o `@@unique` en el schema, nunca solo en código.
- Índices explícitos para filtros frecuentes.
- Operaciones indivisibles: transacciones Prisma.
- `onDelete` explícito en todas las relaciones.
- Soft delete con campo `deletedAt`; excluir registros borrados en todas las queries normales.
- Paginación obligatoria en listados que puedan crecer.
- Una sola instancia de `PrismaClient` desde `database/client.ts`.

## Seguridad

- OAuth 2.0 Authorization Code Flow + PKCE. Nunca Implicit Flow ni Resource Owner Password.
- Validar `state`, `nonce`, firma, issuer, audience y expiración de tokens.
- Cookies con `HttpOnly`, `Secure`, `SameSite`, `Path` y expiración siempre.
- Autorización basada en permisos con formato `recurso.accion` (ej. `users.read`), no solo en roles.
- Nunca registrar access tokens, refresh tokens, cookies completas, passwords ni códigos OAuth.
- Nunca aceptar campos de ordenamiento o filtros dinámicos sin validarlos contra una lista blanca con Zod.

## Nunca hagas esto

- No usar App Router (`app/api/` o `src/app/api/`).
- No agregar frontend, componentes React, CSS ni librerías UI.
- No instanciar `PrismaClient` fuera de `database/client.ts`.
- No ejecutar queries Prisma desde API Routes ni servicios.
- No poner lógica de negocio en API Routes.
- No pasar `NextApiRequest` o `NextApiResponse` a servicios o `database/`.
- No acceder a `process.env` directamente — usar el módulo central de configuración.
- No versionar `.env`, `.env.local` ni `prisma/seed/vars.ts`.
- No modificar migraciones ya aplicadas en entornos compartidos.
- No usar `prisma db push` como sustituto de migraciones formales.
- No mezclar npm/pnpm con Yarn — solo `yarn.lock`.
- No silenciar errores de TypeScript o ESLint sin justificación técnica.
- No procesar síncronamente PDF, Excel o correos masivos — usar BullMQ.
- No crear endpoints sin validación de entrada con Zod.
- No crear endpoints protegidos sin autenticación y autorización.
- No crear listados sin paginación.
- No introducir dependencias circulares vía archivos `index.ts`.

## Documentación OpenAPI

Todo módulo nuevo debe registrar sus endpoints y schemas en `documentation/schemas/<modulo>.ts` usando `registry.registerPath()` y `registry.registerComponent()`, exportándolo desde `documentation/schemas/index.ts`.
