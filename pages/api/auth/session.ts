import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

import { auth } from '@/middleware/auth';
import { routerOptions } from '@/lib/api/router-config';

const router = createRouter<NextApiRequest, NextApiResponse>();

router.use(auth).get((req, res) => {
	res.status(200).json({
		data: req.user,
	});
});

export default router.handler(routerOptions);
