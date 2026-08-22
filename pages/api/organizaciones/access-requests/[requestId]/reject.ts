import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';
import { z } from 'zod';

import { auth } from '@/middleware/auth';
import { access } from '@/middleware/access';
import { routerOptions } from '@/lib/api/router-config';
import { accessRequestDb } from '@/database/organizaciones-sedes';
import { AuthenticationError } from '@/errors/auth';
import { throwValidationError } from '@/lib/errors/throw-validation-error';
import { VALIDATION_MESSAGES } from '@/validations/schemas';

const handler = createRouter<NextApiRequest, NextApiResponse>();

const paramsSchema = z.object({
	requestId: z.string().uuid(VALIDATION_MESSAGES.UUID),
});

const bodySchema = z.object({
	reason: z.string().max(500, VALIDATION_MESSAGES.MAX_LENGTH(500)).optional(),
});

handler.use(auth).post(access('organizaciones.manage'), async (req, res): Promise<void> => {
	const parsedParams = paramsSchema.safeParse(req.query);
	const parsedBody = bodySchema.safeParse(req.body ?? {});

	throwValidationError(parsedParams);
	throwValidationError(parsedBody);

	if (!req.user) {
		throw new AuthenticationError();
	}

	const accessRequest = await accessRequestDb.rejectAccessRequest(
		parsedParams.data.requestId,
		req.user.id,
		parsedBody.data.reason,
	);

	res.status(200).json({ data: { requestId: accessRequest.id, status: accessRequest.status } });
});

export default handler.handler(routerOptions);
