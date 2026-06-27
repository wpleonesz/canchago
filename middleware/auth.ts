import type { NextApiRequest, NextApiResponse } from 'next';
import type { NextHandler } from 'next-connect';

import { AuthenticationError } from '@/errors/auth';
import { env } from '@/lib/config/env';
import { decrypt } from '@/lib/session';

export const authMiddleware = async (
	req: NextApiRequest,
	_res: NextApiResponse,
	next: NextHandler,
): Promise<void> => {
	const cookieValue = req.cookies[env.SESSION_COOKIE_NAME];

	if (!cookieValue) {
		throw new AuthenticationError('Missing session cookie');
	}

	const session = await decrypt(cookieValue);

	req.session = session;
	req.user = session.user;

	await next();
};
