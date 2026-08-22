import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

import { AuthenticationError } from '@/errors/auth';
import { routerOptions } from '@/lib/api/router-config';
import { throwValidationError } from '@/lib/errors/throw-validation-error';
import { access } from '@/middleware/access';
import { auth } from '@/middleware/auth';
import { userService } from '@/services/users';
import { updateAdminUserProfileSchema, userParamsSchema } from '@/validations/users';

const handler = createRouter<NextApiRequest, NextApiResponse>();

handler
	.use(auth)
	.get(access('users.read'), async (req, res): Promise<void> => {
		const parsed = userParamsSchema.safeParse(req.query);
		throwValidationError(parsed);

		const profile = await userService.getAdminProfile(parsed.data.userId);

		res.status(200).json({ data: profile });
	})
	.patch(access('users.update'), async (req, res): Promise<void> => {
		const parsedParams = userParamsSchema.safeParse(req.query);
		const parsedBody = updateAdminUserProfileSchema.safeParse(req.body);

		throwValidationError(parsedParams);
		throwValidationError(parsedBody);

		if (!req.user) {
			throw new AuthenticationError();
		}

		const profile = await userService.updateAdminProfile(
			parsedParams.data.userId,
			parsedBody.data,
			req.user,
		);

		res.status(200).json({ data: profile });
	});

export default handler.handler(routerOptions);
