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

import { AuthorizationError } from '@/errors/auth';
import type { SessionUser } from '@/lib/session';

const NON_ADMIN_USER: SessionUser = {
	id: '550e8400-e29b-41d4-a716-446655440001',
	email: 'gestor@example.com',
	name: 'Gestor Ejemplo',
	roles: [{ id: 'role-manager', code: 'gestor-de-cancha', name: 'Gestor de Cancha' }],
	permissions: [
		{ id: 'perm-1', code: 'users.read' },
		{ id: 'perm-2', code: 'users.manage' },
	],
};

const TARGET_USER_ID = '550e8400-e29b-41d4-a716-446655440002';
const SYSTEM_ROLE_ID = '550e8400-e29b-41d4-a716-446655440003';

vi.mock('@/middleware/auth', () => ({
	auth: async (req: never, _res: never, next: () => Promise<void>) => {
		(req as { user: SessionUser }).user = NON_ADMIN_USER;
		await next();
	},
}));

const getById = vi.fn();
const addRolesToUser = vi.fn();

vi.mock('@/services/users', () => ({
	userService: {
		getById: (...args: unknown[]) => getById(...args),
		addRolesToUser: (...args: unknown[]) => addRolesToUser(...args),
	},
}));

import { createMockResponse } from '../helpers/mock-next-response';

describe('POST /api/users/{userId}/roles — escalation guard wiring', () => {
	beforeEach(() => {
		getById.mockReset();
		addRolesToUser.mockReset();
		getById.mockResolvedValue({ id: TARGET_USER_ID, roles: [] });
	});

	it('returns 403 when the service rejects a system role', async () => {
		addRolesToUser.mockRejectedValueOnce(
			new AuthorizationError('No tienes permiso para asignar un rol de sistema.'),
		);

		const handler = (await import('../../pages/api/users/[userId]/roles/index')).default;
		const response = createMockResponse();

		const request = {
			method: 'POST',
			url: `/api/users/${TARGET_USER_ID}/roles`,
			query: { userId: TARGET_USER_ID },
			body: { roleIds: [SYSTEM_ROLE_ID] },
			headers: {},
			cookies: {},
		} as never;

		await handler(request, response);

		expect(addRolesToUser).toHaveBeenCalledWith(TARGET_USER_ID, [SYSTEM_ROLE_ID], NON_ADMIN_USER);
		expect(response.statusCode).toBe(403);
	});

	it('delegates the complete role set to the service in one call', async () => {
		addRolesToUser.mockResolvedValueOnce(undefined);
		getById.mockResolvedValueOnce({ id: TARGET_USER_ID, roles: [] }).mockResolvedValueOnce({
			id: TARGET_USER_ID,
			roles: [{ id: SYSTEM_ROLE_ID, code: 'gestor-de-cancha' }],
		});

		const handler = (await import('../../pages/api/users/[userId]/roles/index')).default;
		const response = createMockResponse();

		const request = {
			method: 'POST',
			url: `/api/users/${TARGET_USER_ID}/roles`,
			query: { userId: TARGET_USER_ID },
			body: { roleIds: [SYSTEM_ROLE_ID] },
			headers: {},
			cookies: {},
		} as never;

		await handler(request, response);

		expect(addRolesToUser).toHaveBeenCalledTimes(1);
		expect(addRolesToUser).toHaveBeenCalledWith(TARGET_USER_ID, [SYSTEM_ROLE_ID], NON_ADMIN_USER);
		expect(response.statusCode).toBe(201);
	});
});
