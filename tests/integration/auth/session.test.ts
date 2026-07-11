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
	process.env.OAUTH_SCOPE = 'openid email profile offline_access';
	process.env.OAUTH_SUCCESS_REDIRECT_URL = 'http://localhost:3000/';
	process.env.SESSION_SECRET = '0123456789abcdef0123456789abcdef';
	process.env.SESSION_COOKIE_NAME = 'canchago_session';
	process.env.SESSION_TEMP_COOKIE_NAME = 'canchago_oauth_state';
	process.env.SESSION_COOKIE_PATH = '/';
	process.env.SESSION_COOKIE_MAX_AGE_SECONDS = '28800';
	process.env.SESSION_TEMP_COOKIE_MAX_AGE_SECONDS = '600';
});

import { createMockResponse } from '../../helpers/mock-next-response';

// La cookie ya sólo lleva el id de sesión: el usuario y los tokens los resuelve
// el servicio contra la base de datos en cada petición.
const resolve = vi.fn();
const revoke = vi.fn();

vi.mock('@/services/auth/session.service', () => ({
	sessionService: {
		resolve: (sessionId: string) => resolve(sessionId),
		revoke: (sessionId: string) => revoke(sessionId),
		create: vi.fn(),
		rotateTokens: vi.fn(),
	},
}));

const SESSION_ID = '22222222-2222-2222-2222-222222222222';

const buildRequest = (cookie: string) =>
	({
		method: 'GET',
		url: '/api/auth/session',
		cookies: { canchago_session: cookie },
		query: {},
		headers: {},
	}) as never;

describe('auth session route', () => {
	beforeEach(() => {
		resolve.mockReset();
	});

	it('returns the current authenticated session', async () => {
		const { encrypt } = await import('../../../lib/session');
		const handler = (await import('../../../pages/api/auth/session')).default;
		const response = createMockResponse();

		resolve.mockResolvedValue({
			sessionId: SESSION_ID,
			user: {
				id: '11111111-1111-1111-1111-111111111111',
				email: 'user@example.com',
				name: 'User Example',
				roles: [],
				permissions: [],
			},
			tokens: {
				accessToken: 'access-token',
				expiresAt: new Date(Date.now() + 60_000).toISOString(),
			},
			createdAt: new Date().toISOString(),
		});

		const cookie = await encrypt({
			sessionId: SESSION_ID,
			createdAt: new Date().toISOString(),
		});

		await handler(buildRequest(cookie), response);

		expect(resolve).toHaveBeenCalledWith(SESSION_ID);
		expect(response.statusCode).toBe(200);
		expect(response.body).toMatchObject({
			data: {
				email: 'user@example.com',
				name: 'User Example',
			},
		});
	});

	it('rejects a cookie whose session was revoked on the server', async () => {
		const { encrypt } = await import('../../../lib/session');
		const { AuthenticationError } = await import('../../../errors/auth');
		const handler = (await import('../../../pages/api/auth/session')).default;
		const response = createMockResponse();

		// Es el escenario del logout: la cookie sigue siendo criptográficamente válida,
		// pero la sesión ya no existe en el servidor.
		resolve.mockRejectedValue(new AuthenticationError('Session revoked or expired'));

		const cookie = await encrypt({
			sessionId: SESSION_ID,
			createdAt: new Date().toISOString(),
		});

		await handler(buildRequest(cookie), response);

		expect(response.statusCode).toBe(401);
	});
});
