import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

import { AuthenticationError } from '@/errors';
import { routerOptions } from '@/lib/api/router-config';
import { throwValidationError } from '@/lib/errors/throw-validation-error';
import { access } from '@/middleware/access';
import { auth } from '@/middleware/auth';
import { aiRateLimit } from '@/middleware/rate-limit';
import { summarizeUpcomingBookings } from '@/services/ai';
import { upcomingBookingsSummarySchema } from '@/validations/ai';

const handler = createRouter<NextApiRequest, NextApiResponse>();
handler
	.use(auth)
	.use(access('bookings.read.own'))
	.use(aiRateLimit)
	.post(async (req, res): Promise<void> => {
		if (!req.user) throw new AuthenticationError();
		const body = upcomingBookingsSummarySchema.safeParse(req.body);
		throwValidationError(body);
		res.status(200).json({ data: await summarizeUpcomingBookings(req.user.id, body.data) });
	});

export default handler.handler(routerOptions);
