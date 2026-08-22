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

handler.use(auth).post(access('organizaciones.manage'), async (req, res): Promise<void> => {
	const parsed = paramsSchema.safeParse(req.query);
	throwValidationError(parsed);

	if (!req.user) {
		throw new AuthenticationError();
	}

	const accessRequest = await accessRequestDb.approveAccessRequest(
		parsed.data.requestId,
		req.user.id,
	);

	res.status(200).json({
		data: { organizationId: accessRequest.organization.id, status: accessRequest.status },
	});
});

export default handler.handler(routerOptions);
