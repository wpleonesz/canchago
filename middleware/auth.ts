import type { NextApiRequest, NextApiResponse } from 'next';
import type { NextHandler } from 'next-connect';

import { AuthenticationError } from '@/errors/auth';
import { env } from '@/lib/config/env';
import { decrypt } from '@/lib/session';

export const auth = async (
	req: NextApiRequest,
	_res: NextApiResponse,
	next: NextHandler,
): Promise<void> => {
	if (env.NODE_ENV !== 'production' && env.BYPASS_AUTH) {
		const session = {
			user: {
				id: 'dev-user',
				email: 'dev@canchago.local',
				name: 'Development User',
				roles: [],
				permissions: [],
			},
			tokens: {
				accessToken: 'dev-access-token',
				expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
			},
			createdAt: new Date().toISOString(),
		};

		req.session = session;
		req.user = session.user;

		await next();
		return;
	}

	const cookieValue = req.cookies[env.SESSION_COOKIE_NAME];

	if (!cookieValue) {
		throw new AuthenticationError('Missing session cookie');
	}

	const session = await decrypt(cookieValue);

	req.session = session;
	req.user = session.user;

	await next();
};
