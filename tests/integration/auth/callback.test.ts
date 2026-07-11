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
	process.env.SESSION_SECRET = '0123456789abcdef0123456789abcdef';
	process.env.SESSION_COOKIE_NAME = 'canchago_session';
	process.env.SESSION_TEMP_COOKIE_NAME = 'canchago_oauth_state';
	process.env.SESSION_COOKIE_PATH = '/';
	process.env.SESSION_COOKIE_MAX_AGE_SECONDS = '28800';
	process.env.SESSION_TEMP_COOKIE_MAX_AGE_SECONDS = '600';
});

vi.mock('../../../database/users', () => ({
	findOrSyncByOAuth: vi.fn().mockResolvedValue({
		user: {
			id: '11111111-1111-1111-1111-111111111111',
			email: 'user@example.com',
			name: 'User Example',
			roles: [],
			permissions: [],
		},
	}),
}));

vi.mock('../../../lib/oauth', () => ({
	exchangeCode: vi.fn().mockResolvedValue({
		accessToken: 'access-token',
		refreshToken: 'refresh-token',
		idToken: 'id-token',
		tokenType: 'Bearer',
		expiresIn: 3600,
		scope: 'openid email profile',
	}),
	verifyIdToken: vi.fn().mockResolvedValue({
		sub: 'oauth-subject',
		email: 'user@example.com',
		name: 'User Example',
	}),
}));

// El callback ya no mete los tokens en la cookie: crea la sesión en el servidor.
const createSession = vi.fn().mockResolvedValue('22222222-2222-2222-2222-222222222222');

vi.mock('@/services/auth/session.service', () => ({
	sessionService: {
		create: (userId: string, tokens: unknown) => createSession(userId, tokens),
		resolve: vi.fn(),
		rotateTokens: vi.fn(),
		revoke: vi.fn(),
	},
}));

import { createMockResponse } from '../../helpers/mock-next-response';

describe('auth callback route', () => {
	it('creates a session and redirects back to the app', async () => {
		const { createTemporaryOAuthCookie } = await import('../../../lib/session');
		const handler = (await import('../../../pages/api/auth/callback')).default;
		const response = createMockResponse();

		const state = 'state-value';
		const cookie = await createTemporaryOAuthCookie(state, 'code-verifier', 'nonce-value');

		await handler(
			{
				method: 'GET',
				url: '/api/auth/callback',
				cookies: { canchago_oauth_state: cookie },
				query: { code: 'auth-code', state },
				headers: {},
			} as never,
			response,
		);

		expect(response.statusCode).toBe(302);
		expect(response.redirectDestination).toBe('http://localhost:3000/');

		// Los tokens se guardan en el servidor, asociados al usuario...
		expect(createSession).toHaveBeenCalledWith(
			'11111111-1111-1111-1111-111111111111',
			expect.objectContaining({ accessToken: 'access-token', refreshToken: 'refresh-token' }),
		);

		// ...y la cookie NO los lleva: sólo el id de sesión, muy por debajo del límite de 4096 bytes.
		const setCookie = String(response.headers['Set-Cookie']);

		expect(setCookie).toContain('canchago_session');
		expect(setCookie).not.toContain('access-token');
		expect(setCookie.length).toBeLessThan(4096);
	});
});
