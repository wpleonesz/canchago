# Tech stack y convenciones

_Cómo está construido el proyecto y las reglas que todo el código debe respetar. Es la referencia técnica que ningún plan de feature debería contradecir._

## Tecnologías

- **Lenguaje:** TypeScript en modo estricto, evitando el uso de `any`.

- **Framework / runtime:** Node.js 22 o superior con Next.js y Pages Router.

- **API routing:** API Routes de Next.js dentro de `pages/api/`, estructuradas mediante `next-connect`.

- **Arquitectura:** monolito modular con separación entre API Routes, middlewares, servicios, acceso a datos e integraciones.

- **Base de datos:** PostgreSQL con Prisma ORM, utilizando el esquema PostgreSQL `public`.

- **Validación:** Zod para cuerpos, parámetros, consultas, cookies, variables de entorno y datos externos.

- **Autenticación:** OAuth 2.0 con Authorization Code Flow y OpenID Connect cuando el proveedor lo soporte.

- **Sesiones:** cookies cifradas y firmadas mediante `@hapi/iron`.

- **Autorización:** control basado en roles y permisos internos.

- **Tokens:** JWT para integraciones entre sistemas; se prefieren algoritmos asimétricos como `RS256` o `ES256`.

- **Caché:** Redis mediante `ioredis`.

- **Colas y tareas asíncronas:** BullMQ.

- **Rate limiting:** Redis con `rate-limiter-flexible` o una implementación equivalente.

- **Logging:** Pino; `pino-pretty` únicamente en desarrollo.

- **Correo electrónico:** Nodemailer con plantillas Handlebars.

- **PDF:** pdfmake.

- **Excel:** ExcelJS y `xlsx-js-style`.

- **Documentación API:** OpenAPI 3 con Swagger UI.

- **Tests:** Vitest para pruebas unitarias y de integración.

- **Calidad de código:** ESLint, Prettier y comprobación estática con TypeScript.

- **Gestor de paquetes:** Yarn.

- **Despliegue:** compilación con `next build` y ejecución con `next start`, preferentemente mediante Docker o PM2.

- **Procesos auxiliares:** workers BullMQ ejecutados como procesos independientes del servidor HTTP.

El proyecto está destinado exclusivamente al backend. Aunque Next.js requiere `react` y `react-dom`, no se desarrollarán páginas visuales, componentes React ni funcionalidades de frontend.

## Archivos / módulos clave

_Mapa breve de dónde vive cada cosa. Solo lo que un recién llegado necesita para orientarse._

- `pages/api/` — contiene todos los endpoints REST implementados con API Routes de Next.js y `next-connect`.

- `pages/api/auth/` — contiene inicio de sesión OAuth 2.0, callback, consulta de sesión, renovación y cierre de sesión.

- `pages/api/<modulo>/index.ts` — contiene operaciones sobre una colección, normalmente `GET` y `POST`.

- `pages/api/<modulo>/[resourceId].ts` — contiene operaciones sobre un recurso individual, normalmente `GET`, `PATCH` y `DELETE`.

- `pages/api/<modulo>/[resourceId]/[subResourceId].ts` — contiene operaciones sobre un sub-recurso anidado de un nivel.

- `pages/api/<modulo>/[...slug].ts` — catch-all para rutas dinámicas de profundidad variable; se usa únicamente cuando la estructura del path no puede resolverse con archivos nombrados.

- `middleware/` — contiene la cadena de middlewares para autenticación, autorización, validación, rate limiting, caché, contexto de solicitud y respuestas estandarizadas.

- `middleware/auth.ts` — valida y descifra la cookie de sesión y adjunta el usuario autenticado a la solicitud.

- `middleware/access.ts` — comprueba los permisos requeridos por el endpoint.

- `middleware/api.ts` — incorpora helpers estandarizados como `success`, `successMany`, `created`, `noContent` y `error`.

- `middleware/parser.ts` — valida y normaliza cuerpos, consultas y parámetros mediante Zod.

- `middleware/cache.ts` — administra lectura, escritura e invalidación de caché en Redis.

- `middleware/rate-limit.ts` — limita solicitudes por IP, usuario o endpoint.

- `middleware/request-context.ts` — genera el identificador de solicitud y el contexto para logs y auditoría.

