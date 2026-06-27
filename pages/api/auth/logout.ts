import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

import { auth } from '@/middleware/auth';
import { routerOptions } from '@/pages/api/_router';
import { revokeToken } from '@/lib/oauth';
import { clearSessionCookie } from '@/lib/session';

const router = createRouter<NextApiRequest, NextApiResponse>();

router.use(auth).post(async (req, res) => {
	const tokenToRevoke = req.session?.tokens.refreshToken ?? req.session?.tokens.accessToken;

	if (tokenToRevoke) {
		await revokeToken(tokenToRevoke);
	}

	clearSessionCookie(res);
	res.status(204).end();
});

export default router.handler(routerOptions);
