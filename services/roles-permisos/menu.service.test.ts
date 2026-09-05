import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getMenus: vi.fn(),
}));

vi.mock('@/database/menus/menu.db', () => ({
	menuDb: { getMenus: mocks.getMenus },
}));

import { menuService } from './menu.service';

describe('menuService.getMenus', () => {
	it('delega en la capa de base de datos con la paginación recibida', async () => {
		mocks.getMenus.mockResolvedValue({
			menus: [],
			meta: { page: 2, pageSize: 10, total: 0, totalPages: 0 },
		});

		const result = await menuService.getMenus(2, 10);

		expect(mocks.getMenus).toHaveBeenCalledWith(2, 10);
		expect(result.menus).toEqual([]);
	});
});
