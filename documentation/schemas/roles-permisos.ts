/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { z } from 'zod';

import { registry } from '@/documentation/registry';

// Schemas para Roles
const PermissionDetailSchema = z.object({
	id: z.string().uuid(),
	module: z.string(),
	action: z.string(),
	code: z.string(),
	description: z.string().nullable(),
	createdAt: z.string().datetime(),
});

const RolePermissionSchema = z.object({
	roleId: z.string().uuid(),
	permissionId: z.string().uuid(),
	granted: z.boolean(),
	permission: PermissionDetailSchema,
});

const RoleSchema = z.object({
	id: z.string().uuid(),
	organizationId: z.string().uuid(),
	name: z.string(),
	description: z.string().nullable(),
	code: z.string(),
	isSystem: z.boolean(),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
	_count: z.object({
		permissions: z.number(),
	}),
});

const RoleDetailSchema = z.object({
	id: z.string().uuid(),
	organizationId: z.string().uuid(),
	name: z.string(),
	description: z.string().nullable(),
	code: z.string(),
	isSystem: z.boolean(),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
	permissions: z.array(RolePermissionSchema),
});

const CreateRoleInputSchema = z.object({
	name: z.string().min(1).max(150),
	description: z.string().max(500).optional(),
	permissionIds: z.array(z.string().uuid()).optional(),
});

const UpdateRoleInputSchema = z.object({
	name: z.string().min(1).max(150).optional(),
	description: z.string().max(500).nullable().optional(),
	permissionIds: z.array(z.string().uuid()).optional(),
});

// Schemas para Permisos
const PermissionSchema = z.object({
	id: z.string().uuid(),
	module: z.string(),
	action: z.string(),
	code: z.string(),
	description: z.string().nullable(),
	createdAt: z.string().datetime(),
});

// Schemas paginados
const RolesPaginatedSchema = z.object({
	data: z.array(RoleSchema),
	meta: z.object({
		page: z.number(),
		pageSize: z.number(),
		total: z.number(),
		totalPages: z.number(),
	}),
});

const PermissionsPaginatedSchema = z.object({
	data: z.array(PermissionSchema),
	meta: z.object({
		page: z.number(),
		pageSize: z.number(),
		total: z.number(),
		totalPages: z.number(),
	}),
});

const UpdateRolePermissionsInputSchema = z.object({
	permissionIds: z.array(z.string().uuid()),
});

// Error schemas
const ValidationErrorSchema = z.object({
	error: z.object({
		code: z.literal('VALIDATION_ERROR'),
		message: z.string(),
		details: z.array(z.unknown()).optional(),
	}),
});

const NotFoundErrorSchema = z.object({
	error: z.object({
		code: z.literal('NOT_FOUND'),
		message: z.string(),
	}),
});

const ConflictErrorSchema = z.object({
	error: z.object({
		code: z.literal('CONFLICT'),
		message: z.string(),
	}),
});

const ForbiddenErrorSchema = z.object({
	error: z.object({
		code: z.literal('FORBIDDEN'),
		message: z.string(),
	}),
});

// Registrar componentes
registry.register('Role', RoleSchema);
registry.register('RoleDetail', RoleDetailSchema);
registry.register('CreateRoleInput', CreateRoleInputSchema);
registry.register('UpdateRoleInput', UpdateRoleInputSchema);
registry.register('RolesPaginated', RolesPaginatedSchema);
registry.register('Permission', PermissionSchema);
registry.register('PermissionsPaginated', PermissionsPaginatedSchema);
registry.register('UpdateRolePermissionsInput', UpdateRolePermissionsInputSchema);
registry.register('ValidationError', ValidationErrorSchema);
registry.register('NotFoundError', NotFoundErrorSchema);
registry.register('ConflictError', ConflictErrorSchema);
registry.register('ForbiddenError', ForbiddenErrorSchema);

// Descripciones de endpoints
const rolesListDescription = `Listar todos los roles de una organización con paginación.

**Parámetros de query:**
- \`page\` (número, default: 1) — página a mostrar
- \`pageSize\` (número, default: 20, máx: 100) — roles por página

**Requiere permiso:** \`roles.read\``;

