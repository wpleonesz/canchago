import { createRemoteJWKSet, importSPKI, jwtVerify } from 'jose';
import type { JWTVerifyGetKey } from 'jose';

import { ValidationError } from '@/errors/auth';

import { env } from '@/lib/config/env';

export type OAuthTokenResponse = {
	accessToken: string;
	refreshToken?: string | null;
	idToken?: string | null;
	tokenType?: string | null;
	expiresIn: number;
	scope?: string | null;
};

type OAuthMetadata = {
	issuer: string;
	audience: string;
	nonce: string;
};

const createBasicAuthHeader = (): string =>
	`Basic ${Buffer.from(`${env.OAUTH_CLIENT_ID}:${env.OAUTH_CLIENT_SECRET}`).toString('base64')}`;

const parseTokenResponse = async (response: Response): Promise<OAuthTokenResponse> => {
	const body = (await response.json()) as Record<string, unknown>;

	if (!response.ok) {
		const errorMessage =
			typeof body.error_description === 'string'
				? body.error_description
				: 'OAuth token exchange failed';
		throw new ValidationError(errorMessage);
	}

	const accessToken = body.access_token;
	const tokenType = body.token_type;
	const expiresIn = body.expires_in;

	if (typeof accessToken !== 'string' || typeof expiresIn !== 'number') {
		throw new ValidationError('OAuth provider returned an invalid token payload');
	}

	return {
		accessToken,
		refreshToken: typeof body.refresh_token === 'string' ? body.refresh_token : null,
		idToken: typeof body.id_token === 'string' ? body.id_token : null,
		tokenType: typeof tokenType === 'string' ? tokenType : null,
		expiresIn,
		scope: typeof body.scope === 'string' ? body.scope : null,
	};
};

export const buildAuthorizationUrl = (
	state: string,
	codeChallenge: string,
	nonce: string,
): string => {
	const url = new URL(env.OAUTH_AUTHORIZATION_URL);

	url.searchParams.set('response_type', 'code');
	url.searchParams.set('client_id', env.OAUTH_CLIENT_ID);
	url.searchParams.set('redirect_uri', env.OAUTH_REDIRECT_URI);
	url.searchParams.set('scope', env.OAUTH_SCOPE);
	url.searchParams.set('state', state);
	url.searchParams.set('code_challenge', codeChallenge);
	url.searchParams.set('code_challenge_method', 'S256');
	url.searchParams.set('nonce', nonce);

	return url.toString();
};

export const exchangeCode = async (
	code: string,
	codeVerifier: string,
): Promise<OAuthTokenResponse> => {
	const response = await fetch(env.OAUTH_TOKEN_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Authorization: createBasicAuthHeader(),
		},
		body: new URLSearchParams({
			grant_type: 'authorization_code',
			code,
			redirect_uri: env.OAUTH_REDIRECT_URI,
			code_verifier: codeVerifier,
			client_id: env.OAUTH_CLIENT_ID,
		}),
	});

	return parseTokenResponse(response);
};

const createKeyResolver = (): JWTVerifyGetKey => {
	if (env.OAUTH_JWKS_URL) {
		return createRemoteJWKSet(new URL(env.OAUTH_JWKS_URL));
	}

	if (env.OAUTH_PUBLIC_KEY_PEM) {
		const publicKeyPem = env.OAUTH_PUBLIC_KEY_PEM;

		return async () => importSPKI(publicKeyPem, 'RS256');
	}

	throw new ValidationError(
		'Missing OAUTH_JWKS_URL or OAUTH_PUBLIC_KEY_PEM for ID token verification',
	);
};

export const verifyIdToken = async (
	idToken: string,
	metadata: OAuthMetadata,
): Promise<Record<string, unknown>> => {
	const key = createKeyResolver();
	const result = await jwtVerify(idToken, key, {
		issuer: metadata.issuer,
		audience: metadata.audience,
	});

	const nonce = result.payload.nonce;

	if (typeof nonce !== 'string' || nonce !== metadata.nonce) {
		throw new ValidationError('Invalid ID token nonce');
	}

	return result.payload as Record<string, unknown>;
};

export const refreshAccessToken = async (refreshToken: string): Promise<OAuthTokenResponse> => {
	const response = await fetch(env.OAUTH_TOKEN_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Authorization: createBasicAuthHeader(),
		},
		body: new URLSearchParams({
			grant_type: 'refresh_token',
			refresh_token: refreshToken,
			client_id: env.OAUTH_CLIENT_ID,
		}),
	});

	return parseTokenResponse(response);
};

export const revokeToken = async (token: string): Promise<void> => {
	if (!env.OAUTH_REVOCATION_URL) {
		return;
	}

	const response = await fetch(env.OAUTH_REVOCATION_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Authorization: createBasicAuthHeader(),
		},
		body: new URLSearchParams({
			token,
			client_id: env.OAUTH_CLIENT_ID,
		}),
	});

	if (!response.ok) {
		throw new ValidationError('OAuth token revocation failed');
	}
};
