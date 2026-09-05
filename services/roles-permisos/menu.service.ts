import { menuDb } from '@/database/menus/menu.db';

export const menuService = {
	getMenus: (page: number, pageSize: number) => menuDb.getMenus(page, pageSize),
};
