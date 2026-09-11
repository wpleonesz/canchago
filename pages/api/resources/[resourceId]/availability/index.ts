import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';
import { AuthenticationError } from '@/errors';
import { auth } from '@/middleware/auth';
import { access } from '@/middleware/access';
import { routerOptions } from '@/lib/api/router-config';
import * as service from '@/services/reservas';
import {
	availabilityQuerySchema,
	createSlotSchema,
	resourceParamsSchema,
} from '@/validations/reservas';
import { throwValidationError } from '@/lib/errors/throw-validation-error';

const handler = createRouter<NextApiRequest, NextApiResponse>();
handler
	.use(auth)
	.get(access('availability.read'), async (req, res): Promise<void> => {
		if (!req.user) throw new AuthenticationError();
		const params = resourceParamsSchema.safeParse(req.query);
		const query = availabilityQuerySchema.safeParse(req.query);
		throwValidationError(params);
		throwValidationError(query);
		res
			.status(200)
			.json(await service.listAvailability(params.data.resourceId, query.data, req.user));
	})
	.post(access('availability.manage'), async (req, res): Promise<void> => {
		if (!req.user) throw new AuthenticationError();
		const params = resourceParamsSchema.safeParse(req.query);
		const body = createSlotSchema.safeParse(req.body);
		throwValidationError(params);
		throwValidationError(body);
		res
			.status(201)
			.json({ data: await service.createSlot(params.data.resourceId, body.data, req.user) });
	});
export default handler.handler(routerOptions);
