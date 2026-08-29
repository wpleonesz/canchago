import { z } from 'zod';

import { normalizeRoleName } from '@/helper/roles';

const roleNameSchema = z
	.string()
	.transform(normalizeRoleName)
	.pipe(
		z
			.string()
			.min(1, 'El nombre del rol es requerido.')
			.max(150, 'El nombre del rol no puede superar 150 caracteres.')
			.regex(
				/^[\p{L}\p{N}_ -]+$/u,
				'El nombre solo puede contener letras, números, espacios, guiones y guion bajo.',
			),
	);

const descriptionSchema = z.preprocess(value => {
	if (value === null) return null;
	if (typeof value !== 'string') return value;
	const normalized = value.trim();
	return normalized.length === 0 ? null : normalized;
}, z.string().max(500, 'La descripción no puede superar 500 caracteres.').nullable());

export const permissionIdsSchema = z
	.array(z.string().uuid('Cada permissionId debe ser un UUID válido.'))
	.max(500, 'No se pueden asignar más de 500 permisos.')
	.refine(values => new Set(values).size === values.length, {
		message: 'permissionIds no puede contener valores duplicados.',
	});

export const paginationSchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const roleListQuerySchema = paginationSchema
	.extend({
		organizationId: z.string().uuid('organizationId debe ser un UUID válido.'),
		search: z.string().trim().max(150).optional(),
		isSystem: z
			.enum(['true', 'false'])
			.transform(value => value === 'true')
			.optional(),
		orderBy: z.enum(['name', 'createdAt', 'updatedAt']).default('createdAt'),
		order: z.enum(['asc', 'desc']).default('desc'),
	})
	.strict();

export const roleParamsSchema = z
	.object({
		roleId: z.string().uuid('roleId debe ser un UUID válido.'),
		organizationId: z.string().uuid('organizationId debe ser un UUID válido.'),
	})
	.strict();

export const rolePermissionsQuerySchema = paginationSchema
	.extend({
		roleId: z.string().uuid('roleId debe ser un UUID válido.'),
		organizationId: z.string().uuid('organizationId debe ser un UUID válido.'),
	})
	.strict();

export const createRoleInputSchema = z
	.object({
		name: roleNameSchema,
		description: descriptionSchema.optional(),
		permissionIds: permissionIdsSchema.optional().default([]),
	})
	.strict();

export const updateRoleInputSchema = z
	.object({
		name: roleNameSchema.optional(),
		description: descriptionSchema.optional(),
		permissionIds: permissionIdsSchema.optional(),
		expectedUpdatedAt: z.string().datetime({ offset: true }),
	})
	.strict()
	.refine(
		value =>
			value.name !== undefined ||
			value.description !== undefined ||
			value.permissionIds !== undefined,
		{ message: 'Debes enviar al menos un campo editable.' },
	);

export type RoleListQuery = z.infer<typeof roleListQuerySchema>;
export type CreateRoleInput = z.infer<typeof createRoleInputSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleInputSchema>;
export type Pagination = z.infer<typeof paginationSchema>;
