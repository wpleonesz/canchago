import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

import { authMiddleware } from '@/middleware/auth';
import { revokeToken } from '@/lib/oauth';
import { clearSessionCookie } from '@/lib/session';

const router = createRouter<NextApiRequest, NextApiResponse>();

router.use(authMiddleware).post(async (req, res) => {
	const tokenToRevoke = req.session?.tokens.refreshToken ?? req.session?.tokens.accessToken;

	if (tokenToRevoke) {
		await revokeToken(tokenToRevoke);
	}

	clearSessionCookie(res);
	res.status(204).end();
});

export default router.handler({
	onError: (error, _req, res) => {
		const message = error instanceof Error ? error.message : 'Unable to logout';

		res.status(401).json({
			error: {
				code: 'UNAUTHORIZED',
				message,
			},
		});
	},
	onNoMatch: (_req, res) => {
		res.status(405).end();
	},
});
