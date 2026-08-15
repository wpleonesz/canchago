import { vi, describe, expect, it, beforeEach } from 'vitest';

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
	process.env.OAUTH_MOBILE_CLIENT_ID = 'canchago-mobile';
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

const passwordGrant = vi.fn();
const verifyIdToken = vi.fn();

vi.mock('../../../lib/oauth', () => ({
	passwordGrant: (...args: unknown[]) => passwordGrant(...args),
	verifyIdToken: (...args: unknown[]) => verifyIdToken(...args),
}));

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

const buildRequest = (body: unknown) =>
	({
		method: 'POST',
		url: '/api/auth/mobile/login',
		cookies: {},
		query: {},
		headers: {},
		body,
	}) as never;

describe('auth mobile login route (ROPC, cliente móvil)', () => {
	beforeEach(() => {
		passwordGrant.mockReset();
		verifyIdToken.mockReset();
		createSession.mockClear();
	});

	it('logs in with username/password using the public mobile client and returns a sessionToken', async () => {
		passwordGrant.mockResolvedValue({
			accessToken: 'access-token',
			refreshToken: 'refresh-token',
			idToken: 'id-token',
			tokenType: 'Bearer',
			expiresIn: 3600,
		});
		verifyIdToken.mockResolvedValue({
			sub: 'oauth-subject',
			email: 'user@example.com',
			name: 'User Example',
		});

		const handler = (await import('../../../pages/api/auth/mobile/login')).default;
		const response = createMockResponse();

		await handler(buildRequest({ username: 'futbolista', password: 'canchago123' }), response);

		expect(passwordGrant).toHaveBeenCalledWith('futbolista', 'canchago123');
		expect(createSession).toHaveBeenCalledWith(
			'11111111-1111-1111-1111-111111111111',
			expect.objectContaining({ accessToken: 'access-token', clientId: 'canchago-mobile' }),
		);

		expect(response.statusCode).toBe(200);
		const body = response.body as { data: { sessionToken: string; expiresAt: string } };
		expect(typeof body.data.sessionToken).toBe('string');
		expect(body.data.sessionToken).not.toBe('id-token');
	});

	it('rejects an invalid body (missing password) without calling Keycloak', async () => {
		const handler = (await import('../../../pages/api/auth/mobile/login')).default;
		const response = createMockResponse();

		await handler(buildRequest({ username: 'futbolista' }), response);

		expect(response.statusCode).toBe(400);
		expect(passwordGrant).not.toHaveBeenCalled();
	});

	it('maps wrong credentials to a generic 401, never leaking the provider error, and creates no session', async () => {
		passwordGrant.mockRejectedValue(new Error('invalid_grant: Invalid user credentials'));

		const handler = (await import('../../../pages/api/auth/mobile/login')).default;
		const response = createMockResponse();

		await handler(buildRequest({ username: 'futbolista', password: 'wrong-password' }), response);

		expect(response.statusCode).toBe(401);
		const body = response.body as { error: { message: string } };
		expect(body.error.message).toBe('Usuario o contraseña incorrectos.');
		expect(body.error.message).not.toContain('invalid_grant');
		expect(createSession).not.toHaveBeenCalled();
	});
});
