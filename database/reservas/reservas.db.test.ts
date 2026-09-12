import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	findMany: vi.fn(),
	count: vi.fn(),
	bookingFindMany: vi.fn(),
	bookingCount: vi.fn(),
	weekdayDiscountDeleteMany: vi.fn(),
	weekdayDiscountCreateMany: vi.fn(),
	weekdayDiscountFindMany: vi.fn(),
}));

vi.mock('@/database/client', () => ({
	prisma: {
		resource: {
			findMany: mocks.findMany,
			count: mocks.count,
		},
		booking: {
			findMany: mocks.bookingFindMany,
			count: mocks.bookingCount,
		},
		resourceWeekdayDiscount: {
			deleteMany: mocks.weekdayDiscountDeleteMany,
			createMany: mocks.weekdayDiscountCreateMany,
			findMany: mocks.weekdayDiscountFindMany,
		},
		$transaction: (operation: (transaction: unknown) => Promise<unknown>) =>
			operation({
				resourceWeekdayDiscount: {
					deleteMany: mocks.weekdayDiscountDeleteMany,
					createMany: mocks.weekdayDiscountCreateMany,
					findMany: mocks.weekdayDiscountFindMany,
				},
			}),
	},
}));

import { Prisma } from '@/generated/prisma/client';

import {
	applyWeekdayDiscount,
	listOwnBookings,
	listResources,
	replaceWeekdayDiscounts,
} from './index';

describe('listResources — visibilidad por status (feature 023)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.findMany.mockResolvedValue([]);
		mocks.count.mockResolvedValue(0);
	});

	it('por defecto exige ACTIVE en recurso, sede y organización a la vez', async () => {
		await listResources();

		expect(mocks.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					deletedAt: null,
					status: 'ACTIVE',
					venue: expect.objectContaining({
						deletedAt: null,
						status: 'ACTIVE',
						organization: expect.objectContaining({
							deletedAt: null,
							status: 'ACTIVE',
						}),
					}),
				}),
			}),
		);
	});

	it('con includeInactive=true no filtra por status en ningún nivel', async () => {
		await listResources(1, 20, true);

		const { where } = mocks.findMany.mock.calls[0][0];
		expect(where.status).toBeUndefined();
		expect(where.venue.status).toBeUndefined();
		expect(where.venue.organization.status).toBeUndefined();
	});
});

describe('listOwnBookings — no se ve afectado por desactivar la organización/sede (feature 023)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.bookingFindMany.mockResolvedValue([]);
		mocks.bookingCount.mockResolvedValue(0);
	});

	it('solo filtra por userId: una reserva confirmada sigue visible aunque la cancha se desactive después', async () => {
		await listOwnBookings('user-1');

		expect(mocks.bookingFindMany).toHaveBeenCalledWith(
			expect.objectContaining({ where: { userId: 'user-1' } }),
		);
	});
});

describe('applyWeekdayDiscount (feature 025)', () => {
	const hourlyPrice = new Prisma.Decimal('20.00');

	it('sin descuento para ese día, devuelve el precio base sin cambios', () => {
		const result = applyWeekdayDiscount(hourlyPrice, 3, [
			{ weekday: 1, discountPercent: new Prisma.Decimal('15') },
		]);

		expect(result.toString()).toBe('20');
	});

	it('con descuento para ese día, aplica el porcentaje y redondea a 2 decimales', () => {
		const result = applyWeekdayDiscount(hourlyPrice, 1, [
			{ weekday: 1, discountPercent: new Prisma.Decimal('15') },
		]);

		expect(result.toString()).toBe('17');
	});

	it('un descuento del 100% deja el precio en cero', () => {
		const result = applyWeekdayDiscount(hourlyPrice, 1, [
			{ weekday: 1, discountPercent: new Prisma.Decimal('100') },
		]);

		expect(result.toString()).toBe('0');
	});
});

describe('replaceWeekdayDiscounts (feature 025)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.weekdayDiscountFindMany.mockResolvedValue([
			{ weekday: 1, discountPercent: new Prisma.Decimal('15') },
		]);
	});

	it('reemplaza el conjunto completo: borra todo y vuelve a crear solo lo enviado', async () => {
		await replaceWeekdayDiscounts('resource-1', {
			discounts: [{ weekday: 1, discountPercent: 15 }],
		});

		expect(mocks.weekdayDiscountDeleteMany).toHaveBeenCalledWith({
			where: { resourceId: 'resource-1' },
		});
		expect(mocks.weekdayDiscountCreateMany).toHaveBeenCalledWith({
			data: [{ resourceId: 'resource-1', weekday: 1, discountPercent: 15 }],
		});
	});

	it('un conjunto vacío borra los descuentos existentes sin volver a crear nada', async () => {
		await replaceWeekdayDiscounts('resource-1', { discounts: [] });

		expect(mocks.weekdayDiscountDeleteMany).toHaveBeenCalledWith({
			where: { resourceId: 'resource-1' },
		});
		expect(mocks.weekdayDiscountCreateMany).not.toHaveBeenCalled();
	});
});
