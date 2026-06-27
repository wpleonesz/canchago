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

import { createMockResponse } from '../../helpers/mock-next-response';

describe('auth login route', () => {
	it('redirects to the oauth provider and sets the temp cookie', async () => {
		const handler = (await import('../../../pages/api/auth/login')).default;
		const response = createMockResponse();

		await handler(
			{ method: 'GET', url: '/api/auth/login', cookies: {}, query: {}, headers: {} } as never,
			response,
		);

		expect(response.statusCode).toBe(302);
		expect(response.redirectDestination).toContain('https://provider.example.com/oauth2/authorize');
		expect(String(response.headers['Set-Cookie'])).toContain('canchago_oauth_state');
		expect(String(response.headers['Set-Cookie'])).toContain('HttpOnly=true');
	});
});
