import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';
import { AuthenticationError } from '@/errors';
import { auth } from '@/middleware/auth';
import { access } from '@/middleware/access';
import { routerOptions } from '@/lib/api/router-config';
import { throwValidationError } from '@/lib/errors/throw-validation-error';
import * as service from '@/services/reservas';
import { slotParamsSchema, updateSlotSchema } from '@/validations/reservas';

const handler = createRouter<NextApiRequest, NextApiResponse>();
handler.use(auth).patch(access('availability.manage'), async (req, res): Promise<void> => {
	if (!req.user) throw new AuthenticationError();
	const params = slotParamsSchema.safeParse(req.query);
	const body = updateSlotSchema.safeParse(req.body);
	throwValidationError(params);
	throwValidationError(body);
	res.status(200).json({
		data: await service.updateSlot(params.data.resourceId, params.data.slotId, body.data, req.user),
	});
});
export default handler.handler(routerOptions);
