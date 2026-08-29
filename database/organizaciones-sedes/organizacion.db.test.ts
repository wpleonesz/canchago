import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	findMany: vi.fn(),
	count: vi.fn(),
}));

vi.mock('@/database/client', () => ({
	prisma: {
		organization: {
			findMany: mocks.findMany,
			count: mocks.count,
		},
	},
}));

import { getAll } from './organizacion.db';

describe('organizacionDb.getAll scope', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.findMany.mockResolvedValue([]);
		mocks.count.mockResolvedValue(0);
	});

	it('combina búsqueda y alcance tenant sin reemplazar el filtro de seguridad', async () => {
		await getAll(
			{ search: 'Cancha' },
			{ userId: '123e4567-e89b-42d3-a456-426614174001', isAdministrator: false },
		);

		expect(mocks.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					deletedAt: null,
					OR: expect.any(Array),
					AND: {
						OR: [
							{ name: { contains: 'Cancha', mode: 'insensitive' } },
							{ email: { contains: 'Cancha', mode: 'insensitive' } },
						],
					},
				}),
			}),
		);
	});

	it('pide el conteo de sedes activas en la misma consulta (sin N+1) y lo expone como venuesCount', async () => {
		mocks.findMany.mockResolvedValue([
			{ id: 'org-1', name: 'Cancha 1', _count: { venues: 3 } },
			{ id: 'org-2', name: 'Cancha 2', _count: { venues: 0 } },
		]);

		const result = await getAll(
			{},
			{ userId: '123e4567-e89b-42d3-a456-426614174001', isAdministrator: true },
		);

		expect(mocks.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				select: expect.objectContaining({
					_count: { select: { venues: { where: { deletedAt: null } } } },
				}),
			}),
		);
		expect(result.organizations).toEqual([
			{ id: 'org-1', name: 'Cancha 1', venuesCount: 3 },
			{ id: 'org-2', name: 'Cancha 2', venuesCount: 0 },
		]);
	});
});
