import type { Prisma } from '@/generated/prisma/client';

import { prisma } from '@/database/client';

export const ROLE_ESCAPE = ['name', 'description'];

export const roleDb = {
	async getRoles(organizationId: string, page: number, pageSize: number) {
		const skip = (page - 1) * pageSize;

		const [roles, total] = await Promise.all([
			prisma.role.findMany({
				where: {
					organizationId,
					deletedAt: null,
				},
				skip,
				take: pageSize,
				orderBy: { createdAt: 'desc' },
				select: {
					id: true,
					name: true,
					description: true,
					code: true,
					isSystem: true,
					createdAt: true,
					updatedAt: true,
					_count: { select: { permissions: true } },
				},
			}),
			prisma.role.count({
				where: {
					organizationId,
					deletedAt: null,
				},
			}),
		]);

		return {
			roles,
			total,
			page,
			pageSize,
		};
	},

	async getRoleById(roleId: string, organizationId: string) {
		return prisma.role.findFirst({
			where: {
				id: roleId,
				organizationId,
				deletedAt: null,
			},
			include: {
				permissions: {
					include: { permission: true },
				},
			},
		});
	},

	async createRole(data: Prisma.RoleUncheckedCreateInput) {
		return prisma.role.create({
			data,
			include: {
				permissions: {
					include: { permission: true },
				},
			},
		});
	},

	async updateRole(roleId: string, data: Prisma.RoleUncheckedUpdateInput) {
		return prisma.role.update({
			where: { id: roleId },
			data,
			include: {
				permissions: {
					include: { permission: true },
				},
			},
		});
	},

	async deleteRole(roleId: string) {
		return prisma.$transaction(async tx => {
			await tx.rolePermission.deleteMany({
				where: { roleId },
			});

			return tx.role.update({
				where: { id: roleId },
				data: { deletedAt: new Date() },
			});
		});
	},

	async checkRoleExists(roleId: string, organizationId: string) {
		return prisma.role.findFirst({
			where: {
				id: roleId,
				organizationId,
				deletedAt: null,
			},
		});
	},
};
