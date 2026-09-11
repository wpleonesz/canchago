import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';
import { AuthenticationError } from '@/errors';
import { auth } from '@/middleware/auth';
import { access } from '@/middleware/access';
import { routerOptions } from '@/lib/api/router-config';
import * as service from '@/services/reservas';
import { createBookingSchema, paginationSchema } from '@/validations/reservas';
import { throwValidationError } from '@/lib/errors/throw-validation-error';

const handler = createRouter<NextApiRequest, NextApiResponse>();
handler
	.use(auth)
	.get(access('bookings.read.own'), async (req, res): Promise<void> => {
		if (!req.user) throw new AuthenticationError();
		const query = paginationSchema.safeParse(req.query);
		throwValidationError(query);
		res
			.status(200)
			.json(await service.listOwnBookings(req.user.id, query.data.page, query.data.pageSize));
	})
	.post(access('bookings.create'), async (req, res): Promise<void> => {
		if (!req.user) throw new AuthenticationError();
		const body = createBookingSchema.safeParse(req.body);
		throwValidationError(body);
		const result = await service.createBooking(body.data, req.user);
		res.status(result.repeated ? 200 : 201).json({ data: result.booking });
	});
export default handler.handler(routerOptions);