const rolesCreateDescription = `Crear un nuevo rol en una organización.

**Requiere permiso:** \`roles.manage\`

**Errores posibles:**
- \`422\` — Validación fallida (nombre vacío, permissionIds inválidos)
- \`409\` — Nombre de rol duplicado en la organización`;

const roleDetailDescription = `Obtener detalles completos de un rol incluyendo sus permisos.

**Requiere permiso:** \`roles.read\`

**Errores posibles:**
- \`404\` — Rol no encontrado`;

const roleUpdateDescription = `Actualizar nombre, descripción y/o permisos de un rol.

**Requiere permiso:** \`roles.manage\`

**Errores posibles:**
- \`404\` — Rol no encontrado
- \`422\` — Validación fallida
- \`409\` — Nombre de rol duplicado`;

const roleDeleteDescription = `Eliminar (soft delete) un rol. Los permisos asociados se removerán automáticamente.

**Requiere permiso:** \`roles.manage\`

**Errores posibles:**
- \`404\` — Rol no encontrado`;

const rolePermissionsListDescription = `Listar permisos asignados a un rol específico.

**Requiere permiso:** \`roles.read\`

**Errores posibles:**
- \`404\` — Rol no encontrado`;

const rolePermissionsUpdateDescription = `Reemplazar completamente el conjunto de permisos asignados a un rol.

**Requiere permiso:** \`roles.manage\`

**Errores posibles:**
- \`404\` — Rol no encontrado
- \`422\` — permissionIds inválidos`;

const permissionsListDescription = `Listar todos los permisos disponibles en el sistema con paginación.

**Parámetros de query:**
- \`page\` (número, default: 1)
- \`pageSize\` (número, default: 20, máx: 100)

**Requiere permiso:** \`permisos.read\``;

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
	404: {
		description: 'No encontrado',
		content: {
			'application/json': {
				schema: NotFoundErrorSchema,
			},
		},
	},
	409: {
		description: 'Conflicto (duplicado)',
		content: {
			'application/json': {
				schema: ConflictErrorSchema,
			},
		},
	},
	422: {
		description: 'Validación fallida',
		content: {
			'application/json': {
				schema: ValidationErrorSchema,
			},
		},
	},
};

// Registrar endpoints
registry.registerPath({
	method: 'get',
	path: '/roles',
	tags: ['Roles'],
	security: [{ cookieAuth: [] }],
	description: rolesListDescription,
	parameters: [
		{
			name: 'organizationId',
			in: 'query',
			required: true,
			schema: { type: 'string', format: 'uuid' },
		},
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
			description: 'Lista de roles',
			content: {
				'application/json': {
					schema: RolesPaginatedSchema,
				},
			},
		},
		...errorResponses,
	},
});

registry.registerPath({
	method: 'post',
	path: '/roles',
	tags: ['Roles'],
	security: [{ cookieAuth: [] }],
	description: rolesCreateDescription,
	parameters: [
		{
			name: 'organizationId',
			in: 'query',
			required: true,
			schema: { type: 'string', format: 'uuid' },
		},
	],
	requestBody: {
		required: true,
		content: {
			'application/json': {
				schema: CreateRoleInputSchema,
				example: {
					name: 'Administrador de Sede',
					description: 'Gestiona las sedes y reservas de la organización',
					permissionIds: [
						'123e4567-e89b-12d3-a456-426614174001',
						'123e4567-e89b-12d3-a456-426614174002',
					],
				},
			},
		},
	},
	responses: {
		201: {
			description: 'Rol creado',
			content: {
				'application/json': {
					schema: z.object({ data: RoleDetailSchema }),
				},
			},
		},
		...errorResponses,
	},
});

