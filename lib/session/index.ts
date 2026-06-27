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

export type SessionPayload = {
	user: SessionUser;
	tokens: SessionTokenSet;
	createdAt: string;
};

const getSecrets = (): string[] => [
	env.SESSION_SECRET,
	...(env.SESSION_PREVIOUS_SECRET ? [env.SESSION_PREVIOUS_SECRET] : []),
];

export const encrypt = async (payload: SessionPayload): Promise<string> =>
	seal(payload, env.SESSION_SECRET, {
		...ironDefaults,
		ttl: env.SESSION_COOKIE_MAX_AGE_SECONDS * 1000,
	});

export const decrypt = async (cookieValue: string): Promise<SessionPayload> => {
	for (const secret of getSecrets()) {
		try {
			const unsealed = await unseal(cookieValue, secret, {
				...ironDefaults,
				ttl: env.SESSION_COOKIE_MAX_AGE_SECONDS * 1000,
			});

			return unsealed as SessionPayload;
		} catch {
			continue;
		}
	}

	throw new AuthenticationError('Invalid or expired session');
};

export const setSessionCookie = async (
	response: NextApiResponse,
	payload: SessionPayload,
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

	throw new AuthenticationError('Invalid or expired OAuth state');
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
