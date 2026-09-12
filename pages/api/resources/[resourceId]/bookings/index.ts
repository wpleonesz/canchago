import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';
import { AuthenticationError } from '@/errors';
import { auth } from '@/middleware/auth';
import { access } from '@/middleware/access';
import { routerOptions } from '@/lib/api/router-config';
import { throwValidationError } from '@/lib/errors/throw-validation-error';
import * as service from '@/services/reservas';
import { managedBookingsQuerySchema, resourceParamsSchema } from '@/validations/reservas';

const handler = createRouter<NextApiRequest, NextApiResponse>();
handler.use(auth).get(access('bookings.read.manage'), async (req, res): Promise<void> => {
	if (!req.user) throw new AuthenticationError();
	const params = resourceParamsSchema.safeParse(req.query);
	const query = managedBookingsQuerySchema.safeParse(req.query);
	throwValidationError(params);
	throwValidationError(query);
	res
		.status(200)
		.json(await service.listManagedBookings(params.data.resourceId, query.data, req.user));
});
export default handler.handler(routerOptions);
