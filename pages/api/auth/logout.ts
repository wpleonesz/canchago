import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

import { auth } from '@/middleware/auth';
import { routerOptions } from '@/lib/api/router-config';
import { revokeToken } from '@/lib/oauth';
import { clearSessionCookie } from '@/lib/session';
import { sessionService } from '@/services/auth/session.service';

const router = createRouter<NextApiRequest, NextApiResponse>();

router.use(auth).post(async (req, res) => {
	const tokenToRevoke = req.session?.tokens.refreshToken ?? req.session?.tokens.accessToken;

	if (tokenToRevoke) {
		await revokeToken(tokenToRevoke);
	}

	// Invalida la sesión en el servidor. Sin esto, quien hubiera copiado el valor de la
	// cookie la seguía usando durante horas: borrarla del navegador no la anulaba.
	if (req.session) {
		await sessionService.revoke(req.session.sessionId);
	}

	clearSessionCookie(res);
	res.status(204).end();
});

export default router.handler(routerOptions);
