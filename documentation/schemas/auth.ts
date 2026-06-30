import { z } from 'zod';

import { registry } from '@/documentation/registry';
import { ErrorResponseSchema } from '@/documentation/responses/common';

const RoleSchema = z.object({
	id: z.string().uuid(),
	code: z.string(),
	name: z.string(),
});

const PermissionSchema = z.object({
	id: z.string().uuid(),
	code: z.string(),
});

export const SessionResponseSchema = z.object({
	id: z.string().uuid(),
	email: z.string().email(),
	name: z.string(),
	roles: z.array(RoleSchema),
	permissions: z.array(PermissionSchema),
});

registry.register('SessionResponse', SessionResponseSchema);
registry.register('ErrorResponse', ErrorResponseSchema);
registry.registerComponent('securitySchemes', 'cookieAuth', {
	type: 'apiKey',
	in: 'cookie',
	name: 'canchago_session',
});

const errorResponses = {
	400: {
		description: 'Solicitud inválida',
		content: {
			'application/json': {
				schema: ErrorResponseSchema,
			},
		},
	},
	401: {
		description: 'No autenticado',
		content: {
			'application/json': {
				schema: ErrorResponseSchema,
			},
		},
	},
};

const loginDescription = `Inicia el flujo OAuth 2.0 Authorization Code + PKCE.

**Cómo probar desde esta documentación:**

1. Haz clic en **Execute** — la respuesta será un \`302\` que el navegador seguirá automáticamente.
2. Completa el login en el proveedor OAuth.
3. Al volver, la cookie de sesión quedará activa en el navegador.
4. Todos los endpoints protegidos (**🔒**) ya podrán ejecutarse desde aquí sin configuración adicional.

> La cookie es \`HttpOnly\` y el navegador la envía automáticamente gracias a \`withCredentials: true\`.`;

const callbackDescription = `Procesa el código OAuth devuelto por el proveedor y crea la sesión interna.

Este endpoint **no se llama directamente** — es la URL de retorno del proveedor OAuth después de que el usuario autoriza el acceso.

El flujo completo es:
1. \`GET /auth/login\` → redirige al proveedor OAuth.
2. El proveedor redirige a \`GET /auth/callback?code=...&state=...\`.
3. Este endpoint valida el código, crea la sesión y redirige al cliente.`;

const sessionDescription = `Devuelve el usuario autenticado asociado a la cookie de sesión activa.

**Cómo probar desde esta documentación:**

1. Asegúrate de haber iniciado sesión a través de \`GET /auth/login\`.
2. Haz clic en **Execute** — la cookie se enviará automáticamente.
3. La respuesta incluye \`id\`, \`email\`, \`name\`, \`roles\` y \`permissions\`.`;

const refreshDescription = `Renueva el access token cuando está próximo a expirar.

**Comportamiento:**
- Si el token expira en menos de 5 minutos → renueva y devuelve \`204\` con cookie actualizada.
- Si el token sigue vigente → devuelve \`204\` sin cambios.

**Cómo probar desde esta documentación:**

1. Asegúrate de tener sesión activa.
2. Haz clic en **Execute** — la cookie se enviará automáticamente.`;

const logoutDescription = `Cierra la sesión y elimina la cookie interna.

**Cómo probar desde esta documentación:**

1. Asegúrate de tener sesión activa.
2. Haz clic en **Execute**.
3. La respuesta será \`204\` y la cookie de sesión quedará eliminada.
4. Los endpoints protegidos comenzarán a devolver \`401\` hasta que vuelvas a hacer login.`;

registry.registerPath({
	method: 'get',
	path: '/auth/login',
	tags: ['Auth'],
	security: [],
	description: loginDescription,
	responses: {
		302: {
			description: 'Redirección al proveedor OAuth',
		},
		...errorResponses,
	},
});

registry.registerPath({
	method: 'get',
	path: '/auth/callback',
	tags: ['Auth'],
	security: [],
	description: callbackDescription,
	responses: {
		302: {
			description: 'Redirección al cliente con sesión creada',
		},
		...errorResponses,
	},
});

registry.registerPath({
	method: 'get',
	path: '/auth/session',
	tags: ['Auth'],
	security: [{ cookieAuth: [] }],
	description: sessionDescription,
	responses: {
		200: {
			description: 'Sesión activa',
			content: {
				'application/json': {
					schema: z.object({
						data: SessionResponseSchema,
					}),
				},
			},
		},
		401: errorResponses[401],
	},
});

registry.registerPath({
	method: 'post',
	path: '/auth/refresh',
	tags: ['Auth'],
	security: [{ cookieAuth: [] }],
	description: refreshDescription,
	responses: {
		204: {
			description: 'Sesión renovada',
		},
		401: errorResponses[401],
		400: errorResponses[400],
	},
});

registry.registerPath({
	method: 'post',
	path: '/auth/logout',
	tags: ['Auth'],
	security: [{ cookieAuth: [] }],
	description: logoutDescription,
	responses: {
		204: {
			description: 'Sesión eliminada',
		},
		401: errorResponses[401],
	},
});