- `database/client.ts` — crea y reutiliza la única instancia central de Prisma.

- `database/<modulo>/index.ts` — encapsula todas las consultas Prisma de un dominio.

- `services/<modulo>/` — contiene las reglas del negocio y coordina repositorios, caché, colas e integraciones.

- `validations/<modulo>/` — contiene esquemas Zod para entradas, filtros, paginación y parámetros.

- `lib/oauth/` — integra el proveedor OAuth 2.0 u OpenID Connect.

- `lib/session/` — cifra, firma, descifra y valida cookies de sesión.

- `lib/tokens/` — firma y valida JWT utilizados en integraciones.

- `lib/cache/` — contiene el cliente y los helpers de Redis.

- `lib/queue/` — configura BullMQ, las conexiones Redis y las colas del sistema.

- `lib/email/` — configura Nodemailer y las plantillas Handlebars.

- `lib/logger/` — configura Pino y el formato de logs.

- `lib/pdf/` — contiene generadores y plantillas PDF.

- `lib/excel/` — contiene generadores, estilos y plantillas Excel.

- `lib/security/` — contiene configuración de CORS, CSRF, cabeceras y sanitización contextual.

- `workers/` — contiene los procesos BullMQ para correos, notificaciones, reportes y tareas de mantenimiento.

- `helper/` — contiene funciones puras y reutilizables para filtros, paginación, fechas y transformación de datos.

- `errors/` — contiene las clases de errores controlados de la aplicación.

- `types/` — contiene tipos compartidos y extensiones de `NextApiRequest` y `NextApiResponse`.

- `documentation/` — contiene la definición OpenAPI, esquemas, respuestas y rutas documentadas.

- `prisma/schema.prisma` — contiene los modelos, relaciones, índices, restricciones y enums.

- `prisma/migrations/` — contiene el historial de migraciones SQL.

- `prisma/seed.ts` — carga los datos iniciales obligatorios.

- `prisma/seed-dev.ts` — carga datos exclusivos para desarrollo.

- `prisma/seed/vars.example.ts` — documenta las variables necesarias para el seed de desarrollo.

- `prisma/seed/vars.ts` — contiene datos sensibles locales y nunca debe versionarse.

- `.env.example` — documenta todas las variables de entorno sin incluir valores sensibles.

- `tests/` — contiene pruebas de integración, fixtures y configuración compartida.

Estructura general:

```text
project/
├── pages/
│   └── api/
│       ├── academic/
│       ├── attendance/
│       ├── auth/
│       ├── base/
│       ├── health/
│       ├── hr/
│       ├── notifications/
│       ├── payments/
│       ├── reports/
│       ├── roles/
│       ├── users/
│       └── webhooks/
├── database/
├── services/
├── middleware/
├── validations/
├── lib/
├── workers/
├── helper/
├── errors/
├── types/
├── documentation/
├── prisma/
└── tests/
```

El flujo de una solicitud debe respetar esta dirección:

```text
Cliente HTTP
    ↓
Next.js API Route
    ↓
next-connect
    ↓
Middlewares
    ↓
Handler
    ↓
Servicio
    ↓
Capa database
    ↓
Prisma ORM
    ↓
PostgreSQL
```

Cadena general de middlewares:

```text
[requestContext]
    → [rateLimit]
    → [auth]
    → [access]
    → [parser]
    → [cache]
    → [apiResponse]
    → [handler]
```

Cada endpoint debe utilizar únicamente los middlewares que necesita. Los endpoints públicos no deben ejecutar autenticación o autorización innecesariamente.

## Comandos

- `yarn install` — instala las dependencias.

- `yarn dev` — arranca el entorno local de desarrollo.

- `yarn build` — compila el proyecto para producción.

- `yarn start` — levanta el servidor compilado.

- `yarn lint` — ejecuta la revisión estática con ESLint.

- `yarn lint:fix` — corrige automáticamente los problemas compatibles con ESLint.

- `yarn format` — aplica el formato de Prettier.

- `yarn format:check` — verifica el formato sin modificar archivos.

- `yarn typecheck` — comprueba los tipos con `tsc --noEmit`.

- `yarn test` — ejecuta todas las pruebas con Vitest.

- `yarn test:watch` — ejecuta Vitest en modo observación.

- `yarn generate` — genera el cliente Prisma.

