import { prisma } from '@/database/client';

export const rolePermissionDb = {
	async assignPermissionsToRole(roleId: string, permissionIds: string[]) {
		return prisma.$transaction(async tx => {
			await tx.rolePermission.deleteMany({
				where: { roleId },
			});

			if (permissionIds.length === 0) {
				return [];
			}

			return tx.rolePermission.createMany({
				data: permissionIds.map(permissionId => ({
					roleId,
					permissionId,
					granted: true,
				})),
			});
		});
	},

	async removePermissionFromRole(roleId: string, permissionId: string) {
		return prisma.rolePermission.delete({
			where: {
				roleId_permissionId: {
					roleId,
					permissionId,
				},
			},
		});
	},

	async hasRolePermission(roleId: string, permissionId: string) {
		return prisma.rolePermission.findUnique({
			where: {
				roleId_permissionId: {
					roleId,
					permissionId,
				},
			},
		});
	},
};
