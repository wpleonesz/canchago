import { z } from 'zod';

export const ErrorResponseSchema = z.object({
	error: z.object({
		code: z.string(),
		message: z.string(),
		details: z.array(z.unknown()).optional(),
	}),
});

export const PaginationMetaSchema = z.object({
	page: z.number().int(),
	pageSize: z.number().int(),
	total: z.number().int(),
	totalPages: z.number().int(),
});