- `yarn migrate-dev` — crea y aplica migraciones en desarrollo.

- `yarn migrate-deploy` — aplica migraciones existentes en producción.

- `yarn seed` — carga los datos obligatorios del sistema.

- `yarn seed-dev` — carga datos exclusivos del entorno de desarrollo.

- `yarn prisma-studio` — abre Prisma Studio.

- `yarn worker:email` — inicia el worker de correos.

- `yarn worker:notification` — inicia el worker de notificaciones.

- `yarn worker:report` — inicia el worker de generación de reportes.

Secuencia inicial de desarrollo:

```bash
yarn install
yarn generate
yarn migrate-dev
yarn seed
yarn dev
```

Antes de integrar cambios:

```bash
yarn lint
yarn typecheck
yarn test
yarn build
```

Scripts recomendados:

```json
{
	"scripts": {
		"dev": "next dev",
		"build": "next build",
		"start": "next start",
		"lint": "eslint .",
		"lint:fix": "eslint . --fix",
		"format": "prettier . --write",
		"format:check": "prettier . --check",
		"typecheck": "tsc --noEmit",
		"test": "vitest run",
		"test:watch": "vitest",
		"generate": "prisma generate",
		"migrate-dev": "prisma migrate dev",
		"migrate-deploy": "prisma migrate deploy",
		"seed": "prisma db seed",
		"seed-dev": "tsx prisma/seed-dev.ts",
		"prisma-studio": "prisma studio",
		"worker:email": "tsx workers/email.worker.ts",
		"worker:notification": "tsx workers/notification.worker.ts",
		"worker:report": "tsx workers/report.worker.ts"
	},
	"engines": {
		"node": ">=22"
	}
}
```

## Modelo de datos / dominio

_Las entidades o estructuras centrales y sus campos/reglas. Documenta solo lo no obvio: invariantes, mecánicas especiales y qué campo controla qué._

- `User.oauthSubject` — identificador único del usuario en el proveedor OAuth 2.0 u OpenID Connect. No debe depender del correo electrónico.

- `User.email` — correo normalizado y único cuando el dominio lo requiera; no sustituye al identificador del proveedor.

- `User.active` — controla si el usuario puede utilizar el sistema, aunque su cuenta externa continúe vigente.

- `Role.code` — identificador técnico único e inmutable del rol.

- `Permission.code` — permiso técnico con formato `<recurso>.<acción>`, por ejemplo `users.read`.

- `UserRole` — relación muchos a muchos entre usuarios y roles; su clave primaria debe ser compuesta.

- `RolePermission` — relación muchos a muchos entre roles y permisos; su clave primaria debe ser compuesta.

- `Session` o cookie de sesión — contiene únicamente los datos indispensables para identificar y autorizar al usuario; debe estar cifrada, firmada y tener expiración.

- `AuditLog` — registra actor, acción, módulo, recurso, identificador, fecha, IP, request ID y resultado.

- `QueueJob` — los trabajos asíncronos deben utilizar identificadores estables cuando se necesite prevenir duplicados.

- `createdAt` — fecha de creación generada por la base de datos o Prisma.

- `updatedAt` — fecha de última modificación gestionada mediante `@updatedAt`.

- Campos monetarios — deben utilizar `Decimal`; nunca `Float`.

- Fechas — se almacenan en UTC y se transforman únicamente en los límites de entrada o salida.

- Estados cerrados — deben representarse mediante enums.

- Restricciones únicas — deben implementarse en la base de datos con `@unique` o `@@unique`.

- Filtros frecuentes — deben contar con índices explícitos.

- Operaciones indivisibles — deben ejecutarse dentro de una transacción Prisma.

- Eliminaciones — deben definir expresamente `onDelete`; no se debe depender de comportamientos implícitos.

- Listados — deben implementar paginación cuando el volumen pueda crecer.

- Eliminación lógica — cuando se utilice, debe estar controlada por un campo como `deletedAt`; todas las consultas normales deben excluir registros eliminados.

El esquema PostgreSQL principal será:

```text
public
```

La conexión debe declararlo en `DATABASE_URL` o mediante la configuración multiesquema de Prisma, según la versión utilizada:

```env
DATABASE_URL=postgresql://user:password@host:5432/database?schema=public
```

## Convenciones

_Reglas de estilo y patrones que debe seguir todo el proyecto._

