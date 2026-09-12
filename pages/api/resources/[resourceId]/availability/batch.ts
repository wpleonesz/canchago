import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';
import { AuthenticationError } from '@/errors';
import { auth } from '@/middleware/auth';
import { access } from '@/middleware/access';
import { routerOptions } from '@/lib/api/router-config';
import { throwValidationError } from '@/lib/errors/throw-validation-error';
import * as service from '@/services/reservas';
import {
	createMonthlyScheduleSchema,
	resourceParamsSchema,
	updateScheduleDaySchema,
} from '@/validations/reservas';

const handler = createRouter<NextApiRequest, NextApiResponse>();
handler.use(auth).post(access('availability.manage'), async (req, res): Promise<void> => {
	if (!req.user) throw new AuthenticationError();
	const params = resourceParamsSchema.safeParse(req.query);
	const body = createMonthlyScheduleSchema.safeParse(req.body);
	throwValidationError(params);
	throwValidationError(body);
	const result = await service.createMonthlySchedule(params.data.resourceId, body.data, req.user);
	res.status(201).json({ data: { created: result.count } });
});
handler.patch(access('availability.manage'), async (req, res): Promise<void> => {
	if (!req.user) throw new AuthenticationError();
	const params = resourceParamsSchema.safeParse(req.query);
	const body = updateScheduleDaySchema.safeParse(req.body);
	throwValidationError(params);
	throwValidationError(body);
	const updated = await service.updateScheduleDay(params.data.resourceId, body.data, req.user);
	res.status(200).json({ data: { updated } });
});
export default handler.handler(routerOptions);
