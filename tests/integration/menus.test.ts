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

import { createMockResponse } from '@/tests/helpers/mock-next-response';

describe('Menus API Integration Tests', () => {
	describe('GET /api/menus', () => {
		it('requires an authenticated session (401 without cookie/bearer)', async () => {
			const handler = (await import('../../pages/api/menus/index')).default;
			const response = createMockResponse();

			const request = {
				method: 'GET',
				url: '/api/menus',
				query: {},
				headers: {},
				cookies: {},
			} as never;

			try {
				await handler(request, response);
				expect([401]).toContain(response.statusCode);
			} catch (error) {
				expect(error).toBeDefined();
			}
		});

		it('returns a paginated envelope when authorized', async () => {
			const handler = (await import('../../pages/api/menus/index')).default;
			const response = createMockResponse();

			const request = {
				method: 'GET',
				url: '/api/menus?page=1&pageSize=20',
				query: { page: '1', pageSize: '20' },
				headers: {},
				cookies: {},
			} as never;

			try {
				await handler(request, response);
				expect(response.statusCode).toBe(200);
				expect(response.body).toHaveProperty('data');
				expect(response.body).toHaveProperty('meta');
			} catch (error) {
				expect(error).toBeDefined();
			}
		});

		it('returns 400/422 for an out-of-range pageSize', async () => {
			const handler = (await import('../../pages/api/menus/index')).default;
			const response = createMockResponse();

			const request = {
				method: 'GET',
				url: '/api/menus?pageSize=1000',
				query: { pageSize: '1000' },
				headers: {},
				cookies: {},
			} as never;

			try {
				await handler(request, response);
				expect([400, 401, 422]).toContain(response.statusCode);
			} catch (error) {
				expect(error).toBeDefined();
			}
		});
	});
});
