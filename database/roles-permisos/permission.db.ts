import { prisma } from '@/database/client';

export const permissionDb = {
	async getPermissions(page: number, pageSize: number) {
		const skip = (page - 1) * pageSize;

		const [permissions, total] = await Promise.all([
			prisma.permission.findMany({
				skip,
				take: pageSize,
				orderBy: { createdAt: 'desc' },
			}),
			prisma.permission.count(),
		]);

		return {
			permissions,
			total,
			page,
			pageSize,
		};
	},

	async getPermissionsByRole(roleId: string) {
		const rolePermissions = await prisma.rolePermission.findMany({
			where: { roleId },
			include: { permission: true },
		});

		return rolePermissions.map(rp => rp.permission);
	},

	async getPermissionsByIds(permissionIds: string[]) {
		return prisma.permission.findMany({
			where: {
				id: { in: permissionIds },
			},
		});
	},

	async getAllPermissions() {
		return prisma.permission.findMany({
			orderBy: { code: 'asc' },
		});
	},
};