- Utilizar TypeScript en modo estricto.

- Utilizar funciones flecha siempre que sea posible.

- Utilizar `camelCase` para variables y funciones.

- Utilizar `PascalCase` para tipos, interfaces, clases y modelos Prisma.

- Utilizar `UPPER_SNAKE_CASE` para constantes globales.

- Utilizar `kebab-case.ts` para archivos.

- Utilizar `kebab-case` para directorios.

- Utilizar rutas HTTP en plural y minúsculas.

- Utilizar parámetros dinámicos descriptivos como `[userId].ts`, evitando `[id].ts` cuando pueda existir ambigüedad.

- Utilizar permisos con formato `<recurso>.<acción>`.

- Utilizar una indentación de 2 espacios.

- Utilizar punto y coma al final de cada instrucción.

- Utilizar comillas simples en TypeScript.

- Utilizar trailing commas cuando corresponda.

- Utilizar `const` por defecto.

- Utilizar `let` únicamente cuando exista reasignación.

- No utilizar `var`.

- No utilizar `any`; utilizar `unknown` y validar antes de consumir el valor.

- Utilizar `import type` para importaciones utilizadas únicamente como tipos.

- Declarar tipos de retorno en funciones públicas y servicios.

- Inferir tipos desde Zod cuando sea posible.

- Reutilizar los tipos generados por Prisma.

- Evitar aserciones `as` innecesarias.

- Aplicar retornos tempranos para reducir anidamientos.

- Mantener cada archivo enfocado en una sola responsabilidad.

- Utilizar alias de importación y evitar rutas relativas profundas.

- Utilizar archivos `index.ts` únicamente como puntos públicos de exportación o para agrupar funciones simples.

- No colocar lógica compleja ni efectos secundarios en archivos `index.ts`.

### Convención de API Routes

Las APIs deben agruparse por recurso. Existen tres patrones de archivo según la profundidad y dinamismo de la ruta:

#### `index.ts` — colección

Operaciones sobre el conjunto de recursos: listar y crear.

```text
pages/api/<recurso>/index.ts
```

```text
GET    /api/users          → listar usuarios
POST   /api/users          → crear usuario
```

#### `[resourceId].ts` — recurso individual

Operaciones sobre un recurso identificado: leer, actualizar y eliminar.

```text
pages/api/<recurso>/[resourceId].ts
```

```text
GET    /api/users/:userId  → obtener usuario
PATCH  /api/users/:userId  → actualizar usuario
DELETE /api/users/:userId  → eliminar usuario
```

El parámetro dinámico debe tener un nombre descriptivo que evite ambigüedad: `[userId].ts`, `[roleId].ts`, `[venueId].ts`. No usar `[id].ts`.

#### Sub-recurso anidado de un nivel

Cuando un recurso tiene una sub-colección o sub-recurso fijo, se usa un directorio intermedio con el parámetro del padre:

```text
pages/api/<recurso>/[resourceId]/<subrecurso>/index.ts
pages/api/<recurso>/[resourceId]/<subrecurso>/[subResourceId].ts
```

Ejemplo: roles de un usuario.

```text
pages/api/users/[userId]/roles/index.ts
pages/api/users/[userId]/roles/[roleId].ts
```

```text
GET    /api/users/:userId/roles           → listar roles del usuario
POST   /api/users/:userId/roles           → asignar rol al usuario
DELETE /api/users/:userId/roles/:roleId   → revocar rol del usuario
```

#### `[...slug].ts` — catch-all

Se usa únicamente cuando la profundidad del path es variable y no puede resolverse con archivos nombrados. El array `slug` debe validarse exhaustivamente con Zod antes de procesarse.

```text
pages/api/<recurso>/[...slug].ts
```

Ejemplo: webhooks con paths arbitrarios definidos por el proveedor externo.

```text
pages/api/webhooks/[...slug].ts
→ /api/webhooks/stripe/payment
→ /api/webhooks/stripe/refund
→ /api/webhooks/twilio/sms
```

```ts
import { z } from 'zod';

const slugSchema = z.tuple([z.enum(['stripe', 'twilio']), z.string().min(1)]);

// request.query.slug → ['stripe', 'payment']
const [provider, event] = slugSchema.parse(request.query.slug);
```

Estructura de ejemplo completa:

