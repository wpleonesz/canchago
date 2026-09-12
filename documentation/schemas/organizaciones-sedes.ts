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
	// Solo presente en el listado (GET /organizaciones): conteo de sedes activas, resuelto con
	// _count en la misma consulta (sin N+1). Ausente en las respuestas de detalle/mutación.
	venuesCount: z.number().int().optional(),
});

export const CreateOrganizationBodySchema = z.object({
	name: z.string().min(1).max(150),
	legalName: z.string().max(200).optional(),
	taxIdentification: z.string().max(30).optional(),
	email: z.string().email().optional(),
	phone: z.string().max(20).optional(),
	domain: z.string().max(255).optional(),
});

export const UpdateOrganizationBodySchema = CreateOrganizationBodySchema.partial().extend({
	// Concurrencia optimista (feature 019): el timestamp updatedAt recibido en el último GET.
	// Si no coincide con el real, PATCH responde 409 sin aplicar ningún cambio.
	expectedUpdatedAt: z.string().datetime(),
	// Exclusivo de Administrador global (feature 023): cualquier otro actor que lo envíe recibe
	// 403, aunque tenga organizaciones.manage y alcance real sobre la organización. Nunca acepta
	// 'PENDING_APPROVAL', que solo controla el flujo de aprobación de solicitudes (feature 016).
	status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

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

export const UpdateSedeBodySchema = CreateSedeBodySchema.partial().extend({
	// Concurrencia optimista (feature 019): mismo criterio que UpdateOrganizationBodySchema.
	expectedUpdatedAt: z.string().datetime(),
	// Exclusivo de Administrador global (feature 023), mismo criterio que
	// UpdateOrganizationBodySchema.status.
	status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

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
		'Obtiene una lista paginada de organizaciones. Requiere permiso `organizaciones.read`. Un actor sin el rol global Administrador solo ve las organizaciones donde tiene alcance. Cada elemento incluye `venuesCount` (conteo de sedes activas, sin consultas adicionales por fila).',
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
	description:
		'Crea una nueva organización. Requiere permiso `organizaciones.manage`. El nombre es único a nivel de plataforma (comparación case-insensitive tras normalizar espacios) — un nombre ya usado responde 409.',
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
	description:
		'Obtiene una organización por ID. Requiere permiso `organizaciones.read` y alcance sobre esa organización — un actor no administrador global sin alcance recibe 404 opaco, no 403 (no revela que el recurso existe fuera de su alcance).',
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
	description:
		'Actualiza una organización. Requiere permiso `organizaciones.manage` y alcance sobre la organización (un actor no administrador global sin alcance recibe 404 opaco, no 403). `expectedUpdatedAt` es obligatorio: si no coincide con el `updatedAt` real, responde 409 sin aplicar cambios (concurrencia optimista). El campo `status` (feature 023) solo puede enviarlo un Administrador global: cualquier otro actor que lo incluya recibe 403, aunque tenga alcance real sobre la organización.',
	parameters: [organizationIdParam],
	requestBody: {
		required: true,
		content: {
			'application/json': {
				schema: UpdateOrganizationBodySchema,
				example: {
					name: 'Mi Organización Actualizada',
					email: 'newemail@miorg.com',
					expectedUpdatedAt: '2026-08-29T12:00:00.000Z',
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
	description:
		'Crea una nueva sede. Requiere permiso `organizaciones.manage` y alcance sobre `organizationId`. Si la organización no existe (o está borrada), responde 404 en vez de un error genérico.',
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
	description:
		'Obtiene una sede por ID. Requiere permiso `organizaciones.read` y alcance sobre `organizationId`. La sede debe pertenecer exactamente a esa organización — un `sedeId` real de otra organización responde 404 opaco, nunca los datos de esa sede (feature 019).',
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
	description:
		'Actualiza una sede. Requiere permiso `organizaciones.manage` y alcance sobre `organizationId`. La sede debe pertenecer exactamente a esa organización — un `sedeId` real de otra organización responde 404 opaco, nunca los datos de esa sede. `expectedUpdatedAt` es obligatorio (concurrencia optimista, mismo criterio que organizaciones). El campo `status` (feature 023) solo puede enviarlo un Administrador global, mismo criterio que en organizaciones.',
	parameters: [organizationIdParam, sedeIdParam],
	requestBody: {
		required: true,
		content: {
			'application/json': {
				schema: UpdateSedeBodySchema,
				example: {
					name: 'Sede Principal - Centro',
					phone: '+593988888888',
					expectedUpdatedAt: '2026-08-29T12:00:00.000Z',
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

// Solicitudes de acceso (Gestor de Cancha) creadas por el registro público - feature 016.
const requestIdParam = {
	name: 'requestId',
	in: 'path' as const,
	required: true,
	schema: { type: 'string' as const, format: 'uuid' },
	example: EXAMPLE_UUID,
};

export const AccessRequestResponseSchema = z.object({
	id: z.string().uuid(),
	status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
	createdAt: z.string().datetime(),
	reviewedAt: z.string().datetime().nullable(),
	rejectionReason: z.string().nullable(),
	organization: z.object({
		id: z.string().uuid(),
		name: z.string(),
		status: z.string(),
		venues: z.array(z.object({ id: z.string().uuid(), name: z.string(), status: z.string() })),
	}),
	requester: z.object({
		id: z.string().uuid(),
		email: z.string().email(),
		profile: z.object({ firstName: z.string(), lastName: z.string() }).nullable(),
	}),
});

export const AccessRequestListResponseSchema = z.object({
	data: z.array(AccessRequestResponseSchema),
	meta: PaginationMetaSchema,
});

registry.register('AccessRequestResponse', AccessRequestResponseSchema);
registry.register('AccessRequestListResponse', AccessRequestListResponseSchema);

registry.registerPath({
	method: 'get',
	path: '/organizaciones/access-requests',
	tags: ['Organizaciones'],
	security: [{ cookieAuth: [] }],
	description:
		'Lista paginada de solicitudes de acceso como Gestor de Cancha (creadas por el registro público, feature 016). Requiere permiso `organizaciones.manage`.',
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
			name: 'status',
			in: 'query',
			schema: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED'] },
			description: 'Filtro de estado (default: PENDING)',
		},
	],
	responses: {
		200: {
			description: 'Lista de solicitudes',
			content: { 'application/json': { schema: AccessRequestListResponseSchema } },
		},
		...errorResponses,
	},
});

registry.registerPath({
	method: 'post',
	path: '/organizaciones/access-requests/{requestId}/approve',
	tags: ['Organizaciones'],
	security: [{ cookieAuth: [] }],
	description:
		'Aprueba una solicitud pendiente: activa la organización y su(s) sede(s), y crea el rol `Gestor de Cancha` (si no existe para esa organización) asignado al solicitante. Requiere permiso `organizaciones.manage`.',
	parameters: [requestIdParam],
	responses: {
		200: {
			description: 'Solicitud aprobada',
			content: {
				'application/json': {
					schema: z.object({
						data: z.object({ organizationId: z.string().uuid(), status: z.literal('APPROVED') }),
					}),
				},
			},
		},
		...errorResponses,
		409: {
			description: 'La solicitud ya fue revisada',
			content: { 'application/json': { schema: ErrorResponseSchema } },
		},
	},
});

registry.registerPath({
	method: 'post',
	path: '/organizaciones/access-requests/{requestId}/reject',
	tags: ['Organizaciones'],
	security: [{ cookieAuth: [] }],
	description:
		'Rechaza una solicitud pendiente (la organización/sede quedan en `PENDING_APPROVAL`, no se activan ni se borran). Requiere permiso `organizaciones.manage`.',
	parameters: [requestIdParam],
	requestBody: {
		required: false,
		content: {
			'application/json': {
				schema: z.object({ reason: z.string().max(500).optional() }),
			},
		},
	},
	responses: {
		200: {
			description: 'Solicitud rechazada',
			content: {
				'application/json': {
					schema: z.object({
						data: z.object({ requestId: z.string().uuid(), status: z.literal('REJECTED') }),
					}),
				},
			},
		},
		...errorResponses,
		409: {
			description: 'La solicitud ya fue revisada',
			content: { 'application/json': { schema: ErrorResponseSchema } },
		},
	},
});
