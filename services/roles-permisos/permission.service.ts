import { permissionDb } from '@/database/roles-permisos/permission.db';

export const permissionService = {
	async getPermissions(page: number, pageSize: number) {
		return permissionDb.getPermissions(page, pageSize);
	},

	async getPermissionsByRole(roleId: string) {
		return permissionDb.getPermissionsByRole(roleId);
	},

	async validatePermissionIds(permissionIds: string[]) {
		if (permissionIds.length === 0) return [];

		const permissions = await permissionDb.getPermissionsByIds(permissionIds);

		if (permissions.length !== permissionIds.length) {
			throw new Error('One or more permission IDs are invalid');
		}

		return permissions;
	},

	async getAllPermissions() {
		return permissionDb.getAllPermissions();
	},
};
