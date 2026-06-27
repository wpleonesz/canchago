import { z } from 'zod';

const ALLOWED_ORDER_BY = ['name', 'email', 'createdAt'] as const;
const ALLOWED_ORDER = ['asc', 'desc'] as const;

export const createUserSchema = z.object({
	email: z.string().email('Invalid email format'),
	firstName: z.string().min(1, 'First name is required').max(100),
	lastName: z.string().min(1, 'Last name is required').max(100),
	organizationId: z.string().uuid('Invalid organization ID'),
});

export const updateUserSchema = createUserSchema.partial();

export const userQuerySchema = z.object({
	page: z.coerce.number().int().min(1).optional(),
	pageSize: z.coerce.number().int().min(1).max(100).optional(),
	organizationId: z.string().uuid().optional(),
	active: z.coerce.boolean().optional(),
	search: z.string().max(255).optional(),
	orderBy: z.enum(ALLOWED_ORDER_BY).optional(),
	order: z.enum(ALLOWED_ORDER).optional(),
});

export const userParamsSchema = z.object({
	userId: z.string().uuid('Invalid user ID'),
});

export type CreateUserBody = z.infer<typeof createUserSchema>;
export type UpdateUserBody = z.infer<typeof updateUserSchema>;
export type UserQueryParams = z.infer<typeof userQuerySchema>;
export type UserParams = z.infer<typeof userParamsSchema>;
