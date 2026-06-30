import { z } from 'zod';

import { registry } from '@/documentation/registry';

const EXAMPLE_UUID = '123e4567-e89b-12d3-a456-426614174000';

const userIdParam = {
	name: 'userId',
	in: 'path' as const,
	required: true,
	schema: { type: 'string' as const, format: 'uuid' },
	example: EXAMPLE_UUID,
};
import { ErrorResponseSchema, PaginationMetaSchema } from '@/documentation/responses/common';

const RoleSchema = z.object({
	id: z.string().uuid(),
	code: z.string(),
	name: z.string(),
});

export const UserResponseSchema = z.object({
	id: z.string().uuid(),
	email: z.string().email(),
	firstName: z.string(),
	lastName: z.string(),
	active: z.boolean(),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime().optional(),
	roles: z.array(RoleSchema).optional(),
});

export const CreateUserBodySchema = z.object({
	email: z.string().email(),
	firstName: z.string().min(1),
	lastName: z.string().min(1),
	organizationId: z.string().uuid(),
});

export const UpdateUserBodySchema = CreateUserBodySchema.partial();

export const UserListResponseSchema = z.object({
	data: z.array(UserResponseSchema),
	meta: PaginationMetaSchema,
});

registry.register('UserResponse', UserResponseSchema);
registry.register('CreateUserBody', CreateUserBodySchema);
registry.register('UpdateUserBody', UpdateUserBodySchema);
registry.register('UserListResponse', UserListResponseSchema);

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
		description: 'Usuario no encontrado',
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

registry.registerPath({
	method: 'get',
	path: '/users',
	tags: ['Users'],
	security: [{ cookieAuth: [] }],
	description: 'Obtiene una lista paginada de usuarios. Requiere permiso `users.read`.',
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
			name: 'active',
			in: 'query',
			schema: { type: 'boolean' },
			description: 'Filtrar por estado activo',
		},
		{
			name: 'orderBy',
			in: 'query',
			schema: { type: 'string', enum: ['name', 'email', 'createdAt'] },
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
			description: 'Lista de usuarios',
			content: {
				'application/json': {
					schema: UserListResponseSchema,
				},
			},
		},
		...errorResponses,
	},
});

registry.registerPath({
	method: 'post',
	path: '/users',
	tags: ['Users'],
	security: [{ cookieAuth: [] }],
	description: 'Crea un nuevo usuario. Requiere permiso `users.create`.',
	requestBody: {
		required: true,
		content: {
			'application/json': {
				schema: CreateUserBodySchema,
				example: {
					email: 'juan.perez@ejemplo.com',
					firstName: 'Juan',
					lastName: 'Pérez',
					organizationId: '123e4567-e89b-12d3-a456-426614174000',
				},
			},
		},
	},
	responses: {
		201: {
			description: 'Usuario creado',
			content: {
				'application/json': {
					schema: z.object({
						data: UserResponseSchema,
					}),
				},
			},
		},
		...errorResponses,
	},
});

registry.registerPath({
	method: 'get',
	path: '/users/{userId}',
	tags: ['Users'],
	security: [{ cookieAuth: [] }],
	description: 'Obtiene un usuario por ID. Requiere permiso `users.read`.',
	parameters: [userIdParam],
	responses: {
		200: {
			description: 'Usuario encontrado',
			content: {
				'application/json': {
					schema: z.object({
						data: UserResponseSchema,
					}),
				},
			},
		},
		...errorResponses,
	},
});

registry.registerPath({
	method: 'patch',
	path: '/users/{userId}',
	tags: ['Users'],
	security: [{ cookieAuth: [] }],
	description: 'Actualiza un usuario. Requiere permiso `users.update`.',
	parameters: [userIdParam],
	requestBody: {
		required: false,
		content: {
			'application/json': {
				schema: UpdateUserBodySchema,
				example: {
					firstName: 'Juan Carlos',
					lastName: 'Pérez García',
				},
			},
		},
	},
	responses: {
		200: {
			description: 'Usuario actualizado',
			content: {
				'application/json': {
					schema: z.object({
						data: UserResponseSchema,
					}),
				},
			},
		},
		...errorResponses,
	},
});

registry.registerPath({
	method: 'delete',
	path: '/users/{userId}',
	tags: ['Users'],
	security: [{ cookieAuth: [] }],
	description: 'Elimina (soft delete) un usuario. Requiere permiso `users.delete`.',
	parameters: [userIdParam],
	responses: {
		204: {
			description: 'Usuario eliminado',
		},
		...errorResponses,
	},
});
