import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	ensureOrganizationScope: vi.fn(),
	getAll: vi.fn(),
	getUnique: vi.fn(),
	findOrganization: vi.fn(),
	findVenue: vi.fn(),
	createVenue: vi.fn(),
	updateVenue: vi.fn(),
	removeVenue: vi.fn(),
	writeAudit: vi.fn(),
	getDetail: vi.fn(),
	isSedeUniqueConstraintError: vi.fn(() => false),
}));

vi.mock('@/database/organizaciones-sedes', () => ({
	sedeDb: {
		getAll: mocks.getAll,
		getUnique: mocks.getUnique,
		isSedeUniqueConstraintError: mocks.isSedeUniqueConstraintError,
		withTransaction: (operation: (repository: unknown) => Promise<unknown>) =>
			operation({
				findOrganization: mocks.findOrganization,
				findVenue: mocks.findVenue,
				createVenue: mocks.createVenue,
				updateVenue: mocks.updateVenue,
				removeVenue: mocks.removeVenue,
				writeAudit: mocks.writeAudit,
				getDetail: mocks.getDetail,
			}),
	},
}));

vi.mock('./organizacion.service', () => ({
	ensureOrganizationScope: mocks.ensureOrganizationScope,
}));

vi.mock('@/services/users/role-guard', () => ({
	isAdministrator: (user: { roles: Array<{ code: string }> }) =>
		user.roles.some(role => role.code === 'administrador'),
}));

import type { SessionUser } from '@/lib/session';

import { create, getById, remove, update } from './sede.service';

const ORGANIZATION_ID = '123e4567-e89b-42d3-a456-426614174001';
const OTHER_ORGANIZATION_ID = '123e4567-e89b-42d3-a456-426614174099';
const VENUE_ID = '123e4567-e89b-42d3-a456-426614174002';
const UPDATED_AT = '2026-08-29T10:00:00.000Z';

const actor: SessionUser = {
	id: '123e4567-e89b-42d3-a456-426614174004',
	email: 'actor@example.com',
	name: 'Actor',
	roles: [{ id: 'role-admin', code: 'administrador', name: 'Administrador' }],
	permissions: [],
};

const buildManagerActor = (): SessionUser => ({
	id: '123e4567-e89b-42d3-a456-426614174005',
	email: 'manager@example.com',
	name: 'Gestor',
	roles: [{ id: 'role-manager', code: 'gestor-de-cancha', name: 'Gestor de Cancha' }],
	permissions: [],
});

