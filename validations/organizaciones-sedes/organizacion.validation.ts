import { z } from 'zod';

const ALLOWED_ORDER_BY = ['name', 'createdAt'] as const;
const ALLOWED_ORDER = ['asc', 'desc'] as const;

export const createOrganizationSchema = z.object({
	name: z.string().min(1, 'Organization name is required').max(150),
	legalName: z.string().max(200).optional(),
	taxIdentification: z.string().max(30).optional(),
	email: z.string().email('Invalid email format').optional().or(z.literal('')),
	phone: z.string().max(20).optional().or(z.literal('')),
	domain: z.string().max(255).optional().or(z.literal('')),
});

export const updateOrganizationSchema = createOrganizationSchema.partial();

export const organizationQuerySchema = z.object({
	page: z.coerce.number().int().min(1).optional(),
	pageSize: z.coerce.number().int().min(1).max(100).optional(),
	search: z.string().max(255).optional(),
	orderBy: z.enum(ALLOWED_ORDER_BY).optional(),
	order: z.enum(ALLOWED_ORDER).optional(),
});

export const organizationParamsSchema = z.object({
	organizationId: z.string().uuid('Invalid organization ID'),
});

export type CreateOrganizationBody = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationBody = z.infer<typeof updateOrganizationSchema>;
export type OrganizationQueryParams = z.infer<typeof organizationQuerySchema>;
export type OrganizationParams = z.infer<typeof organizationParamsSchema>;
