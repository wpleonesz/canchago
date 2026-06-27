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

registry.registerPath({
	method: 'get',
	path: '/auth/login',
	tags: ['Auth'],
	security: [],
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
	responses: {
		204: {
			description: 'Sesión eliminada',
		},
		401: errorResponses[401],
	},
});