describe('sedeService — cierre del IDOR de sede (feature 019)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.ensureOrganizationScope.mockResolvedValue(undefined);
		mocks.findOrganization.mockResolvedValue({ id: ORGANIZATION_ID });
		mocks.findVenue.mockResolvedValue({
			id: VENUE_ID,
			organizationId: ORGANIZATION_ID,
			updatedAt: new Date(UPDATED_AT),
		});
		mocks.updateVenue.mockResolvedValue({ count: 1 });
		mocks.getDetail.mockResolvedValue({ id: VENUE_ID });
		mocks.createVenue.mockResolvedValue({ id: VENUE_ID, name: 'Sede Norte' });
	});

	it('getById valida el alcance de organizationId antes de consultar la sede', async () => {
		mocks.getUnique.mockResolvedValue({ id: VENUE_ID, organizationId: ORGANIZATION_ID });

		await getById(VENUE_ID, ORGANIZATION_ID, actor);

		expect(mocks.ensureOrganizationScope).toHaveBeenCalledWith(actor, ORGANIZATION_ID, true);
		expect(mocks.getUnique).toHaveBeenCalledWith(VENUE_ID, ORGANIZATION_ID);
	});

	it('create verifica que la organización exista antes de crear la sede (404, no 500)', async () => {
		mocks.findOrganization.mockResolvedValue(null);

		await expect(
			create(OTHER_ORGANIZATION_ID, { name: 'Sede Norte' }, actor),
		).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
		expect(mocks.createVenue).not.toHaveBeenCalled();
	});

	it('create no acepta organizationId del payload: siempre usa el de la ruta', async () => {
		await create(ORGANIZATION_ID, { name: 'Sede Norte' }, actor);

		expect(mocks.createVenue).toHaveBeenCalledWith(
			ORGANIZATION_ID,
			expect.not.objectContaining({ organizationId: expect.anything() }),
		);
	});

	it('update busca la sede scoped por organizationId: un venueId de otra organización no se encuentra', async () => {
		mocks.findVenue.mockResolvedValue(null);

		await expect(
			update(
				VENUE_ID,
				OTHER_ORGANIZATION_ID,
				{ name: 'Nuevo nombre', expectedUpdatedAt: UPDATED_AT },
				actor,
			),
		).rejects.toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
		expect(mocks.updateVenue).not.toHaveBeenCalled();
	});

	it('update responde 409 y no audita si expectedUpdatedAt está obsoleto', async () => {
		mocks.updateVenue.mockResolvedValue({ count: 0 });

		await expect(
			update(
				VENUE_ID,
				ORGANIZATION_ID,
				{ name: 'Nuevo nombre', expectedUpdatedAt: UPDATED_AT },
				actor,
			),
		).rejects.toMatchObject({ statusCode: 409, code: 'CONFLICT' });
		expect(mocks.writeAudit).not.toHaveBeenCalled();
	});

	it('remove busca la sede scoped por organizationId antes de borrar', async () => {
		mocks.findVenue.mockResolvedValue(null);

		await expect(remove(VENUE_ID, OTHER_ORGANIZATION_ID, actor)).rejects.toMatchObject({
			statusCode: 404,
		});
		expect(mocks.removeVenue).not.toHaveBeenCalled();
	});
});

describe('sedeService — cambio de estado exclusivo de Administrador (feature 023)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.ensureOrganizationScope.mockResolvedValue(undefined);
		mocks.findVenue.mockResolvedValue({
			id: VENUE_ID,
			organizationId: ORGANIZATION_ID,
			updatedAt: new Date(UPDATED_AT),
		});
		mocks.updateVenue.mockResolvedValue({ count: 1 });
		mocks.getDetail.mockResolvedValue({ id: VENUE_ID });
	});

	it('un Administrador puede cambiar el status de una sede', async () => {
		await update(
			VENUE_ID,
			ORGANIZATION_ID,
			{ status: 'INACTIVE', expectedUpdatedAt: UPDATED_AT },
			actor,
		);

		expect(mocks.updateVenue).toHaveBeenCalledWith(
			VENUE_ID,
			ORGANIZATION_ID,
			expect.any(Date),
			expect.objectContaining({ status: 'INACTIVE' }),
		);
		expect(mocks.writeAudit).toHaveBeenCalledWith(
			expect.objectContaining({
				action: 'VENUE_UPDATED',
				changes: expect.objectContaining({ status: 'INACTIVE' }),
			}),
		);
	});

	it('un Gestor con alcance real recibe 403 al enviar status, sin tocar la base', async () => {
		await expect(
			update(
				VENUE_ID,
				ORGANIZATION_ID,
				{ status: 'INACTIVE', expectedUpdatedAt: UPDATED_AT },
				buildManagerActor(),
			),
		).rejects.toMatchObject({ statusCode: 403 });
		expect(mocks.updateVenue).not.toHaveBeenCalled();
		expect(mocks.writeAudit).not.toHaveBeenCalled();
	});

	it('un Gestor puede seguir editando otros campos sin enviar status', async () => {
		await expect(
			update(
				VENUE_ID,
				ORGANIZATION_ID,
				{ name: 'Nuevo nombre', expectedUpdatedAt: UPDATED_AT },
				buildManagerActor(),
			),
		).resolves.toEqual({ id: VENUE_ID });
	});
});
