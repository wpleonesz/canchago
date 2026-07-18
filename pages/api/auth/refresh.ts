import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

import { AuthenticationError } from '@/errors';
import { auth } from '@/middleware/auth';
import { routerOptions } from '@/lib/api/router-config';
import { refreshAccessToken } from '@/lib/oauth';
import { sessionService } from '@/services/auth/session.service';

const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

const router = createRouter<NextApiRequest, NextApiResponse>();

router.use(auth).post(async (req, res) => {
	if (!req.session) {
		throw new AuthenticationError('No hay una sesión activa.');
	}

	const refreshToken = req.session.tokens.refreshToken;

	if (!refreshToken) {
		throw new AuthenticationError('La sesión no permite renovarse. Inicia sesión de nuevo.');
	}

	const expiresAt = new Date(req.session.tokens.expiresAt).getTime();
	const shouldRefresh = Number.isNaN(expiresAt) || expiresAt - Date.now() <= REFRESH_THRESHOLD_MS;

	if (!shouldRefresh) {
		res.status(204).end();
		return;
	}

	const refreshedTokens = await refreshAccessToken(refreshToken);

	// Los tokens rotan en la base, no en la cookie: la cookie sólo lleva el id de sesión,
	// que no cambia. Por eso aquí ya no hay que reemitir ninguna cookie.
	await sessionService.rotateTokens(req.session.sessionId, {
		...req.session.tokens,
		accessToken: refreshedTokens.accessToken,
		refreshToken: refreshedTokens.refreshToken ?? refreshToken,
		idToken: refreshedTokens.idToken ?? req.session.tokens.idToken,
		tokenType: refreshedTokens.tokenType ?? req.session.tokens.tokenType,
		expiresAt: new Date(Date.now() + refreshedTokens.expiresIn * 1000).toISOString(),
	});

	res.status(204).end();
});

export default router.handler(routerOptions);
