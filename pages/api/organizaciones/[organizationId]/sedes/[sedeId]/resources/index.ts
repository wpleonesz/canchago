import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';
import { AuthenticationError } from '@/errors';
import { auth } from '@/middleware/auth';
import { access } from '@/middleware/access';
import { routerOptions } from '@/lib/api/router-config';
import * as service from '@/services/reservas';
import { createResourceSchema, resourceCollectionParamsSchema } from '@/validations/reservas';
import { throwValidationError } from '@/lib/errors/throw-validation-error';

const handler = createRouter<NextApiRequest, NextApiResponse>();
handler.use(auth).post(access('resources.manage'), async (req, res): Promise<void> => {
	if (!req.user) throw new AuthenticationError();
	const params = resourceCollectionParamsSchema.safeParse(req.query);
	const body = createResourceSchema.safeParse(req.body);
	throwValidationError(params);
	throwValidationError(body);
	res.status(201).json({
		data: await service.createResource(
			params.data.organizationId,
			params.data.sedeId,
			body.data,
			req.user,
		),
	});
});
export default handler.handler(routerOptions);
