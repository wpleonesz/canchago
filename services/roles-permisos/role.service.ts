import { roleDb } from '@/database/roles-permisos/role.db';
import { rolePermissionDb } from '@/database/roles-permisos/role-permission.db';
import { prisma } from '@/database/client';
import type {
	CreateRoleInput,
	UpdateRoleInput,
} from '@/validations/roles-permisos/role.validation';

export const roleService = {
	async createRole(input: CreateRoleInput) {
		const existing = await prisma.role.findFirst({
			where: {
				organizationId: input.organizationId,
				name: input.name,
				deletedAt: null,
			},
		});

		if (existing) {
			throw new Error(`Role '${input.name}' already exists in this organization`);
		}

		const role = await roleDb.createRole({
			organizationId: input.organizationId,
			name: input.name,
			description: input.description || null,
			code: input.name.toLowerCase().replace(/\s+/g, '-'),
			isSystem: false,
		});

		if (input.permissionIds && input.permissionIds.length > 0) {
			await rolePermissionDb.assignPermissionsToRole(role.id, input.permissionIds);
		}

		return roleDb.getRoleById(role.id, input.organizationId);
	},

	async updateRole(roleId: string, organizationId: string, input: UpdateRoleInput) {
		const role = await roleDb.checkRoleExists(roleId, organizationId);

		if (!role) {
			throw new Error('Role not found');
		}

		if (input.name) {
			const existing = await prisma.role.findFirst({
				where: {
					organizationId,
					name: input.name,
					deletedAt: null,
					NOT: { id: roleId },
				},
			});

			if (existing) {
				throw new Error(`Role '${input.name}' already exists in this organization`);
			}
		}

		const updateData: Record<string, unknown> = {};

		if (input.name !== undefined) updateData.name = input.name;
		if (input.description !== undefined) updateData.description = input.description;

		await roleDb.updateRole(roleId, updateData);

		if (input.permissionIds !== undefined) {
			await rolePermissionDb.assignPermissionsToRole(roleId, input.permissionIds);
		}

		return roleDb.getRoleById(roleId, organizationId);
	},

	async deleteRole(roleId: string, organizationId: string) {
		const role = await roleDb.checkRoleExists(roleId, organizationId);

		if (!role) {
			throw new Error('Role not found');
		}

		return roleDb.deleteRole(roleId);
	},

	async getRoles(organizationId: string, page: number, pageSize: number) {
		return roleDb.getRoles(organizationId, page, pageSize);
	},

	async getRoleById(roleId: string, organizationId: string) {
		const role = await roleDb.getRoleById(roleId, organizationId);

		if (!role) {
			throw new Error('Role not found');
		}

		return role;
	},
};