```text
pages/api/
├── users/
│   ├── index.ts                         GET /api/users, POST /api/users
│   ├── [userId].ts                      GET /api/users/:userId, PATCH, DELETE
│   └── [userId]/
│       └── roles/
│           ├── index.ts                 GET /api/users/:userId/roles, POST
│           └── [roleId].ts              DELETE /api/users/:userId/roles/:roleId
└── webhooks/
    └── [...slug].ts                     /api/webhooks/**
```

Las API Routes deben:

- Configurar la cadena de `next-connect` con los middlewares necesarios.
- Aplicar `auth` → `api` → `access('<scope>')` → `database(<ResourceData>)`.
- Aplicar `parser.escape(ESCAPE)` antes de cualquier operación de escritura con payload.
- Responder con `api.success`, `api.successOne` o `api.successMany` dentro del callback de `request.do`.
- Usar soft-delete mediante `{ active: false }` en lugar de eliminar el registro.
- Delegar el manejo de errores al handler global de `next-connect`.

Las API Routes no deben:

- Ejecutar consultas Prisma directamente.
- Contener reglas del negocio.
- Instanciar clientes externos.
- Implementar lógica extensa.
- Exponer detalles internos.
- Retornar información sensible.

### Plantillas de API Routes

El tipo `request.do` debe estar declarado en `types/` mediante extensión de `NextApiRequest`. La capa `database(<ResourceData>)` inyecta el cliente de base de datos en la solicitud. `ESCAPE` lista los campos que no deben pasar por sanitización y se exporta desde la capa `@/database/<modulo>`.

#### `pages/api/<recurso>/index.ts`

```ts
import { createRouter } from 'next-connect';
import type { NextApiRequest, NextApiResponse } from 'next';

import { auth } from '@/middleware/auth';
import { api } from '@/middleware/api';
import { access } from '@/middleware/access';
import { database } from '@/middleware/database';
import { parser } from '@/middleware/parser';
import ResourceData, { ESCAPE } from '@/database/<modulo>/resource';

const handler = createRouter<NextApiRequest, NextApiResponse>();

handler
	.use(auth)
	.use(api)
	.use(access('resource'))
	.use(database(ResourceData))
	.get((request) => {
		request.do('read', async (api, prisma) => {
			const query = prisma.resource
				.where({ ...api.where, ...api.filter })
				.orderBy(api.orderBy)
				.take(api.take)
				.skip(api.skip)
				.cursor(api.cursor);

			query.setCount(api.count);

			return api.successMany(await query.getAll());
		});
	})
	.use(parser.escape(ESCAPE))
	.post((request) => {
		request.do('create', async (api, prisma) => {
			return api.success(await prisma.resource.create(request.body));
		});
	});

export default handler.handler({
	onError: (error, _req, response) => {
		response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Error interno.' } });
	},
	onNoMatch: (_req, response) => {
		response.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Método no permitido.' } });
	},
});
```

#### `pages/api/<recurso>/[resourceId].ts`

Usar un nombre descriptivo para el parámetro: `[userId].ts`, `[roleId].ts`, `[venueId].ts`. No usar `[id].ts`.

```ts
import { createRouter } from 'next-connect';
import type { NextApiRequest, NextApiResponse } from 'next';

import { auth } from '@/middleware/auth';
import { api } from '@/middleware/api';
import { access } from '@/middleware/access';
import { database } from '@/middleware/database';
import { parser } from '@/middleware/parser';
import ResourceData, { ESCAPE } from '@/database/<modulo>/resource';

const handler = createRouter<NextApiRequest, NextApiResponse>();

handler
	.use(auth)
	.use(api)
	.use(access('resource'))
	.use(database(ResourceData))
	.get((request) => {
		request.do('read', async (api, prisma) => {
			return api.successOne(
				await prisma.resource.record(request.query.resourceId).getUnique(),
			);
		});
	})
	.delete((request) => {
		request.do('remove', async (api, prisma) => {
			return api.success(
				await prisma.resource.record(request.query.resourceId).update({ active: false }),
			);
		});
	})
	.use(parser.escape(ESCAPE))
	.put((request) => {
		request.do('write', async (api, prisma) => {
			return api.success(
				await prisma.resource.record(request.query.resourceId).update(request.body),
			);
		});
	});

export default handler.handler({
	onError: (_err, _req, response) => {
		response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Error interno.' } });
	},
	onNoMatch: (_req, response) => {
		response.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Método no permitido.' } });
	},
});
```

