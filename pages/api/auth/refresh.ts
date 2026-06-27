import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

import { AuthenticationError, ValidationError } from '@/errors/auth';
import { authMiddleware } from '@/middleware/auth';
import { refreshAccessToken } from '@/lib/oauth';
import { setSessionCookie, type SessionPayload } from '@/lib/session';

const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

const router = createRouter<NextApiRequest, NextApiResponse>();

router.use(authMiddleware).post(async (req, res) => {
	if (!req.session) {
		throw new AuthenticationError('Missing session data');
	}

	const refreshToken = req.session.tokens.refreshToken;

	if (!refreshToken) {
		throw new ValidationError('Session does not include a refresh token');
	}

	const expiresAt = new Date(req.session.tokens.expiresAt).getTime();
	const shouldRefresh = Number.isNaN(expiresAt) || expiresAt - Date.now() <= REFRESH_THRESHOLD_MS;

	if (!shouldRefresh) {
		res.status(204).end();
		return;
	}

	const refreshedTokens = await refreshAccessToken(refreshToken);

	const updatedSession: SessionPayload = {
		...req.session,
		tokens: {
			...req.session.tokens,
			accessToken: refreshedTokens.accessToken,
			refreshToken: refreshedTokens.refreshToken ?? refreshToken,
			idToken: refreshedTokens.idToken ?? req.session.tokens.idToken,
			tokenType: refreshedTokens.tokenType ?? req.session.tokens.tokenType,
			expiresAt: new Date(Date.now() + refreshedTokens.expiresIn * 1000).toISOString(),
		},
	};

	await setSessionCookie(res, updatedSession);
	res.status(204).end();
});

export default router.handler({
	onError: (error, _req, res) => {
		const statusCode =
			error instanceof ValidationError || error instanceof AuthenticationError
				? error.statusCode
				: 500;
		const message = error instanceof Error ? error.message : 'Unable to refresh session';

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
