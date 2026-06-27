import { vi, describe, expect, it } from 'vitest';

vi.hoisted(() => {
	process.env.NODE_ENV = 'test';
	process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/canchago?schema=public';
	process.env.APP_BASE_URL = 'http://localhost:3000';
	process.env.OAUTH_PROVIDER_NAME = 'example-oauth';
	process.env.OAUTH_AUTHORIZATION_URL = 'https://provider.example.com/oauth2/authorize';
	process.env.OAUTH_TOKEN_URL = 'https://provider.example.com/oauth2/token';
	process.env.OAUTH_ISSUER = 'https://provider.example.com/';
	process.env.OAUTH_CLIENT_ID = 'client-id';
	process.env.OAUTH_CLIENT_SECRET = 'client-secret';
	process.env.OAUTH_REDIRECT_URI = 'http://localhost:3000/api/auth/callback';
	process.env.OAUTH_SCOPE = 'openid email profile offline_access';
	process.env.OAUTH_SUCCESS_REDIRECT_URL = 'http://localhost:3000/';
	process.env.OAUTH_PUBLIC_KEY_PEM =
		'-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsamplekey\n-----END PUBLIC KEY-----';
	process.env.SESSION_SECRET = '0123456789abcdef0123456789abcdef';
	process.env.SESSION_COOKIE_NAME = 'canchago_session';
	process.env.SESSION_TEMP_COOKIE_NAME = 'canchago_oauth_state';
	process.env.SESSION_COOKIE_PATH = '/';
	process.env.SESSION_COOKIE_MAX_AGE_SECONDS = '28800';
	process.env.SESSION_TEMP_COOKIE_MAX_AGE_SECONDS = '600';
});

describe('oauth helpers', () => {
	it('builds the authorization url with pkce params', async () => {
		const { buildAuthorizationUrl } = await import('../../lib/oauth');

		const url = new URL(buildAuthorizationUrl('state', 'challenge', 'nonce'));

		expect(url.searchParams.get('state')).toBe('state');
		expect(url.searchParams.get('code_challenge')).toBe('challenge');
		expect(url.searchParams.get('code_challenge_method')).toBe('S256');
		expect(url.searchParams.get('nonce')).toBe('nonce');
	});

	it('parses token exchange responses', async () => {
		const { exchangeCode, refreshAccessToken } = await import('../../lib/oauth');

		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				access_token: 'access',
				refresh_token: 'refresh',
				id_token: 'id',
				token_type: 'Bearer',
				expires_in: 3600,
				scope: 'openid email profile',
			}),
		});

		vi.stubGlobal('fetch', fetchMock);

		await expect(exchangeCode('code', 'verifier')).resolves.toMatchObject({
			accessToken: 'access',
			refreshToken: 'refresh',
			idToken: 'id',
			tokenType: 'Bearer',
			expiresIn: 3600,
		});

		await expect(refreshAccessToken('refresh')).resolves.toMatchObject({
			accessToken: 'access',
		});
	});
});
