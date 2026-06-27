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

Cómo probarlo:

1. Abre la ruta en el navegador o con curl: curl -i http://localhost:3000/api/auth/login
2. Verifica que la respuesta sea un 302 con Location apuntando al proveedor OAuth.
3. Confirma que la respuesta incluya una cookie temporal HttpOnly con state, code_verifier y nonce.
`;

const callbackDescription = `Procesa el código OAuth devuelto por el proveedor y crea la sesión interna.

Cómo probarlo:

1. Completa primero /api/auth/login para generar la cookie temporal.
2. Repite la llamada simulando el callback del proveedor con curl -i "http://localhost:3000/api/auth/callback?code=AUTH_CODE&state=STATE_VALUE" --cookie "canchago_oauth_state=COOKIE_VALUE".
3. Verifica que la respuesta sea un 302 hacia OAUTH_SUCCESS_REDIRECT_URL y que se establezca la cookie de sesión.
`;

const sessionDescription = `Devuelve el usuario autenticado asociado a la cookie de sesión.

Cómo probarlo:

1. Copia la cookie canchago_session generada por el callback.
2. Invoca la ruta con esa cookie usando curl -i http://localhost:3000/api/auth/session --cookie "canchago_session=SESSION_COOKIE_VALUE".
3. La respuesta debe ser 200 con data.id, data.email, data.name, data.roles y data.permissions.
`;

const refreshDescription = `Renueva la sesión cuando el access token está próximo a expirar.

Cómo probarlo:

1. Usa una cookie de sesión válida.
2. Lanza la renovación con curl -i -X POST http://localhost:3000/api/auth/refresh --cookie "canchago_session=SESSION_COOKIE_VALUE".
3. Si el token está cerca de expirar, la respuesta debe incluir una cookie actualizada y terminar en 204.
4. Si todavía no hace falta renovar, la respuesta también debe ser 204 sin cambios visibles.
`;

const logoutDescription = `Cierra la sesión y elimina la cookie interna.

Cómo probarlo:

1. Usa una cookie de sesión válida.
2. Ejecuta el cierre de sesión con curl -i -X POST http://localhost:3000/api/auth/logout --cookie "canchago_session=SESSION_COOKIE_VALUE".
3. La respuesta debe ser 204 y el navegador debe eliminar la cookie de sesión.
`;

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
