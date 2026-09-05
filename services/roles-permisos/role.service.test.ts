import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	actorHasOrganizationScope: vi.fn(),
	findRole: vi.fn(),
	findPermissions: vi.fn(),
	createRole: vi.fn(),
	updateRole: vi.fn(),
	replacePermissions: vi.fn(),
	writeAudit: vi.fn(),
	getDetail: vi.fn(),
	softDelete: vi.fn(),
}));

vi.mock('@/database/roles-permisos/role.db', () => ({
	isRoleUniqueConstraintError: () => false,
	roleDb: {
		actorHasOrganizationScope: mocks.actorHasOrganizationScope,
		withTransaction: (operation: (repository: unknown) => Promise<unknown>) =>
			operation({
				findRole: mocks.findRole,
				findPermissions: mocks.findPermissions,
				createRole: mocks.createRole,
				updateRole: mocks.updateRole,
				replacePermissions: mocks.replacePermissions,
				writeAudit: mocks.writeAudit,
				getDetail: mocks.getDetail,
				softDelete: mocks.softDelete,
			}),
	},
}));

vi.mock('@/services/users/role-guard', () => ({
	isAdministrator: (user: { roles: Array<{ code: string }> }) =>
		user.roles.some(role => role.code === 'administrador'),
}));

import type { SessionUser } from '@/lib/session';

import { roleService } from './role.service';

const ORGANIZATION_ID = '123e4567-e89b-42d3-a456-426614174001';
const ROLE_ID = '123e4567-e89b-42d3-a456-426614174002';
const PERMISSION_ID = '123e4567-e89b-42d3-a456-426614174003';
const UPDATED_AT = '2026-08-29T10:00:00.000Z';

const buildUser = ({ administrator = false, permissions = [] as string[] } = {}): SessionUser => ({
	id: '123e4567-e89b-42d3-a456-426614174004',
	email: 'actor@example.com',
	name: 'Actor',
	roles: administrator
		? [{ id: 'role-admin', code: 'administrador', name: 'Administrador' }]
		: [{ id: 'role-manager', code: 'gestor-de-cancha', name: 'Gestor de Cancha' }],
	permissions: permissions.map((code, index) => ({ id: `permission-${index}`, code })),
});

const currentRole = (isSystem = false) => ({
	id: ROLE_ID,
	organizationId: ORGANIZATION_ID,
	name: 'Operaciones',
	normalizedName: 'operaciones',
	description: null,
	code: 'operaciones',
	isSystem,
	updatedAt: new Date(UPDATED_AT),
	permissions: [{ permission: { id: PERMISSION_ID, code: 'roles.read' } }],
});

