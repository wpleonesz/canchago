import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

import { authMiddleware } from '@/middleware/auth';

const router = createRouter<NextApiRequest, NextApiResponse>();

router.use(authMiddleware).get((req, res) => {
	res.status(200).json({
		data: req.user,
	});
});

export default router.handler({
	onError: (error, _req, res) => {
		const message = error instanceof Error ? error.message : 'Unauthorized';

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
