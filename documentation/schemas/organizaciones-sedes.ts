import { z } from 'zod';

import { registry } from '@/documentation/registry';
import { ErrorResponseSchema, PaginationMetaSchema } from '@/documentation/responses/common';

const EXAMPLE_UUID = '123e4567-e89b-12d3-a456-426614174000';

const organizationIdParam = {
	name: 'organizationId',
	in: 'path' as const,
	required: true,
	schema: { type: 'string' as const, format: 'uuid' },
	example: EXAMPLE_UUID,
};

const sedeIdParam = {
	name: 'sedeId',
	in: 'path' as const,
	required: true,
	schema: { type: 'string' as const, format: 'uuid' },
	example: EXAMPLE_UUID,
};

export const OrganizationResponseSchema = z.object({
	id: z.string().uuid(),
	name: z.string(),
	legalName: z.string().nullable().optional(),
	taxIdentification: z.string().nullable().optional(),
	email: z.string().email().nullable().optional(),
	phone: z.string().nullable().optional(),
	domain: z.string().nullable().optional(),
	status: z.string(),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
});

export const CreateOrganizationBodySchema = z.object({
	name: z.string().min(1).max(150),
	legalName: z.string().max(200).optional(),
	taxIdentification: z.string().max(30).optional(),
	email: z.string().email().optional(),
	phone: z.string().max(20).optional(),
	domain: z.string().max(255).optional(),
});

export const UpdateOrganizationBodySchema = CreateOrganizationBodySchema.partial();

export const OrganizationListResponseSchema = z.object({
	data: z.array(OrganizationResponseSchema),
	meta: PaginationMetaSchema,
});

export const SedeResponseSchema = z.object({
	id: z.string().uuid(),
	organizationId: z.string().uuid(),
	name: z.string(),
	address: z.string().nullable().optional(),
	phone: z.string().nullable().optional(),
	email: z.string().email().nullable().optional(),
	status: z.string(),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
});

export const CreateSedeBodySchema = z.object({
	name: z.string().min(1).max(150),
	address: z.string().max(500).optional(),
	phone: z.string().max(20).optional(),
	email: z.string().email().optional(),
});

export const UpdateSedeBodySchema = CreateSedeBodySchema.partial();

export const SedeListResponseSchema = z.object({
	data: z.array(SedeResponseSchema),
	meta: PaginationMetaSchema,
});

registry.register('OrganizationResponse', OrganizationResponseSchema);
registry.register('CreateOrganizationBody', CreateOrganizationBodySchema);
registry.register('UpdateOrganizationBody', UpdateOrganizationBodySchema);
registry.register('OrganizationListResponse', OrganizationListResponseSchema);
registry.register('SedeResponse', SedeResponseSchema);
registry.register('CreateSedeBody', CreateSedeBodySchema);
registry.register('UpdateSedeBody', UpdateSedeBodySchema);
registry.register('SedeListResponse', SedeListResponseSchema);

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
	403: {
		description: 'Permisos insuficientes',
		content: {
			'application/json': {
				schema: ErrorResponseSchema,
			},
		},
	},
	404: {
		description: 'Recurso no encontrado',
		content: {
			'application/json': {
				schema: ErrorResponseSchema,
			},
		},
	},
	409: {
		description: 'Conflicto: el recurso ya existe',
		content: {
			'application/json': {
				schema: ErrorResponseSchema,
			},
		},
	},
};

// Organizaciones - Listar y Crear
registry.registerPath({
	method: 'get',
	path: '/organizaciones',
	tags: ['Organizaciones'],
	security: [{ cookieAuth: [] }],
	description:
		'Obtiene una lista paginada de organizaciones. Requiere permiso `organizaciones.read`.',
	parameters: [
		{
			name: 'page',
			in: 'query',
			schema: { type: 'integer', minimum: 1 },
			description: 'Número de página (default: 1)',
		},
		{
			name: 'pageSize',
			in: 'query',
			schema: { type: 'integer', minimum: 1, maximum: 100 },
			description: 'Registros por página (default: 20)',
		},
		{
			name: 'search',
			in: 'query',
			schema: { type: 'string' },
			description: 'Búsqueda por nombre o email',
		},
		{
			name: 'orderBy',
			in: 'query',
			schema: { type: 'string', enum: ['name', 'createdAt'] },
			description: 'Campo para ordenamiento',
		},
		{
			name: 'order',
			in: 'query',
			schema: { type: 'string', enum: ['asc', 'desc'] },
			description: 'Dirección del ordenamiento',
		},
	],
	responses: {
		200: {
			description: 'Lista de organizaciones',
			content: {
				'application/json': {
					schema: OrganizationListResponseSchema,
				},
			},
		},
		...errorResponses,
	},
});

registry.registerPath({
	method: 'post',
	path: '/organizaciones',
	tags: ['Organizaciones'],
	security: [{ cookieAuth: [] }],
	description: 'Crea una nueva organización. Requiere permiso `organizaciones.manage`.',
	requestBody: {
		required: true,
		content: {
			'application/json': {
				schema: CreateOrganizationBodySchema,
				example: {
					name: 'Mi Organización',
					legalName: 'Mi Organización S.A.',
					taxIdentification: 'RUC123456789',
					email: 'contacto@miorg.com',
					phone: '+593999999999',
					domain: 'miorg.com',
				},
			},
		},
	},
	responses: {
		201: {
			description: 'Organización creada',
			content: {
				'application/json': {
					schema: z.object({
						data: OrganizationResponseSchema,
					}),
				},
			},
		},
		...errorResponses,
	},
});

