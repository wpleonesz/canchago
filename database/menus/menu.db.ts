import type { Prisma } from '@/generated/prisma/client';

import { prisma } from '@/database/client';
import { normalizePagination } from '@/helper/pagination';

type PaginationMeta = {
	page: number;
	pageSize: number;
	total: number;
	totalPages: number;
};

const menuSelect = {
	id: true,
	code: true,
	name: true,
	route: true,
	parentId: true,
	permissions: {
		select: {
			permission: { select: { code: true } },
		},
	},
} satisfies Prisma.MenuSelect;

export type MenuRecord = {
	id: string;
	code: string;
	name: string;
	route: string | null;
	parentId: string | null;
	permissions: string[];
};

export const menuDb = {
	async getMenus(
		page: number,
		pageSize: number,
	): Promise<{ menus: MenuRecord[]; meta: PaginationMeta }> {
		const { skip, take, meta } = normalizePagination({ page, pageSize });

		const [menus, total] = await Promise.all([
			prisma.menu.findMany({
				select: menuSelect,
				skip,
				take,
				orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
			}),
			prisma.menu.count(),
		]);

		return {
			menus: menus.map(menu => ({
				id: menu.id,
				code: menu.code,
				name: menu.name,
				route: menu.route,
				parentId: menu.parentId,
				permissions: menu.permissions.map(({ permission }) => permission.code),
			})),
			meta: meta(total),
		};
	},
};
