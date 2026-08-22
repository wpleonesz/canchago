import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

import { AuthenticationError } from '@/errors/auth';
import { routerOptions } from '@/lib/api/router-config';
import { throwValidationError } from '@/lib/errors/throw-validation-error';
import { auth } from '@/middleware/auth';
import { userService } from '@/services/users';
import { updateOwnProfileSchema } from '@/validations/users';

const handler = createRouter<NextApiRequest, NextApiResponse>();

handler
	.use(auth)
	.get(async (req, res): Promise<void> => {
		if (!req.user) throw new AuthenticationError();

		const profile = await userService.getOwnProfile(req.user.id);
		res.status(200).json({ data: profile });
	})
	.patch(async (req, res): Promise<void> => {
		if (!req.user) throw new AuthenticationError();

		const parsed = updateOwnProfileSchema.safeParse(req.body);
		throwValidationError(parsed);

		const profile = await userService.updateOwnProfile(req.user.id, parsed.data);
		res.status(200).json({ data: profile });
	});

export default handler.handler(routerOptions);
