import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	findMany: vi.fn(),
	count: vi.fn(),
	venueFindFirst: vi.fn(),
	organizationFindFirst: vi.fn(),
	venueCreate: vi.fn(),
	venueUpdateMany: vi.fn(),
	auditLogCreate: vi.fn(),
}));

vi.mock('@/database/client', () => ({
	prisma: {
		venue: {
			findMany: mocks.findMany,
			count: mocks.count,
		},
		$transaction: (operation: (transaction: unknown) => unknown) =>
			operation({
				venue: {
					findFirst: mocks.venueFindFirst,
					create: mocks.venueCreate,
					updateMany: mocks.venueUpdateMany,
					findFirstOrThrow: mocks.venueFindFirst,
				},
				organization: {
					findFirst: mocks.organizationFindFirst,
				},
				auditLog: {
					create: mocks.auditLogCreate,
				},
			}),
	},
}));

import { getAll, withTransaction } from './sede.db';

describe('sedeDb.getAll', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.findMany.mockResolvedValue([]);
		mocks.count.mockResolvedValue(0);
	});

	it('filtra siempre por organizationId, nunca solo por deletedAt', async () => {
		await getAll('org-1', {});

		expect(mocks.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { organizationId: 'org-1', deletedAt: null },
			}),
		);
	});
});

describe('sedeDb transaction repository — cierre del IDOR de sede (feature 019)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('findVenue exige que la sede pertenezca a organizationId, no solo que exista por id', async () => {
		await withTransaction(async repository => {
			await repository.findVenue('venue-1', 'org-1');
		});

		expect(mocks.venueFindFirst).toHaveBeenCalledWith({
			where: { id: 'venue-1', organizationId: 'org-1', deletedAt: null },
			select: expect.any(Object),
		});
	});

	it('createVenue verifica que la organización exista antes de crear la sede', async () => {
		mocks.organizationFindFirst.mockResolvedValue(null);

		let organizationLookup: unknown;
		await withTransaction(async repository => {
			organizationLookup = await repository.findOrganization('org-inexistente');
		});

		expect(organizationLookup).toBeNull();
		expect(mocks.organizationFindFirst).toHaveBeenCalledWith({
			where: { id: 'org-inexistente', deletedAt: null },
			select: { id: true },
		});
	});

	it('updateVenue y removeVenue exigen organizationId en el where, no solo el id de la sede', async () => {
		await withTransaction(async repository => {
			await repository.updateVenue('venue-1', 'org-1', new Date('2026-08-29T10:00:00.000Z'), {
				name: 'Nuevo nombre',
			});
			await repository.removeVenue('venue-1', 'org-1');
		});

		expect(mocks.venueUpdateMany).toHaveBeenCalledWith({
			where: {
				id: 'venue-1',
				organizationId: 'org-1',
				updatedAt: new Date('2026-08-29T10:00:00.000Z'),
				deletedAt: null,
			},
			data: { name: 'Nuevo nombre' },
		});
		expect(mocks.venueUpdateMany).toHaveBeenCalledWith({
			where: { id: 'venue-1', organizationId: 'org-1', deletedAt: null },
			data: { deletedAt: expect.any(Date) },
		});
	});
});