#### `pages/api/<recurso>/[...slug].ts`

Usar únicamente para subrecursos o acciones especiales cuya profundidad de path es variable. Ejemplos:

- `GET /api/role/1/access`
- `GET /api/attendance/123/states`
- `POST /api/resource/10/action`

No usar `[...slug].ts` para reemplazar rutas CRUD que ya pertenecen a `index.ts` o `[resourceId].ts`.

```ts
import { createRouter } from 'next-connect';
import type { NextApiRequest, NextApiResponse } from 'next';

import { auth } from '@/middleware/auth';
import { api } from '@/middleware/api';
import { access } from '@/middleware/access';
import { database } from '@/middleware/database';
import { parser } from '@/middleware/parser';
import ResourceData, { ESCAPE } from '@/database/<modulo>/resource';

const getSlugParams = (request: NextApiRequest) => {
	const [id, action] = (request.query.slug as string[]) ?? [];

	return { id, action };
};

const handler = createRouter<NextApiRequest, NextApiResponse>();

handler
	.use(auth)
	.use(api)
	.use(access('resource'))
	.use(database(ResourceData))
	.get((request) => {
		request.do('read', async (api, prisma) => {
			const { id, action } = getSlugParams(request);

			if (!id || !action) return api.successMany([]);

			if (action === 'children') {
				return api.successMany(
					await prisma.resource.where({ parentId: id }).getAll(),
				);
			}

			return api.successMany([]);
		});
	})
	.use(parser.escape(ESCAPE))
	.post((request) => {
		request.do('create', async (api, prisma) => {
			const { id, action } = getSlugParams(request);

			if (!id || action !== 'action') return api.unauthorized();

			return api.success(
				await prisma.resource.record(id).update(request.body),
			);
		});
	});

export default handler.handler({
	onError: (_err, _req, response) => {
		response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Error interno.' } });
	},
	onNoMatch: (_req, response) => {
		response.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Método no permitido.' } });
	},
});
```

### Checklist de API Route

- Confirmar que existe la capa `@/database/<modulo>/resource`.
- Confirmar que la capa exporta `ESCAPE`.
- Confirmar el scope correcto para `access('<scope>')`.
- Validar payload antes de escribir datos.
- Usar soft-delete con `{ active: false }`.
- Probar listado, creación, lectura individual, edición, eliminación y permisos.

### Convención de acceso a datos

Las consultas Prisma deben vivir en:

```text
database/<modulo>/index.ts
```

Patrón recomendado:

```ts
const getAll = async () => {
	// Consulta de colección.
};

const create = async (data: CreateData) => {
	// Creación.
};

const record = (resourceId: string) => {
	const getUnique = async () => {
		// Consulta individual.
	};

	const update = async (data: UpdateData) => {
		// Actualización.
	};

	const remove = async () => {
		// Eliminación.
	};

	return {
		getUnique,
		update,
		remove,
	};
};

export const resourceData = {
	getAll,
	create,
	record,
};
```

La capa `database/` debe encapsular Prisma y no debe conocer HTTP, cookies ni permisos.

### Convención de servicios

Los servicios deben:

- Implementar reglas del negocio.

- Coordinar consultas y transacciones.

- Gestionar caché e invalidación.

- Enviar tareas a BullMQ.

- Coordinar integraciones externas.

- Lanzar errores controlados.

- Retornar datos del dominio, no respuestas HTTP.

Los servicios no deben recibir `NextApiRequest` ni `NextApiResponse`.

### Validación de entradas

Toda entrada externa debe validarse mediante Zod:

- `request.body`

- `request.query`

- Parámetros dinámicos.

- Cookies.

- Encabezados relevantes.

- Variables de entorno.

- Respuestas de integraciones externas cuando sea necesario.

Prisma parametriza las consultas. No se debe aplicar escape SQL manual a los datos enviados al ORM.

La sanitización debe ser contextual y no destructiva.

### Autenticación y autorización

- Utilizar OAuth 2.0 Authorization Code Flow.

- Utilizar OpenID Connect cuando el proveedor lo soporte.

- Utilizar PKCE cuando corresponda.

