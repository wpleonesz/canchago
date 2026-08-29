import { prisma } from '@/database/client';

// Compatibilidad para consumidores existentes. Las mutaciones de la feature 018 usan la
// transacción exterior expuesta por roleDb y no estas operaciones independientes.
export const rolePermissionDb = {
	async assignPermissionsToRole(roleId: string, permissionIds: string[]) {
		return prisma.$transaction(async transaction => {
			await transaction.rolePermission.deleteMany({ where: { roleId } });
			if (permissionIds.length === 0) return [];

			return transaction.rolePermission.createMany({
				data: permissionIds.map(permissionId => ({ roleId, permissionId, granted: true })),
			});
		});
	},

	removePermissionFromRole: (roleId: string, permissionId: string) =>
		prisma.rolePermission.delete({
			where: { roleId_permissionId: { roleId, permissionId } },
		}),

	hasRolePermission: (roleId: string, permissionId: string) =>
		prisma.rolePermission.findUnique({
			where: { roleId_permissionId: { roleId, permissionId } },
		}),
};
