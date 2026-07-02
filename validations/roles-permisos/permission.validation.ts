import { z } from 'zod';

export const permissionIdArraySchema = z.array(
	z.string().uuid('permissionId debe ser UUID válido'),
);

export const updateRolePermissionsSchema = z.object({
	permissionIds: permissionIdArraySchema,
});

export type UpdateRolePermissionsInput = z.infer<typeof updateRolePermissionsSchema>;