- Validar `state`.

- Validar `nonce` cuando se utilice OpenID Connect.

- Validar firma, issuer, audience y expiración de tokens.

- Crear una sesión interna mediante cookie cifrada con `@hapi/iron`.

- Configurar cookies con `HttpOnly`, `Secure`, `SameSite`, `Path` y expiración.

- Separar autenticación de autorización.

- Basar la autorización en permisos, no únicamente en roles.

- No volver a descifrar la sesión dentro de cada servicio; el middleware debe adjuntar el contexto a la solicitud.

### Respuestas de API

Respuesta individual:

```json
{
	"data": {
		"id": "uuid",
		"name": "Usuario"
	}
}
```

Respuesta de colección:

```json
{
	"data": [],
	"meta": {
		"page": 1,
		"pageSize": 20,
		"total": 100,
		"totalPages": 5
	}
}
```

Respuesta de error:

```json
{
	"error": {
		"code": "VALIDATION_ERROR",
		"message": "Los datos enviados no son válidos.",
		"details": []
	}
}
```

Códigos HTTP:

- `200` — consulta o actualización exitosa.

- `201` — recurso creado.

- `204` — operación exitosa sin contenido.

- `400` — solicitud inválida.

- `401` — usuario no autenticado.

- `403` — usuario sin permisos.

- `404` — recurso no encontrado.

- `405` — método HTTP no permitido.

- `409` — conflicto de estado o unicidad.

- `422` — incumplimiento de una regla del negocio.

- `429` — límite de solicitudes excedido.

- `500` — error interno no controlado.

No se debe responder con `200` cuando la operación haya fallado.

### Manejo de errores

Los errores esperados deben extender una clase base común, por ejemplo:

```ts
export class AppError extends Error {
	public readonly statusCode: number;
	public readonly code: string;
	public readonly details?: unknown;

	public constructor(message: string, statusCode: number, code: string, details?: unknown) {
		super(message);

		this.name = new.target.name;
		this.statusCode = statusCode;
		this.code = code;
		this.details = details;
	}
}
```

Errores recomendados:

```text
AuthenticationError
AuthorizationError
BusinessRuleError
ConflictError
MethodNotAllowedError
NotFoundError
ValidationError
```

Los errores inesperados deben registrarse mediante Pino y responder al cliente con un mensaje genérico.

### Caché y colas

- Utilizar Redis únicamente cuando exista una estrategia clara de expiración e invalidación.

- Construir claves con prefijos por aplicación, módulo, recurso y contexto.

- Invalidar el caché después de escrituras relacionadas.

- No almacenar respuestas dependientes de permisos sin incluir el contexto de autorización.

- Utilizar BullMQ para correos, notificaciones, reportes, exportaciones y tareas pesadas.

- Configurar reintentos, backoff y límites de retención.

- Utilizar identificadores únicos de trabajo cuando sea necesario prevenir duplicados.

- Ejecutar workers como procesos independientes.

### Logging y auditoría

- Utilizar logs estructurados en JSON.

- Utilizar `pino-pretty` únicamente en desarrollo.

- Incluir `requestId` en los logs asociados a una solicitud.

- Registrar errores con contexto suficiente.

- Auditar operaciones críticas como cambios de roles, permisos, usuarios, configuración y pagos.

- No registrar secretos, tokens, cookies completas, códigos OAuth ni contraseñas.

### Tests

Los tests pueden ubicarse junto al archivo probado:

```text
services/users/user.service.ts
services/users/user.service.test.ts
```

Las pruebas de integración deben ubicarse en:

```text
tests/integration/
```

Se deben probar:

- Reglas del negocio.

- Validaciones.

- Autenticación.

- Autorización.

- Permisos.

- Errores esperados.

- Paginación.

- Filtros.

- Transacciones.

- Invalidación de caché.

- Envío de trabajos a colas.

- Sincronización OAuth.

- Endpoints críticos.

### Variables de entorno

Todas las variables deben:

- Estar documentadas en `.env.example`.

- Validarse mediante Zod al iniciar la aplicación.

- Accederse desde un módulo central de configuración.

- Tener nombres explícitos.

- No contener valores reales dentro del repositorio.

Ejemplo:

