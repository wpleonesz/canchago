import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

import { AuthenticationError, ValidationError } from '@/errors/auth';
import { env } from '@/lib/config/env';
import { exchangeCode, verifyIdToken } from '@/lib/oauth';
import {
	clearTemporaryOAuthCookie,
	setSessionCookie,
	decryptTemporaryOAuthCookie,
	type SessionPayload,
} from '@/lib/session';
import { findOrSyncByOAuth } from '@/database/users';

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
		throw new ValidationError('Missing authorization code or state');
	}

	if (!temporaryCookie) {
		throw new AuthenticationError('Missing OAuth state cookie');
	}

	const oauthState = await decryptTemporaryOAuthCookie(temporaryCookie);

	if (oauthState.state !== state) {
		throw new ValidationError('Invalid OAuth state');
	}

	const tokens = await exchangeCode(code, oauthState.codeVerifier);

	if (!tokens.idToken) {
		throw new ValidationError('Missing ID token from provider');
	}

	const claims = (await verifyIdToken(tokens.idToken, {
		issuer: env.OAUTH_ISSUER,
		audience: env.OAUTH_CLIENT_ID,
		nonce: oauthState.nonce,
	})) as OAuthClaims;

	if (!claims.sub || !claims.email || !claims.name) {
		throw new ValidationError('Incomplete identity claims from provider');
	}

	const syncedUser = await findOrSyncByOAuth(claims.sub, claims.email, claims.name);

	const sessionPayload: SessionPayload = {
		user: syncedUser.user,
		tokens: {
			accessToken: tokens.accessToken,
			refreshToken: tokens.refreshToken,
			idToken: tokens.idToken,
			tokenType: tokens.tokenType,
			expiresAt: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
			nonce: oauthState.nonce,
		},
		createdAt: new Date().toISOString(),
	};

	await setSessionCookie(res, sessionPayload);
	clearTemporaryOAuthCookie(res);

	res.redirect(302, env.OAUTH_SUCCESS_REDIRECT_URL);
});

export default router.handler({
	onError: (error, _req, res) => {
		const statusCode =
			error instanceof ValidationError || error instanceof AuthenticationError
				? error.statusCode
				: 500;
		const message = error instanceof Error ? error.message : 'Unable to complete login flow';

		res.status(statusCode).json({
			error: {
				code:
					statusCode === 401
						? 'UNAUTHORIZED'
						: statusCode === 400
							? 'VALIDATION_ERROR'
							: 'INTERNAL_SERVER_ERROR',
				message,
			},
		});
	},
	onNoMatch: (_req, res) => {
		res.status(405).end();
	},
});
