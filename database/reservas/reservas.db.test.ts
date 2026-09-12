import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	findMany: vi.fn(),
	count: vi.fn(),
	bookingFindMany: vi.fn(),
	bookingCount: vi.fn(),
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
	},
}));

import { listOwnBookings, listResources } from './index';

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
