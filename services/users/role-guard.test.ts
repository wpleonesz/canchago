import { vi, describe, expect, it, beforeEach } from 'vitest';

vi.hoisted(() => {
	process.env.NODE_ENV = 'test';
	process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/canchago?schema=public';
});

const findMany = vi.fn();

vi.mock('@/database/client', () => ({
	prisma: {
		role: {
			findMany: (...args: unknown[]) => findMany(...args),
		},
	},
}));

import type { SessionUser } from '@/lib/session';

import { assertCanAssignRoles } from './role-guard';

const buildUser = (roles: SessionUser['roles']): SessionUser => ({
	id: 'user-1',
	email: 'user@example.com',
	name: 'User Example',
	roles,
	permissions: [],
});

describe('assertCanAssignRoles', () => {
	beforeEach(() => {
		findMany.mockReset();
	});

	it('does nothing for an empty roleIds array, without querying the database', async () => {
		const user = buildUser([]);

		await expect(assertCanAssignRoles(user, [])).resolves.toBeUndefined();
		expect(findMany).not.toHaveBeenCalled();
	});

	it('allows an administrator to assign any role, including system roles', async () => {
		const admin = buildUser([{ id: 'role-admin', code: 'administrador', name: 'Administrador' }]);

		await expect(assertCanAssignRoles(admin, ['role-x'])).resolves.toBeUndefined();
		expect(findMany).not.toHaveBeenCalled();
	});

	it('allows a non-administrator to assign non-system roles', async () => {
		const user = buildUser([
			{ id: 'role-manager', code: 'gestor-de-cancha', name: 'Gestor de Cancha' },
		]);
		findMany.mockResolvedValue([{ isSystem: false }]);

		await expect(assertCanAssignRoles(user, ['role-x'])).resolves.toBeUndefined();
	});

	it('rejects with 403 when a non-administrator tries to assign a system role', async () => {
		const user = buildUser([
			{ id: 'role-manager', code: 'gestor-de-cancha', name: 'Gestor de Cancha' },
		]);
		findMany.mockResolvedValue([{ isSystem: true }]);

		await expect(assertCanAssignRoles(user, ['role-admin'])).rejects.toMatchObject({
			statusCode: 403,
		});
	});

	it('rejects a payload mixing an allowed role with a system role', async () => {
		const user = buildUser([
			{ id: 'role-manager', code: 'gestor-de-cancha', name: 'Gestor de Cancha' },
		]);
		findMany.mockResolvedValue([{ isSystem: false }, { isSystem: true }]);

		await expect(assertCanAssignRoles(user, ['role-x', 'role-admin'])).rejects.toMatchObject({
			statusCode: 403,
		});
	});
});
