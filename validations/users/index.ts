import { z } from 'zod';
import { VALIDATION_MESSAGES } from '../schemas';

const ALLOWED_ORDER_BY = ['name', 'email', 'createdAt'] as const;
const ALLOWED_ORDER = ['asc', 'desc'] as const;

export const createUserSchema = z.object({
	email: z.string().email(VALIDATION_MESSAGES.EMAIL),
	firstName: z
		.string()
		.min(1, VALIDATION_MESSAGES.REQUIRED)
		.max(100, VALIDATION_MESSAGES.MAX_LENGTH(100)),
	lastName: z
		.string()
		.min(1, VALIDATION_MESSAGES.REQUIRED)
		.max(100, VALIDATION_MESSAGES.MAX_LENGTH(100)),
	organizationId: z.string().uuid(VALIDATION_MESSAGES.UUID),
	roleIds: z.array(z.string().uuid(VALIDATION_MESSAGES.UUID)).optional(),
});

export const updateUserSchema = createUserSchema.partial();

export const userQuerySchema = z.object({
	page: z.coerce.number().int().min(1, VALIDATION_MESSAGES.MIN_VALUE(1)).optional(),
	pageSize: z.coerce
		.number()
		.int()
		.min(1, VALIDATION_MESSAGES.MIN_VALUE(1))
		.max(100, VALIDATION_MESSAGES.MAX_VALUE(100))
		.optional(),
	organizationId: z.string().uuid(VALIDATION_MESSAGES.UUID).optional(),
	active: z.coerce.boolean().optional(),
	search: z.string().max(255, VALIDATION_MESSAGES.MAX_LENGTH(255)).optional(),
	orderBy: z.enum(ALLOWED_ORDER_BY).optional(),
	order: z.enum(ALLOWED_ORDER).optional(),
});

export const userParamsSchema = z.object({
	userId: z.string().uuid(VALIDATION_MESSAGES.UUID),
});

export type CreateUserBody = z.infer<typeof createUserSchema>;
export type UpdateUserBody = z.infer<typeof updateUserSchema>;
export type UserQueryParams = z.infer<typeof userQuerySchema>;
export type UserParams = z.infer<typeof userParamsSchema>;
