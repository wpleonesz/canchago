import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	actorHasOrganizationScope: vi.fn(),
	getUnique: vi.fn(),
	getAll: vi.fn(),
	findOrganization: vi.fn(),
	createOrganization: vi.fn(),
	updateOrganization: vi.fn(),
	removeWithCascade: vi.fn(),
	writeAudit: vi.fn(),
	getDetail: vi.fn(),
	isOrganizationUniqueConstraintError: vi.fn(() => false),
}));

vi.mock('@/database/organizaciones-sedes', () => ({
	organizacionDb: {
		getAll: mocks.getAll,
		actorHasOrganizationScope: mocks.actorHasOrganizationScope,
		getUnique: mocks.getUnique,
		isOrganizationUniqueConstraintError: mocks.isOrganizationUniqueConstraintError,
		withTransaction: (operation: (repository: unknown) => Promise<unknown>) =>
			operation({
				findOrganization: mocks.findOrganization,
				createOrganization: mocks.createOrganization,
				updateOrganization: mocks.updateOrganization,
				removeWithCascade: mocks.removeWithCascade,
				writeAudit: mocks.writeAudit,
				getDetail: mocks.getDetail,
			}),
	},
}));

vi.mock('@/services/users/role-guard', () => ({
	isAdministrator: (user: { roles: Array<{ code: string }> }) =>
		user.roles.some(role => role.code === 'administrador'),
}));

import type { SessionUser } from '@/lib/session';

import { create, ensureOrganizationScope, getById, remove, update } from './organizacion.service';

const ORGANIZATION_ID = '123e4567-e89b-42d3-a456-426614174001';
const UPDATED_AT = '2026-08-29T10:00:00.000Z';

const buildUser = ({ administrator = false } = {}): SessionUser => ({
	id: '123e4567-e89b-42d3-a456-426614174004',
	email: 'actor@example.com',
	name: 'Actor',
	roles: administrator
		? [{ id: 'role-admin', code: 'administrador', name: 'Administrador' }]
		: [{ id: 'role-manager', code: 'gestor-de-cancha', name: 'Gestor de Cancha' }],
	permissions: [],
});

describe('organizacionService — alcance por organización (feature 019)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.findOrganization.mockResolvedValue({
			id: ORGANIZATION_ID,
			updatedAt: new Date(UPDATED_AT),
		});
		mocks.updateOrganization.mockResolvedValue({ count: 1 });
		mocks.getDetail.mockResolvedValue({ id: ORGANIZATION_ID });
		mocks.createOrganization.mockResolvedValue({ id: ORGANIZATION_ID, name: 'Cancha Central' });
	});

	it('un administrador global no necesita alcance explícito', async () => {
		mocks.actorHasOrganizationScope.mockResolvedValue(false);

		await expect(
			ensureOrganizationScope(buildUser({ administrator: true }), ORGANIZATION_ID),
		).resolves.toBeUndefined();
		expect(mocks.actorHasOrganizationScope).not.toHaveBeenCalled();
	});

	it('un actor no administrador sin alcance recibe 404 opaco, no 403, cuando opaque=true', async () => {
		mocks.actorHasOrganizationScope.mockResolvedValue(false);

		await expect(getById(ORGANIZATION_ID, buildUser())).rejects.toMatchObject({
			statusCode: 404,
			code: 'NOT_FOUND',
		});
		expect(mocks.getUnique).not.toHaveBeenCalled();
	});

	it('un actor con alcance real puede leer la organización', async () => {
		mocks.actorHasOrganizationScope.mockResolvedValue(true);
		mocks.getUnique.mockResolvedValue({ id: ORGANIZATION_ID });

		await expect(getById(ORGANIZATION_ID, buildUser())).resolves.toEqual({ id: ORGANIZATION_ID });
	});

	it('update responde 409 y no escribe auditoría si expectedUpdatedAt está obsoleto', async () => {
		mocks.actorHasOrganizationScope.mockResolvedValue(true);
		mocks.updateOrganization.mockResolvedValue({ count: 0 });

		await expect(
			update(
				ORGANIZATION_ID,
				{ name: 'Nuevo nombre', expectedUpdatedAt: UPDATED_AT },
				buildUser({ administrator: true }),
			),
		).rejects.toMatchObject({ statusCode: 409, code: 'CONFLICT' });
		expect(mocks.writeAudit).not.toHaveBeenCalled();
	});

	it('update escribe auditoría ORGANIZATION_UPDATED dentro de la transacción al tener éxito', async () => {
		mocks.actorHasOrganizationScope.mockResolvedValue(true);

		await update(
			ORGANIZATION_ID,
			{ name: 'Nuevo nombre', expectedUpdatedAt: UPDATED_AT },
			buildUser({ administrator: true }),
		);

		expect(mocks.writeAudit).toHaveBeenCalledWith(
			expect.objectContaining({
				organizationId: ORGANIZATION_ID,
				entityId: ORGANIZATION_ID,
				action: 'ORGANIZATION_UPDATED',
			}),
		);
	});

	it('create escribe auditoría ORGANIZATION_CREATED con normalizedName derivado del nombre', async () => {
		await create({ name: '  Cancha   Central ' }, buildUser({ administrator: true }));

		expect(mocks.createOrganization).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'Cancha Central', normalizedName: 'cancha central' }),
		);
		expect(mocks.writeAudit).toHaveBeenCalledWith(
			expect.objectContaining({ action: 'ORGANIZATION_CREATED' }),
		);
	});

	it('create mapea el nombre duplicado a un 409 sin exponer el error de Prisma', async () => {
		mocks.isOrganizationUniqueConstraintError.mockReturnValue(true);
		mocks.createOrganization.mockRejectedValue(new Error('P2002'));

		await expect(
			create({ name: 'Cancha Central' }, buildUser({ administrator: true })),
		).rejects.toMatchObject({ statusCode: 409, code: 'CONFLICT' });
	});

	it('remove exige alcance y no elimina una organización fuera de él', async () => {
		mocks.actorHasOrganizationScope.mockResolvedValue(false);

		await expect(remove(ORGANIZATION_ID, buildUser())).rejects.toMatchObject({ statusCode: 404 });
		expect(mocks.removeWithCascade).not.toHaveBeenCalled();
	});
});
