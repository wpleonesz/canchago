import { z } from 'zod';

export const createRoleInputSchema = z.object({
	organizationId: z.string().uuid('organizationId debe ser UUID válido'),
	name: z.string().min(1, 'nombre es requerido').max(150),
	description: z.string().max(500).optional(),
	permissionIds: z.array(z.string().uuid()).optional().default([]),
});

export const updateRoleInputSchema = z.object({
	name: z.string().min(1, 'nombre es requerido').max(150).optional(),
	description: z.string().max(500).nullable().optional(),
	permissionIds: z.array(z.string().uuid()).optional(),
});

export const paginationSchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateRoleInput = z.infer<typeof createRoleInputSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleInputSchema>;
export type Pagination = z.infer<typeof paginationSchema>;
