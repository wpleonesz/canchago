import { z } from 'zod';

export const menuListQuerySchema = z
	.object({
		page: z.coerce.number().int().min(1).default(1),
		pageSize: z.coerce.number().int().min(1).max(100).default(20),
	})
	.strict();

export type MenuListQuery = z.infer<typeof menuListQuerySchema>;
