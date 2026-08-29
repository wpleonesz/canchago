import { permissionDb } from '@/database/roles-permisos/permission.db';
import { ValidationError } from '@/errors';

export const permissionService = {
	getPermissions: (page: number, pageSize: number, search?: string, module?: string) =>
		permissionDb.getPermissions(page, pageSize, search, module),

	getPermissionsByRole: (roleId: string) => permissionDb.getPermissionsByRole(roleId),

	async validatePermissionIds(permissionIds: string[]) {
		if (permissionIds.length === 0) return [];
		const permissions = await permissionDb.getPermissionsByIds(permissionIds);

		if (permissions.length !== permissionIds.length) {
			throw new ValidationError('Uno o más permisos no existen o ya no están disponibles.');
		}

		return permissions;
	},

	getAllPermissions: () => permissionDb.getAllPermissions(),
};
