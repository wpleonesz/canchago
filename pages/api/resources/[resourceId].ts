import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';
import { AuthenticationError } from '@/errors';
import { auth } from '@/middleware/auth';
import { access } from '@/middleware/access';
import { routerOptions } from '@/lib/api/router-config';
import * as service from '@/services/reservas';
import { resourceParamsSchema, updateResourceSchema } from '@/validations/reservas';
import { throwValidationError } from '@/lib/errors/throw-validation-error';

const handler = createRouter<NextApiRequest, NextApiResponse>();
handler.use(auth).get(access('resources.read'), async (req, res): Promise<void> => {
	const parsed = resourceParamsSchema.safeParse(req.query);
	throwValidationError(parsed);
	res.status(200).json({ data: await service.getResource(parsed.data.resourceId) });
});
handler.patch(access('resources.manage'), async (req, res): Promise<void> => {
	if (!req.user) throw new AuthenticationError();
	const params = resourceParamsSchema.safeParse(req.query);
	const body = updateResourceSchema.safeParse(req.body);
	throwValidationError(params);
	throwValidationError(body);
	res.status(200).json({
		data: await service.updateResource(params.data.resourceId, body.data, req.user),
	});
});
export default handler.handler(routerOptions);
