import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
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

import type { SessionUser } from '@/lib/session';

const USER_ID = '550e8400-e29b-41d4-a716-446655440002';
const UPDATED_AT = '2026-08-21T12:00:00.000Z';
const updateAdminProfile = vi.fn();
const getAdminProfile = vi.fn();
let actingUser: SessionUser;

vi.mock('@/middleware/auth', () => ({
	auth: async (req: never, _res: never, next: () => Promise<void>) => {
		(req as { user: SessionUser }).user = actingUser;
		await next();
	},
}));

vi.mock('@/services/users', () => ({
	userService: {
		getAdminProfile: (...args: unknown[]) => getAdminProfile(...args),
		updateAdminProfile: (...args: unknown[]) => updateAdminProfile(...args),
	},
}));

import { createMockResponse } from '../helpers/mock-next-response';

describe('/api/users/{userId}/profile', () => {
	beforeEach(() => {
		actingUser = {
			id: '550e8400-e29b-41d4-a716-446655440001',
			email: 'admin@example.com',
			name: 'Admin',
			roles: [],
			permissions: [
				{ id: 'permission-read', code: 'users.read' },
				{ id: 'permission-update', code: 'users.update' },
			],
		};
		getAdminProfile.mockReset();
		updateAdminProfile.mockReset();
	});

	it('rechaza mass assignment antes de invocar el servicio', async () => {
		const handler = (await import('../../pages/api/users/[userId]/profile')).default;
		const response = createMockResponse();

		await handler(
			{
				method: 'PATCH',
				url: `/api/users/${USER_ID}/profile`,
				query: { userId: USER_ID },
				body: {
					firstName: 'Ada',
					expectedProfileUpdatedAt: UPDATED_AT,
					roleIds: ['system-role'],
				},
				headers: {},
				cookies: {},
			} as never,
			response,
		);

		expect(response.statusCode).toBe(400);
		expect(updateAdminProfile).not.toHaveBeenCalled();
	});

	it('delega un PATCH válido con el actor autenticado', async () => {
		updateAdminProfile.mockResolvedValue({ id: USER_ID, firstName: 'Ada' });
		const handler = (await import('../../pages/api/users/[userId]/profile')).default;
		const response = createMockResponse();
		const body = { firstName: 'Ada', expectedProfileUpdatedAt: UPDATED_AT };

		await handler(
			{
				method: 'PATCH',
				url: `/api/users/${USER_ID}/profile`,
				query: { userId: USER_ID },
				body,
				headers: {},
				cookies: {},
			} as never,
			response,
		);

		expect(response.statusCode).toBe(200);
		expect(updateAdminProfile).toHaveBeenCalledWith(USER_ID, body, actingUser);
	});

	it('responde 403 sin users.update aunque se fuerce la petición', async () => {
		actingUser = { ...actingUser, permissions: [] };
		const handler = (await import('../../pages/api/users/[userId]/profile')).default;
		const response = createMockResponse();

		await handler(
			{
				method: 'PATCH',
				url: `/api/users/${USER_ID}/profile`,
				query: { userId: USER_ID },
				body: { firstName: 'Ada', expectedProfileUpdatedAt: UPDATED_AT },
				headers: {},
				cookies: {},
			} as never,
			response,
		);

		expect(response.statusCode).toBe(403);
		expect(updateAdminProfile).not.toHaveBeenCalled();
	});
});
