/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { z } from 'zod';

import { registry } from '@/documentation/registry';

const MenuSchema = z.object({
	id: z.string().uuid(),
	code: z.string(),
	name: z.string(),
	route: z.string().nullable(),
	parentId: z.string().uuid().nullable(),
	permissions: z.array(z.string()),
});

const MenusPaginatedSchema = z.object({
	data: z.array(MenuSchema),
	meta: z.object({
		page: z.number(),
		pageSize: z.number(),
		total: z.number(),
		totalPages: z.number(),
	}),
});

const ValidationErrorSchema = z.object({
	error: z.object({
		code: z.literal('VALIDATION_ERROR'),
		message: z.string(),
		details: z.array(z.unknown()).optional(),
	}),
});

const ForbiddenErrorSchema = z.object({
	error: z.object({
		code: z.literal('FORBIDDEN'),
		message: z.string(),
	}),
});

registry.register('Menu', MenuSchema);
registry.register('MenusPaginated', MenusPaginatedSchema);

const menusListDescription = `Listar el catálogo de menús administrables, con su jerarquía (\`parentId\`) y los códigos de permiso reales que los gobiernan.

**Parámetros de query:**
- \`page\` (número, default: 1) — página a mostrar
- \`pageSize\` (número, default: 20, máx: 100) — menús por página

Un menú visible en esta respuesta **no otorga acceso** a los recursos que representa: cada endpoint de recurso sigue validando su propio permiso de forma independiente.

**Requiere permiso:** \`menus.read\`.`;

const errorResponses = {
	400: {
		description: 'Solicitud inválida',
		content: {
			'application/json': {
				schema: ValidationErrorSchema,
			},
		},
	},
	401: {
		description: 'No autenticado',
		content: {
			'application/json': {
				schema: z.object({
					error: z.object({
						code: z.literal('UNAUTHORIZED'),
						message: z.string(),
					}),
				}),
			},
		},
	},
	403: {
		description: 'Permisos insuficientes',
		content: {
			'application/json': {
				schema: ForbiddenErrorSchema,
			},
		},
	},
};

registry.registerPath({
	method: 'get',
	path: '/menus',
	tags: ['Menús'],
	security: [{ cookieAuth: [] }],
	description: menusListDescription,
	parameters: [
		{
			name: 'page',
			in: 'query',
			schema: { type: 'integer', default: 1 },
		},
		{
			name: 'pageSize',
			in: 'query',
			schema: { type: 'integer', default: 20, maximum: 100 },
		},
	],
	responses: {
		200: {
			description: 'Lista de menús',
			content: {
				'application/json': {
					schema: MenusPaginatedSchema,
				},
			},
		},
		...errorResponses,
	},
});
