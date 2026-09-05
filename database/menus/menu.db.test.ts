import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	findMany: vi.fn(),
	count: vi.fn(),
}));

vi.mock('@/database/client', () => ({
	prisma: {
		menu: {
			findMany: mocks.findMany,
			count: mocks.count,
		},
	},
}));

import { menuDb } from './menu.db';

describe('menuDb.getMenus', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.findMany.mockResolvedValue([]);
		mocks.count.mockResolvedValue(0);
	});

	it('pagina con los límites normalizados y ordena por jerarquía y nombre', async () => {
		await menuDb.getMenus(1, 20);

		expect(mocks.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				skip: 0,
				take: 20,
				orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
			}),
		);
	});

	it('aplana cada menú con sus códigos de permiso asociados, sin exponer el objeto Permission completo', async () => {
		mocks.findMany.mockResolvedValue([
			{
				id: 'menu-1',
				code: 'roles',
				name: 'Roles',
				route: '/admin/roles',
				parentId: 'group-1',
				permissions: [{ permission: { code: 'roles.read' } }],
			},
		]);
		mocks.count.mockResolvedValue(1);

		const result = await menuDb.getMenus(1, 20);

		expect(result.menus).toEqual([
			{
				id: 'menu-1',
				code: 'roles',
				name: 'Roles',
				route: '/admin/roles',
				parentId: 'group-1',
				permissions: ['roles.read'],
			},
		]);
		expect(result.meta).toEqual({ page: 1, pageSize: 20, total: 1, totalPages: 1 });
	});

	it('devuelve un catálogo vacío como data vacía, no como error', async () => {
		const result = await menuDb.getMenus(1, 20);

		expect(result.menus).toEqual([]);
		expect(result.meta.total).toBe(0);
	});
});