// Organizaciones - Detalle, Actualizar, Eliminar
registry.registerPath({
	method: 'get',
	path: '/organizaciones/{organizationId}',
	tags: ['Organizaciones'],
	security: [{ cookieAuth: [] }],
	description: 'Obtiene una organización por ID. Requiere permiso `organizaciones.read`.',
	parameters: [organizationIdParam],
	responses: {
		200: {
			description: 'Organización encontrada',
			content: {
				'application/json': {
					schema: z.object({
						data: OrganizationResponseSchema,
					}),
				},
			},
		},
		...errorResponses,
	},
});

registry.registerPath({
	method: 'patch',
	path: '/organizaciones/{organizationId}',
	tags: ['Organizaciones'],
	security: [{ cookieAuth: [] }],
	description: 'Actualiza una organización. Requiere permiso `organizaciones.manage`.',
	parameters: [organizationIdParam],
	requestBody: {
		required: false,
		content: {
			'application/json': {
				schema: UpdateOrganizationBodySchema,
				example: {
					name: 'Mi Organización Actualizada',
					email: 'newemail@miorg.com',
				},
			},
		},
	},
	responses: {
		200: {
			description: 'Organización actualizada',
			content: {
				'application/json': {
					schema: z.object({
						data: OrganizationResponseSchema,
					}),
				},
			},
		},
		...errorResponses,
	},
});

registry.registerPath({
	method: 'delete',
	path: '/organizaciones/{organizationId}',
	tags: ['Organizaciones'],
	security: [{ cookieAuth: [] }],
	description:
		'Elimina (soft delete) una organización y todas sus sedes. Requiere permiso `organizaciones.manage`.',
	parameters: [organizationIdParam],
	responses: {
		204: {
			description: 'Organización eliminada',
		},
		...errorResponses,
	},
});

// Sedes - Listar y Crear
registry.registerPath({
	method: 'get',
	path: '/organizaciones/{organizationId}/sedes',
	tags: ['Sedes'],
	security: [{ cookieAuth: [] }],
	description:
		'Obtiene una lista paginada de sedes de una organización. Requiere permiso `organizaciones.read`.',
	parameters: [
		organizationIdParam,
		{
			name: 'page',
			in: 'query',
			schema: { type: 'integer', minimum: 1 },
			description: 'Número de página (default: 1)',
		},
		{
			name: 'pageSize',
			in: 'query',
			schema: { type: 'integer', minimum: 1, maximum: 100 },
			description: 'Registros por página (default: 20)',
		},
		{
			name: 'search',
			in: 'query',
			schema: { type: 'string' },
			description: 'Búsqueda por nombre o email',
		},
		{
			name: 'orderBy',
			in: 'query',
			schema: { type: 'string', enum: ['name', 'createdAt'] },
			description: 'Campo para ordenamiento',
		},
		{
			name: 'order',
			in: 'query',
			schema: { type: 'string', enum: ['asc', 'desc'] },
			description: 'Dirección del ordenamiento',
		},
	],
	responses: {
		200: {
			description: 'Lista de sedes',
			content: {
				'application/json': {
					schema: SedeListResponseSchema,
				},
			},
		},
		...errorResponses,
	},
});

registry.registerPath({
	method: 'post',
	path: '/organizaciones/{organizationId}/sedes',
	tags: ['Sedes'],
	security: [{ cookieAuth: [] }],
	description: 'Crea una nueva sede. Requiere permiso `organizaciones.manage`.',
	parameters: [organizationIdParam],
	requestBody: {
		required: true,
		content: {
			'application/json': {
				schema: CreateSedeBodySchema,
				example: {
					name: 'Sede Principal',
					address: 'Calle Principal 123, Quito',
					phone: '+593999999999',
					email: 'sede1@miorg.com',
				},
			},
		},
	},
	responses: {
		201: {
			description: 'Sede creada',
			content: {
				'application/json': {
					schema: z.object({
						data: SedeResponseSchema,
					}),
				},
			},
		},
		...errorResponses,
	},
});

// Sedes - Detalle, Actualizar, Eliminar
registry.registerPath({
	method: 'get',
	path: '/organizaciones/{organizationId}/sedes/{sedeId}',
	tags: ['Sedes'],
	security: [{ cookieAuth: [] }],
	description: 'Obtiene una sede por ID. Requiere permiso `organizaciones.read`.',
	parameters: [organizationIdParam, sedeIdParam],
	responses: {
		200: {
			description: 'Sede encontrada',
			content: {
				'application/json': {
					schema: z.object({
						data: SedeResponseSchema,
					}),
				},
			},
		},
		...errorResponses,
	},
});

registry.registerPath({
	method: 'patch',
	path: '/organizaciones/{organizationId}/sedes/{sedeId}',
	tags: ['Sedes'],
	security: [{ cookieAuth: [] }],
	description: 'Actualiza una sede. Requiere permiso `organizaciones.manage`.',
	parameters: [organizationIdParam, sedeIdParam],
	requestBody: {
		required: false,
		content: {
			'application/json': {
				schema: UpdateSedeBodySchema,
				example: {
					name: 'Sede Principal - Centro',
					phone: '+593988888888',
				},
			},
		},
	},
	responses: {
		200: {
			description: 'Sede actualizada',
			content: {
				'application/json': {
					schema: z.object({
						data: SedeResponseSchema,
					}),
				},
			},
		},
		...errorResponses,
	},
});

registry.registerPath({
	method: 'delete',
	path: '/organizaciones/{organizationId}/sedes/{sedeId}',
	tags: ['Sedes'],
	security: [{ cookieAuth: [] }],
	description: 'Elimina (soft delete) una sede. Requiere permiso `organizaciones.manage`.',
	parameters: [organizationIdParam, sedeIdParam],
	responses: {
		204: {
			description: 'Sede eliminada',
		},
		...errorResponses,
	},
});
