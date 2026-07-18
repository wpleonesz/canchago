import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

import { AuthenticationError } from '@/errors';
import { routerOptions } from '@/lib/api/router-config';
import { env } from '@/lib/config/env';
import { exchangeCode, verifyIdToken } from '@/lib/oauth';
import {
	clearTemporaryOAuthCookie,
	setSessionCookie,
	decryptTemporaryOAuthCookie,
	type SessionCookiePayload,
} from '@/lib/session';
import { findOrSyncByOAuth } from '@/database/users';
import { sessionService } from '@/services/auth/session.service';

type OAuthClaims = {
	sub?: string;
	email?: string;
	name?: string;
};

const router = createRouter<NextApiRequest, NextApiResponse>();

router.get(async (req, res) => {
	const code = typeof req.query.code === 'string' ? req.query.code : null;
	const state = typeof req.query.state === 'string' ? req.query.state : null;
	const temporaryCookie = req.cookies[env.SESSION_TEMP_COOKIE_NAME];

	if (!code || !state) {
		throw new AuthenticationError('Faltan datos para completar el inicio de sesión.');
	}

	if (!temporaryCookie) {
		throw new AuthenticationError('La sesión de inicio de sesión expiró. Intenta de nuevo.');
	}

	const oauthState = await decryptTemporaryOAuthCookie(temporaryCookie);

	if (oauthState.state !== state) {
		throw new AuthenticationError(
			'La solicitud de inicio de sesión no es válida. Intenta de nuevo.',
		);
	}

	const tokens = await exchangeCode(code, oauthState.codeVerifier);

	if (!tokens.idToken) {
		throw new AuthenticationError(
			'El proveedor de autenticación no devolvió la información necesaria.',
		);
	}

	const claims = (await verifyIdToken(tokens.idToken, {
		issuer: env.OAUTH_ISSUER,
		audience: env.OAUTH_CLIENT_ID,
		nonce: oauthState.nonce,
	})) as OAuthClaims;

	if (!claims.sub || !claims.email || !claims.name) {
		throw new AuthenticationError(
			'El proveedor de autenticación no devolvió los datos de identidad completos.',
		);
	}

	const syncedUser = await findOrSyncByOAuth(claims.sub, claims.email, claims.name);

	// Los tokens se guardan en `user_sessions`, no en la cookie: los tres juntos
	// superan los 4096 bytes que admite un navegador.
	const sessionId = await sessionService.create(syncedUser.user.id, {
		accessToken: tokens.accessToken,
		refreshToken: tokens.refreshToken,
		idToken: tokens.idToken,
		tokenType: tokens.tokenType,
		expiresAt: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
		nonce: oauthState.nonce,
	});

	const cookiePayload: SessionCookiePayload = {
		sessionId,
		createdAt: new Date().toISOString(),
	};

	await setSessionCookie(res, cookiePayload);
	clearTemporaryOAuthCookie(res);

	res.redirect(302, env.OAUTH_SUCCESS_REDIRECT_URL);
});

export default router.handler(routerOptions);
