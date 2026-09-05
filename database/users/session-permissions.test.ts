import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
	process.env.NODE_ENV = 'test';
	process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/canchago?schema=public';
	process.env.APP_BASE_URL = 'http://localhost:3000';
	process.env.OAUTH_PROVIDER_NAME = 'example-oauth';
	process.env.OAUTH_AUTHORIZATION_URL = 'https://provider.example.com/oauth2/authorize';
	process.env.OAUTH_TOKEN_URL = 'https://provider.example.com/oauth2/token';
	process.env.OAUTH_ISSUER = 'https://provider.example.com/realms/canchago';
	process.env.OAUTH_CLIENT_ID = 'client-id';
	process.env.OAUTH_CLIENT_SECRET = 'client-secret';
	process.env.OAUTH_REDIRECT_URI = 'http://localhost:3000/api/auth/callback';
	process.env.OAUTH_MOBILE_CLIENT_ID = 'canchago-mobile';
	process.env.SESSION_SECRET = '0123456789abcdef0123456789abcdef';
});

const mocks = vi.hoisted(() => ({
	findUnique: vi.fn(),
}));

vi.mock('@/database/client', () => ({
	prisma: {
		user: { findUnique: mocks.findUnique },
	},
}));

import { getSessionUser } from './index';

describe('getSessionUser — permisos efectivos (feature 021)', () => {
	beforeEach(() => {
		mocks.findUnique.mockReset();
	});

	it('consulta RolePermission filtrando granted: true, igual que role.db.ts y permission.db.ts', async () => {
		mocks.findUnique.mockResolvedValue({
			id: 'user-1',
			email: 'user@example.com',
			profile: null,
			userRoles: [],
		});

		await getSessionUser('user-1');

		expect(mocks.findUnique).toHaveBeenCalledTimes(1);

		const callArgs = mocks.findUnique.mock.calls[0][0] as {
			include: {
				userRoles: {
					include: {
						role: {
							include: {
								permissions: { where?: { granted: boolean } };
							};
						};
					};
				};
			};
		};

		const permissionsInclude = callArgs.include.userRoles.include.role.include.permissions;

		expect(permissionsInclude.where).toEqual({ granted: true });
	});

	it('no cambia el conjunto de permisos efectivos para las filas que ya venían con granted: true', async () => {
		mocks.findUnique.mockResolvedValue({
			id: 'user-1',
			email: 'user@example.com',
			profile: null,
			userRoles: [
				{
					role: {
						id: 'role-1',
						code: 'administrador',
						name: 'Administrador',
						permissions: [
							{ permission: { id: 'perm-1', code: 'roles.read' } },
							{ permission: { id: 'perm-2', code: 'roles.manage' } },
						],
					},
				},
			],
		});

		const session = await getSessionUser('user-1');

		expect(session?.permissions).toEqual([
			{ id: 'perm-1', code: 'roles.read' },
			{ id: 'perm-2', code: 'roles.manage' },
		]);
	});
});