registry.registerPath({
	method: 'get',
	path: '/roles/{roleId}',
	tags: ['Roles'],
	security: [{ cookieAuth: [] }],
	description: roleDetailDescription,
	parameters: [
		{
			name: 'roleId',
			in: 'path',
			required: true,
			schema: { type: 'string', format: 'uuid' },
		},
		{
			name: 'organizationId',
			in: 'query',
			required: true,
			schema: { type: 'string', format: 'uuid' },
		},
	],
	responses: {
		200: {
			description: 'Detalles del rol',
			content: {
				'application/json': {
					schema: z.object({ data: RoleDetailSchema }),
				},
			},
		},
		...errorResponses,
	},
});

registry.registerPath({
	method: 'patch',
	path: '/roles/{roleId}',
	tags: ['Roles'],
	security: [{ cookieAuth: [] }],
	description: roleUpdateDescription,
	parameters: [
		{
			name: 'roleId',
			in: 'path',
			required: true,
			schema: { type: 'string', format: 'uuid' },
		},
		{
			name: 'organizationId',
			in: 'query',
			required: true,
			schema: { type: 'string', format: 'uuid' },
		},
	],
	requestBody: {
		required: true,
		content: {
			'application/json': {
				schema: UpdateRoleInputSchema,
				example: {
					name: 'Administrador de Sede Actualizado',
					description: 'Descripción actualizada del rol',
					permissionIds: ['123e4567-e89b-12d3-a456-426614174001'],
				},
			},
		},
	},
	responses: {
		200: {
			description: 'Rol actualizado',
			content: {
				'application/json': {
					schema: z.object({ data: RoleDetailSchema }),
				},
			},
		},
		...errorResponses,
	},
});

registry.registerPath({
	method: 'delete',
	path: '/roles/{roleId}',
	tags: ['Roles'],
	security: [{ cookieAuth: [] }],
	description: roleDeleteDescription,
	parameters: [
		{
			name: 'roleId',
			in: 'path',
			required: true,
			schema: { type: 'string', format: 'uuid' },
		},
		{
			name: 'organizationId',
			in: 'query',
			required: true,
			schema: { type: 'string', format: 'uuid' },
		},
	],
	responses: {
		204: {
			description: 'Rol eliminado',
		},
		...errorResponses,
	},
});

registry.registerPath({
	method: 'get',
	path: '/roles/{roleId}/permisos',
	tags: ['Roles - Permisos'],
	security: [{ cookieAuth: [] }],
	description: rolePermissionsListDescription,
	parameters: [
		{
			name: 'roleId',
			in: 'path',
			required: true,
			schema: { type: 'string', format: 'uuid' },
		},
		{
			name: 'organizationId',
			in: 'query',
			required: true,
			schema: { type: 'string', format: 'uuid' },
		},
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
			description: 'Permisos del rol',
			content: {
				'application/json': {
					schema: PermissionsPaginatedSchema,
				},
			},
		},
		...errorResponses,
	},
});

registry.registerPath({
	method: 'patch',
	path: '/roles/{roleId}/permisos',
	tags: ['Roles - Permisos'],
	security: [{ cookieAuth: [] }],
	description: rolePermissionsUpdateDescription,
	parameters: [
		{
			name: 'roleId',
			in: 'path',
			required: true,
			schema: { type: 'string', format: 'uuid' },
		},
		{
			name: 'organizationId',
			in: 'query',
			required: true,
			schema: { type: 'string', format: 'uuid' },
		},
	],
	requestBody: {
		required: true,
		content: {
			'application/json': {
				schema: UpdateRolePermissionsInputSchema,
				example: {
					permissionIds: [
						'123e4567-e89b-12d3-a456-426614174001',
						'123e4567-e89b-12d3-a456-426614174002',
					],
				},
			},
		},
	},
	responses: {
		200: {
			description: 'Permisos actualizados',
			content: {
				'application/json': {
					schema: z.object({ data: RoleDetailSchema }),
				},
			},
		},
		...errorResponses,
	},
});

registry.registerPath({
	method: 'get',
	path: '/permisos',
	tags: ['Permisos'],
	security: [{ cookieAuth: [] }],
	description: permissionsListDescription,
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
			description: 'Lista de permisos',
			content: {
				'application/json': {
					schema: PermissionsPaginatedSchema,
				},
			},
		},
		...errorResponses,
	},
});
