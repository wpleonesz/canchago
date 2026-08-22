import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAdminProfileData = vi.fn();
const updateAdminProfileData = vi.fn();

vi.mock('@/database/users', () => ({
	getAdminProfile: (...args: unknown[]) => getAdminProfileData(...args),
	updateAdminProfile: (...args: unknown[]) => updateAdminProfileData(...args),
	getRolesByUserId: vi.fn(),
	addRoleToUser: vi.fn(),
}));

vi.mock('./role-guard', () => ({
	assertCanAssignRoles: vi.fn(),
	isAdministrator: (user: { roles: Array<{ code: string }> }) =>
		user.roles.some(role => role.code === 'administrador'),
}));

import type { SessionUser } from '@/lib/session';

import { getAdminProfile, updateAdminProfile } from './index';

const USER_ID = '123e4567-e89b-42d3-a456-426614174001';
const UPDATED_AT = new Date('2026-08-21T12:00:00.000Z');
const ACTOR: SessionUser = {
	id: '123e4567-e89b-42d3-a456-426614174002',
	email: 'gestor@example.com',
	name: 'Gestor',
	roles: [],
	permissions: [{ id: 'permission-1', code: 'users.update' }],
};
const RECORD = {
	id: USER_ID,
	email: 'ada@example.com',
	status: 'ACTIVE',
	profile: { firstName: 'Ada', lastName: 'Lovelace', updatedAt: UPDATED_AT },
};
const BODY = {
	firstName: 'Augusta Ada',
	expectedProfileUpdatedAt: UPDATED_AT.toISOString(),
};

describe('servicio de perfil administrativo', () => {
	beforeEach(() => {
		getAdminProfileData.mockReset();
		updateAdminProfileData.mockReset();
	});

	it('devuelve únicamente el DTO administrativo mínimo', async () => {
		getAdminProfileData.mockResolvedValue(RECORD);

		await expect(getAdminProfile(USER_ID)).resolves.toEqual({
			id: USER_ID,
			email: RECORD.email,
			firstName: 'Ada',
			lastName: 'Lovelace',
			active: true,
			profileUpdatedAt: UPDATED_AT,
		});
	});

	it('actualiza pasando al acceso de datos si el actor es administrador', async () => {
		updateAdminProfileData.mockResolvedValue({ outcome: 'UPDATED', user: RECORD });
		const administrator = {
			...ACTOR,
			roles: [{ id: 'admin-role', code: 'administrador', name: 'Administrador' }],
		};

		await expect(updateAdminProfile(USER_ID, BODY, administrator)).resolves.toMatchObject({
			id: USER_ID,
			firstName: 'Ada',
		});
		expect(updateAdminProfileData).toHaveBeenCalledWith(USER_ID, BODY, true);
	});

	it.each([
		['NOT_FOUND', 404, 'NOT_FOUND'],
		['INACTIVE', 409, 'CONFLICT'],
		['SYSTEM_ROLE', 403, 'FORBIDDEN'],
		['CONFLICT', 409, 'CONFLICT'],
	] as const)('mapea %s a un error controlado', async (outcome, statusCode, code) => {
		updateAdminProfileData.mockResolvedValue({ outcome });

		await expect(updateAdminProfile(USER_ID, BODY, ACTOR)).rejects.toMatchObject({
			statusCode,
			code,
		});
	});
});