```env
NODE_ENV=development

DATABASE_URL=

REDIS_HOST=
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

OAUTH_CLIENT_ID=
OAUTH_CLIENT_SECRET=
OAUTH_AUTHORIZATION_URL=
OAUTH_TOKEN_URL=
OAUTH_USER_INFO_URL=
OAUTH_REDIRECT_URI=
OAUTH_ISSUER=
OAUTH_JWKS_URL=
OAUTH_SCOPES=openid profile email

SESSION_SECRET=
SESSION_COOKIE_NAME=app_session
SESSION_MAX_AGE=3600

SMTP_HOST=
SMTP_PORT=
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=

LOG_LEVEL=info
```

## Estilo visual

_No aplica. El proyecto es exclusivamente backend y no incluye interfaz de usuario._

- No se definen colores, tipografías, componentes visuales ni breakpoints.

- No se incorporan Material UI, MUI X, React Query, Redux, formularios React, Highcharts, Leaflet ni otras dependencias de frontend.

- La única interfaz expuesta será la API HTTP y, cuando se habilite, la documentación Swagger/OpenAPI.

## Límites duros

_Lo que nunca se debe hacer._

- No utilizar una versión de Node.js inferior a la 22.

- No utilizar App Router para implementar APIs.

- No crear endpoints dentro de `app/api/` o `src/app/api/`.

- No implementar frontend dentro de este proyecto.

- No agregar componentes React, páginas visuales, CSS ni librerías de interfaz.

- No agregar Material UI, MUI X, Redux, React Query, react-hook-form, Yup, Highcharts, Leaflet ni dependencias exclusivamente frontend.

- No utilizar LDAP; la autenticación debe realizarse mediante OAuth 2.0 u OpenID Connect.

- No utilizar JavaScript cuando el archivo pueda implementarse en TypeScript.

- No utilizar `any` para evitar definir o validar un tipo.

- No utilizar funciones tradicionales cuando una función flecha sea adecuada.

- No instanciar `PrismaClient` fuera de `database/client.ts`.

- No ejecutar consultas Prisma directamente desde API Routes.

- No colocar reglas del negocio dentro de API Routes.

- No realizar llamadas a integraciones externas directamente desde API Routes.

- No recibir objetos HTTP dentro de los servicios o la capa `database/`.

- No acceder directamente a `process.env` fuera del módulo central de configuración.

- No almacenar secretos en código, seeds, logs o pruebas.

- No versionar `.env`, `.env.local` ni archivos equivalentes.

- No versionar `prisma/seed/vars.ts`.

- No registrar access tokens, refresh tokens, cookies completas, contraseñas o códigos OAuth.

- No exponer trazas, consultas SQL, errores de Prisma ni detalles internos al cliente.

- No crear endpoints sin validación de entrada.

- No crear endpoints protegidos sin autenticación y autorización.

- No confiar únicamente en el nombre del rol; se deben validar permisos.

- No almacenar tokens OAuth en `localStorage`.

- No utilizar OAuth 2.0 Implicit Flow.

- No utilizar Resource Owner Password Credentials.

- No aceptar campos de ordenamiento o filtros dinámicos sin validarlos contra una lista permitida.

- No crear listados potencialmente grandes sin paginación.

- No recuperar columnas o relaciones innecesarias.

- No ejecutar consultas dentro de ciclos cuando pueda resolverse mediante una consulta conjunta.

- No utilizar SQL sin procesar con concatenación de entradas externas.

- No modificar migraciones que ya hayan sido aplicadas en entornos compartidos.

- No ejecutar `prisma migrate dev` en producción.

- No utilizar `prisma db push` como reemplazo del flujo formal de migraciones.

- No mezclar Yarn, npm y pnpm en el mismo repositorio.

- No mantener más de un archivo de bloqueo (`yarn.lock` es el único autorizado).

- No agregar dependencias sin revisar necesidad, seguridad, mantenimiento e impacto.

- No almacenar datos sensibles en Redis sin una justificación y protección adecuadas.

- No procesar dentro de la solicitud HTTP tareas pesadas que puedan delegarse a BullMQ.

- No generar PDF, Excel o envíos masivos de correo de forma síncrona cuando puedan afectar el tiempo de respuesta.

- No introducir dependencias circulares mediante archivos `index.ts`.

- No silenciar errores de TypeScript o reglas de ESLint sin una justificación técnica documentada.
