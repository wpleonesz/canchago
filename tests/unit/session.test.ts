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

import { createMockResponse } from '../helpers/mock-next-response';

describe('session helpers', () => {
	it('encrypts and decrypts a session payload', async () => {
		const { decrypt, encrypt } = await import('../../lib/session');

		const payload = {
			user: {
				id: '11111111-1111-1111-1111-111111111111',
				email: 'user@example.com',
				name: 'User Example',
				roles: [],
				permissions: [],
			},
			tokens: {
				accessToken: 'access-token',
				refreshToken: 'refresh-token',
				idToken: 'id-token',
				tokenType: 'Bearer',
				expiresAt: new Date(Date.now() + 60_000).toISOString(),
				nonce: 'nonce',
			},
			createdAt: new Date().toISOString(),
		};

		const sealed = await encrypt(payload);
		const unsealed = await decrypt(sealed);

		expect(unsealed).toEqual(payload);
	});

	it('writes a session cookie with secure flags', async () => {
		const { setSessionCookie } = await import('../../lib/session');

		const response = createMockResponse();

		await setSessionCookie(response, {
			user: {
				id: '11111111-1111-1111-1111-111111111111',
				email: 'user@example.com',
				name: 'User Example',
				roles: [],
				permissions: [],
			},
			tokens: {
				accessToken: 'access-token',
				refreshToken: 'refresh-token',
				idToken: 'id-token',
				tokenType: 'Bearer',
				expiresAt: new Date(Date.now() + 60_000).toISOString(),
				nonce: 'nonce',
			},
			createdAt: new Date().toISOString(),
		});

		const header = response.headers['Set-Cookie'];

		expect(header).toBeDefined();
		expect(Array.isArray(header) ? header[0] : header).toContain('HttpOnly=true');
		expect(Array.isArray(header) ? header[0] : header).toContain('Secure=true');
		expect(Array.isArray(header) ? header[0] : header).toContain('SameSite=Lax');
	});
});
