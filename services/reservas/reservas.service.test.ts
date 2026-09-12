import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getResource: vi.fn(),
	actorCanManageResource: vi.fn(),
	replaceWeekdayDiscounts: vi.fn(),
	listAvailability: vi.fn(),
	applyWeekdayDiscount: vi.fn(),
	listResources: vi.fn(),
	listOwnBookings: vi.fn(),
}));

vi.mock('@/database/reservas', () => ({
	getResource: mocks.getResource,
	actorCanManageResource: mocks.actorCanManageResource,
	replaceWeekdayDiscounts: mocks.replaceWeekdayDiscounts,
	listAvailability: mocks.listAvailability,
	applyWeekdayDiscount: mocks.applyWeekdayDiscount,
	listResources: mocks.listResources,
	listOwnBookings: mocks.listOwnBookings,
}));

vi.mock('@/services/users/role-guard', () => ({
	isAdministrator: (user: { roles: Array<{ code: string }> }) =>
		user.roles.some(role => role.code === 'administrador'),
}));

import type { SessionUser } from '@/lib/session';

import { listAvailability, updateWeekdayDiscounts } from './index';

const RESOURCE_ID = '123e4567-e89b-42d3-a456-426614174001';

const buildUser = ({ administrator = false } = {}): SessionUser => ({
	id: '123e4567-e89b-42d3-a456-426614174004',
	email: 'actor@example.com',
	name: 'Actor',
	roles: administrator
		? [{ id: 'role-admin', code: 'administrador', name: 'Administrador' }]
		: [{ id: 'role-manager', code: 'gestor-de-cancha', name: 'Gestor de Cancha' }],
	permissions: [],
});

describe('updateWeekdayDiscounts — autorización (feature 025)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getResource.mockResolvedValue({ id: RESOURCE_ID });
	});

	it('un Gestor con alcance real puede reemplazar los descuentos', async () => {
		mocks.actorCanManageResource.mockResolvedValue(true);
		mocks.replaceWeekdayDiscounts.mockResolvedValue([{ weekday: 1, discountPercent: '15' }]);

		const result = await updateWeekdayDiscounts(
			RESOURCE_ID,
			{ discounts: [{ weekday: 1, discountPercent: 15 }] },
			buildUser(),
		);

		expect(mocks.replaceWeekdayDiscounts).toHaveBeenCalledWith(RESOURCE_ID, {
			discounts: [{ weekday: 1, discountPercent: 15 }],
		});
		expect(result).toEqual([{ weekday: 1, discountPercent: '15' }]);
	});

	it('un actor sin alcance recibe 403 y no llega a tocar la base', async () => {
		mocks.actorCanManageResource.mockResolvedValue(false);

		await expect(
			updateWeekdayDiscounts(RESOURCE_ID, { discounts: [] }, buildUser()),
		).rejects.toMatchObject({ statusCode: 403 });
		expect(mocks.replaceWeekdayDiscounts).not.toHaveBeenCalled();
	});

	it('un Administrador no necesita alcance explícito', async () => {
		mocks.actorCanManageResource.mockResolvedValue(false);
		mocks.replaceWeekdayDiscounts.mockResolvedValue([]);

		await expect(
			updateWeekdayDiscounts(RESOURCE_ID, { discounts: [] }, buildUser({ administrator: true })),
		).resolves.toEqual([]);
	});
});

describe('listAvailability — effectiveHourlyPrice por slot (feature 025)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getResource.mockResolvedValue({
			id: RESOURCE_ID,
			hourlyPrice: '20.00',
			weekdayDiscounts: [{ weekday: 1, discountPercent: '15' }],
		});
		mocks.applyWeekdayDiscount.mockReturnValue('17.00');
	});

	it('agrega effectiveHourlyPrice usando el día real de cada franja', async () => {
		const startsAt = new Date('2026-09-14T13:00:00.000Z');
		mocks.listAvailability.mockResolvedValue({
			data: [{ id: 'slot-1', startsAt, bookings: [] }],
			meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
		});

		const result = await listAvailability(
			RESOURCE_ID,
			{ from: '2026-09-14T00:00:00.000Z', to: '2026-09-15T00:00:00.000Z' },
			buildUser({ administrator: true }),
		);

		expect(mocks.applyWeekdayDiscount).toHaveBeenCalledWith('20.00', startsAt.getUTCDay(), [
			{ weekday: 1, discountPercent: '15' },
		]);
		expect(result.data[0]).toMatchObject({ effectiveHourlyPrice: '17.00', isBooked: false });
	});
});
