import type { Prisma } from '@/generated/prisma/client';

import { prisma } from '@/database/client';

export const permissionDb = {
	async getPermissions(page: number, pageSize: number, search?: string, module?: string) {
		const where: Prisma.PermissionWhereInput = {
			...(module ? { module } : {}),
			...(search
				? {
						OR: [
							{ code: { contains: search, mode: 'insensitive' as const } },
							{ description: { contains: search, mode: 'insensitive' as const } },
						],
					}
				: {}),
		};

		const [permissions, total] = await Promise.all([
			prisma.permission.findMany({
				where,
				skip: (page - 1) * pageSize,
				take: pageSize,
				orderBy: [{ module: 'asc' }, { action: 'asc' }, { code: 'asc' }],
			}),
			prisma.permission.count({ where }),
		]);

		return { permissions, total, page, pageSize };
	},

	getPermissionsByRole: (roleId: string) =>
		prisma.rolePermission
			.findMany({
				where: { roleId, granted: true },
				select: { permission: true },
				orderBy: { permission: { code: 'asc' } },
			})
			.then(rows => rows.map(row => row.permission)),

	getPermissionsByIds: (permissionIds: string[]) =>
		prisma.permission.findMany({ where: { id: { in: permissionIds } } }),

	getAllPermissions: () => prisma.permission.findMany({ orderBy: { code: 'asc' } }),
};
