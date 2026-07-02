import { z } from 'zod';

const ALLOWED_ORDER_BY = ['name', 'createdAt'] as const;
const ALLOWED_ORDER = ['asc', 'desc'] as const;

export const createSedeSchema = z.object({
	name: z.string().min(1, 'Sede name is required').max(150),
	address: z.string().max(500).optional().or(z.literal('')),
	phone: z.string().max(20).optional().or(z.literal('')),
	email: z.string().email('Invalid email format').optional().or(z.literal('')),
});

export const updateSedeSchema = createSedeSchema.partial();

export const sedeQuerySchema = z.object({
	page: z.coerce.number().int().min(1).optional(),
	pageSize: z.coerce.number().int().min(1).max(100).optional(),
	search: z.string().max(255).optional(),
	orderBy: z.enum(ALLOWED_ORDER_BY).optional(),
	order: z.enum(ALLOWED_ORDER).optional(),
});

export const sedeParamsSchema = z.object({
	organizationId: z.string().uuid('Invalid organization ID'),
	sedeId: z.string().uuid('Invalid sede ID'),
});

export const sedeCollectionParamsSchema = z.object({
	organizationId: z.string().uuid('Invalid organization ID'),
});

export type CreateSedeBody = z.infer<typeof createSedeSchema>;
export type UpdateSedeBody = z.infer<typeof updateSedeSchema>;
export type SedeQueryParams = z.infer<typeof sedeQuerySchema>;
export type SedeParams = z.infer<typeof sedeParamsSchema>;
export type SedeCollectionParams = z.infer<typeof sedeCollectionParamsSchema>;
