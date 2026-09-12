import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

import { routerOptions } from '@/lib/api/router-config';
import { throwValidationError } from '@/lib/errors/throw-validation-error';
import { access } from '@/middleware/access';
import { auth } from '@/middleware/auth';
import { aiRateLimit } from '@/middleware/rate-limit';
import { recommendSlots } from '@/services/ai';
import { slotRecommendationsSchema } from '@/validations/ai';

const handler = createRouter<NextApiRequest, NextApiResponse>();
handler
	.use(auth)
	.use(access('resources.read', 'availability.read'))
	.use(aiRateLimit)
	.post(async (req, res): Promise<void> => {
		const body = slotRecommendationsSchema.safeParse(req.body);
		throwValidationError(body);
		res.status(200).json({ data: await recommendSlots(body.data) });
	});

export default handler.handler(routerOptions);
