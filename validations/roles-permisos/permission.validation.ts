import { z } from 'zod';

import { permissionIdsSchema } from './role.validation';

export const updateRolePermissionsSchema = z
	.object({
		permissionIds: permissionIdsSchema,
		expectedUpdatedAt: z.string().datetime({ offset: true }),
	})
	.strict();

export const permissionListQuerySchema = z
	.object({
		page: z.coerce.number().int().min(1).default(1),
		pageSize: z.coerce.number().int().min(1).max(100).default(20),
		search: z.string().trim().max(200).optional(),
		module: z.string().trim().min(1).max(100).optional(),
	})
	.strict();

export type UpdateRolePermissionsInput = z.infer<typeof updateRolePermissionsSchema>;
