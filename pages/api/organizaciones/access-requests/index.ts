import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';
import { z } from 'zod';

import { auth } from '@/middleware/auth';
import { access } from '@/middleware/access';
import { routerOptions } from '@/lib/api/router-config';
import { accessRequestDb } from '@/database/organizaciones-sedes';
import { throwValidationError } from '@/lib/errors/throw-validation-error';
import { VALIDATION_MESSAGES } from '@/validations/schemas';

const handler = createRouter<NextApiRequest, NextApiResponse>();

const accessRequestQuerySchema = z.object({
	page: z.coerce.number().int().min(1, VALIDATION_MESSAGES.MIN_VALUE(1)).optional(),
	pageSize: z.coerce
		.number()
		.int()
		.min(1, VALIDATION_MESSAGES.MIN_VALUE(1))
		.max(100, VALIDATION_MESSAGES.MAX_VALUE(100))
		.optional(),
	status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
});

handler.use(auth).get(access('organizaciones.manage'), async (req, res): Promise<void> => {
	const parsed = accessRequestQuerySchema.safeParse(req.query);
	throwValidationError(parsed);

	const { requests, meta } = await accessRequestDb.getAccessRequests(
		parsed.data.status ?? 'PENDING',
		parsed.data.page ?? 1,
		parsed.data.pageSize ?? 20,
	);

	res.status(200).json({ data: requests, meta });
});

export default handler.handler(routerOptions);
