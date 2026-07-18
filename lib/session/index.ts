import { defaults as ironDefaults, seal, unseal } from '@hapi/iron';
import type { NextApiResponse } from 'next';

import { AuthenticationError } from '@/errors/auth';

import { env } from '@/lib/config/env';
import { appendSetCookie, buildCookieHeader, buildExpiredCookieHeader } from '@/lib/http/cookies';

export type SessionRole = {
	id: string;
	code: string;
	name: string;
};

export type SessionPermission = {
	id: string;
	code: string;
};

export type SessionUser = {
	id: string;
	email: string;
	name: string;
	roles: SessionRole[];
	permissions: SessionPermission[];
};

export type SessionTokenSet = {
	accessToken: string;
	refreshToken?: string | null;
	idToken?: string | null;
	tokenType?: string | null;
	expiresAt: string;
	nonce?: string | null;
};

/**
 * Lo ÚNICO que viaja dentro de la cookie.
 *
 * Los tokens OAuth viven en la tabla `user_sessions`, no aquí: los tres juntos
 * (access + refresh + id) sellaban una cookie de ~5.300 bytes, y el navegador
 * descarta en silencio cualquier cookie de más de 4.096.
 */
export type SessionCookiePayload = {
	sessionId: string;
	createdAt: string;
};

/**
 * La sesión ya resuelta que el middleware `auth` deja en `req.session`.
 * Se arma en cada petición: el usuario sale de la base, los tokens de `user_sessions`.
 */
export type SessionPayload = {
	sessionId: string;
	user: SessionUser;
	tokens: SessionTokenSet;
	createdAt: string;
};

const getSecrets = (): string[] => [
	env.SESSION_SECRET,
	...(env.SESSION_PREVIOUS_SECRET ? [env.SESSION_PREVIOUS_SECRET] : []),
];

const unsealWithSecrets = async (value: string, ttlSeconds: number): Promise<unknown> => {
	for (const secret of getSecrets()) {
		try {
			return await unseal(value, secret, { ...ironDefaults, ttl: ttlSeconds * 1000 });
		} catch {
			continue;
		}
	}

	throw new AuthenticationError('Tu sesión no es válida o ha expirado. Inicia sesión de nuevo.');
};

/** Sella el token set para guardarlo en base de datos: un volcado no expone los tokens. */
export const sealTokens = async (tokens: SessionTokenSet): Promise<string> =>
	seal(tokens, env.SESSION_SECRET, {
		...ironDefaults,
		ttl: 0,
	});

export const unsealTokens = async (sealedTokens: string): Promise<SessionTokenSet> =>
	(await unsealWithSecrets(sealedTokens, 0)) as SessionTokenSet;

export const encrypt = async (payload: SessionCookiePayload): Promise<string> =>
	seal(payload, env.SESSION_SECRET, {
		...ironDefaults,
		ttl: env.SESSION_COOKIE_MAX_AGE_SECONDS * 1000,
	});

export const decrypt = async (cookieValue: string): Promise<SessionCookiePayload> =>
	(await unsealWithSecrets(
		cookieValue,
		env.SESSION_COOKIE_MAX_AGE_SECONDS,
	)) as SessionCookiePayload;

export const setSessionCookie = async (
	response: NextApiResponse,
	payload: SessionCookiePayload,
): Promise<void> => {
	const cookieValue = await encrypt(payload);
	const cookie = buildCookieHeader(env.SESSION_COOKIE_NAME, cookieValue, {
		maxAgeSeconds: env.SESSION_COOKIE_MAX_AGE_SECONDS,
		path: env.SESSION_COOKIE_PATH,
		domain: env.SESSION_COOKIE_DOMAIN,
		httpOnly: true,
		secure: true,
		sameSite: 'Lax',
	});

	response.setHeader(
		'Set-Cookie',
		appendSetCookie(response.getHeader('Set-Cookie') as string | string[] | undefined, cookie),
	);
};

export const clearSessionCookie = (response: NextApiResponse): void => {
	response.setHeader(
		'Set-Cookie',
		appendSetCookie(
			response.getHeader('Set-Cookie') as string | string[] | undefined,
			buildExpiredCookieHeader(env.SESSION_COOKIE_NAME, {
				path: env.SESSION_COOKIE_PATH,
				domain: env.SESSION_COOKIE_DOMAIN,
			}),
		),
	);
};

export const createTemporaryOAuthCookie = async (
	state: string,
	codeVerifier: string,
	nonce: string,
): Promise<string> =>
	seal({ state, codeVerifier, nonce, createdAt: new Date().toISOString() }, env.SESSION_SECRET, {
		...ironDefaults,
		ttl: env.SESSION_TEMP_COOKIE_MAX_AGE_SECONDS * 1000,
	});

export type TemporaryOAuthState = {
	state: string;
	codeVerifier: string;
	nonce: string;
	createdAt: string;
};

export const decryptTemporaryOAuthCookie = async (
	cookieValue: string,
): Promise<TemporaryOAuthState> => {
	for (const secret of getSecrets()) {
		try {
			const unsealed = await unseal(cookieValue, secret, {
				...ironDefaults,
				ttl: env.SESSION_TEMP_COOKIE_MAX_AGE_SECONDS * 1000,
			});

			return unsealed as TemporaryOAuthState;
		} catch {
			continue;
		}
	}

	throw new AuthenticationError('La solicitud de inicio de sesión expiró. Intenta de nuevo.');
};

export const clearTemporaryOAuthCookie = (response: NextApiResponse): void => {
	response.setHeader(
		'Set-Cookie',
		appendSetCookie(
			response.getHeader('Set-Cookie') as string | string[] | undefined,
			buildExpiredCookieHeader(env.SESSION_TEMP_COOKIE_NAME, {
				path: env.SESSION_COOKIE_PATH,
				domain: env.SESSION_COOKIE_DOMAIN,
			}),
		),
	);
};
