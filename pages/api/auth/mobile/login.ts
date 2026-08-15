import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

import { AuthenticationError } from '@/errors';
import { routerOptions } from '@/lib/api/router-config';
import { env } from '@/lib/config/env';
import { throwValidationError } from '@/lib/errors/throw-validation-error';
import { passwordGrant, verifyIdToken } from '@/lib/oauth';
import { encrypt } from '@/lib/session';
import type { SessionCookiePayload } from '@/lib/session';
import { findOrSyncByOAuth } from '@/database/users';
import { sessionService } from '@/services/auth/session.service';
import { mobileLoginSchema } from '@/validations/auth/mobile-login.validation';

type OAuthClaims = {
	sub?: string;
	email?: string;
	name?: string;
};

const router = createRouter<NextApiRequest, NextApiResponse>();

router.post(async (req, res) => {
	const parsed = mobileLoginSchema.safeParse(req.body);
	throwValidationError(parsed);

	const { username, password } = parsed.data;

	let tokens;
	try {
		tokens = await passwordGrant(username, password);
	} catch {
		// Nunca exponemos el detalle exacto de Keycloak (p. ej. "Invalid user credentials",
		// en inglés) — ni si el usuario existe o no, para no facilitar enumeración de cuentas.
		throw new AuthenticationError('Usuario o contraseña incorrectos.');
	}

	if (!tokens.idToken) {
		throw new AuthenticationError(
			'El proveedor de autenticación no devolvió la información necesaria.',
		);
	}

	// Sin nonce: el grant de contraseña no tiene handshake de redirección que fijarle uno.
	const claims = (await verifyIdToken(tokens.idToken, {
		issuer: env.OAUTH_ISSUER,
		audience: env.OAUTH_MOBILE_CLIENT_ID,
	}).catch(() => null)) as OAuthClaims | null;

	if (!claims?.sub || !claims.email || !claims.name) {
		throw new AuthenticationError(
			'El proveedor de autenticación no devolvió los datos de identidad completos.',
		);
	}

	const syncedUser = await findOrSyncByOAuth(claims.sub, claims.email, claims.name);

	const sessionId = await sessionService.create(syncedUser.user.id, {
		accessToken: tokens.accessToken,
		refreshToken: tokens.refreshToken,
		idToken: tokens.idToken,
		tokenType: tokens.tokenType,
		expiresAt: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
		clientId: env.OAUTH_MOBILE_CLIENT_ID,
	});

	const payload: SessionCookiePayload = {
		sessionId,
		createdAt: new Date().toISOString(),
	};

	const sessionToken = await encrypt(payload);
	const expiresAt = new Date(Date.now() + env.SESSION_COOKIE_MAX_AGE_SECONDS * 1000).toISOString();

	res.status(200).json({ data: { sessionToken, expiresAt } });
});

export default router.handler(routerOptions);