describe('roleService mutations', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.actorHasOrganizationScope.mockResolvedValue(true);
		mocks.findPermissions.mockResolvedValue([{ id: PERMISSION_ID, code: 'roles.read' }]);
		mocks.createRole.mockResolvedValue({ id: ROLE_ID });
		mocks.getDetail.mockResolvedValue({ id: ROLE_ID, permissions: [] });
		mocks.findRole.mockResolvedValue(currentRole());
		mocks.updateRole.mockResolvedValue({ count: 1 });
	});

	it('crea rol, permisos y auditoría dentro de la misma operación', async () => {
		const actor = buildUser({ administrator: true });

		await roleService.createRole(
			ORGANIZATION_ID,
			{ name: 'Gestión de Canchas', description: null, permissionIds: [PERMISSION_ID] },
			actor,
		);

		expect(mocks.createRole).toHaveBeenCalledWith(
			expect.objectContaining({
				organizationId: ORGANIZATION_ID,
				name: 'Gestión de Canchas',
				normalizedName: 'gestión de canchas',
				code: 'gestion-de-canchas',
			}),
		);
		expect(mocks.replacePermissions).toHaveBeenCalledWith(ROLE_ID, [PERMISSION_ID]);
		expect(mocks.writeAudit).toHaveBeenCalledWith(
			expect.objectContaining({
				actorUserId: actor.id,
				organizationId: ORGANIZATION_ID,
				entityId: ROLE_ID,
				action: 'ROLE_CREATED',
			}),
		);
	});

	it('impide que un actor no administrador conceda permisos superiores', async () => {
		const actor = buildUser({ permissions: ['roles.read'] });
		mocks.findPermissions.mockResolvedValue([{ id: PERMISSION_ID, code: 'roles.manage' }]);

		await expect(
			roleService.createRole(
				ORGANIZATION_ID,
				{ name: 'Gestor', description: null, permissionIds: [PERMISSION_ID] },
				actor,
			),
		).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
		expect(mocks.createRole).not.toHaveBeenCalled();
		expect(mocks.writeAudit).not.toHaveBeenCalled();
	});

	it('impide modificar cualquier rol del sistema', async () => {
		mocks.findRole.mockResolvedValue(currentRole(true));

		await expect(
			roleService.updateRole(
				ROLE_ID,
				ORGANIZATION_ID,
				{ name: 'Otro nombre', expectedUpdatedAt: UPDATED_AT },
				buildUser({ administrator: true }),
			),
		).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
		expect(mocks.updateRole).not.toHaveBeenCalled();
	});

	it('responde 409 y no sobrescribe permisos con un snapshot obsoleto', async () => {
		mocks.updateRole.mockResolvedValue({ count: 0 });

		await expect(
			roleService.updateRole(
				ROLE_ID,
				ORGANIZATION_ID,
				{ permissionIds: [PERMISSION_ID], expectedUpdatedAt: UPDATED_AT },
				buildUser({ administrator: true }),
			),
		).rejects.toMatchObject({ statusCode: 409, code: 'CONFLICT' });
		expect(mocks.replacePermissions).not.toHaveBeenCalled();
		expect(mocks.writeAudit).not.toHaveBeenCalled();
	});

	it('reemplaza permisos y audita exactamente las altas y bajas', async () => {
		const nextPermissionId = '123e4567-e89b-42d3-a456-426614174005';
		mocks.findPermissions.mockResolvedValue([{ id: nextPermissionId, code: 'users.read' }]);
		mocks.getDetail.mockResolvedValue({ id: ROLE_ID, permissions: [] });

		await roleService.updateRole(
			ROLE_ID,
			ORGANIZATION_ID,
			{ permissionIds: [nextPermissionId], expectedUpdatedAt: UPDATED_AT },
			buildUser({ administrator: true }),
		);

		expect(mocks.replacePermissions).toHaveBeenCalledWith(ROLE_ID, [nextPermissionId]);
		expect(mocks.writeAudit).toHaveBeenCalledWith(
			expect.objectContaining({
				action: 'ROLE_UPDATED',
				changes: {
					permissionsAdded: ['users.read'],
					permissionsRemoved: ['roles.read'],
				},
			}),
		);
	});

	it('rechaza permisos inexistentes antes de tocar el agregado', async () => {
		mocks.findPermissions.mockResolvedValue([]);

		await expect(
			roleService.updateRole(
				ROLE_ID,
				ORGANIZATION_ID,
				{ permissionIds: [PERMISSION_ID], expectedUpdatedAt: UPDATED_AT },
				buildUser({ administrator: true }),
			),
		).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
		expect(mocks.updateRole).not.toHaveBeenCalled();
		expect(mocks.replacePermissions).not.toHaveBeenCalled();
	});

	it('impide administrar un rol que ya contiene capacidades superiores a las del actor', async () => {
		mocks.findPermissions.mockResolvedValue([{ id: PERMISSION_ID, code: 'roles.read' }]);

		await expect(
			roleService.updateRole(
				ROLE_ID,
				ORGANIZATION_ID,
				{ permissionIds: [PERMISSION_ID], expectedUpdatedAt: UPDATED_AT },
				buildUser({ permissions: ['users.read'] }),
			),
		).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
		expect(mocks.updateRole).not.toHaveBeenCalled();
	});
});
