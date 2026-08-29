import type { Prisma } from '@/generated/prisma/client';
import { Prisma as PrismaClient } from '@/generated/prisma/client';

import { prisma } from '@/database/client';
import type { RoleListQuery } from '@/validations/roles-permisos/role.validation';

const roleListSelect = {
	id: true,
	name: true,
	description: true,
	code: true,
	isSystem: true,
	createdAt: true,
	updatedAt: true,
	_count: { select: { permissions: true } },
} satisfies Prisma.RoleSelect;

const roleDetailSelect = {
	id: true,
	organizationId: true,
	name: true,
	description: true,
	code: true,
	isSystem: true,
	createdAt: true,
	updatedAt: true,
	permissions: {
		where: { granted: true },
		orderBy: { permission: { code: 'asc' } },
		select: {
			granted: true,
			permission: {
				select: {
					id: true,
					module: true,
					action: true,
					code: true,
					description: true,
					createdAt: true,
				},
			},
		},
	},
} satisfies Prisma.RoleSelect;

const roleMutationSelect = {
	id: true,
	organizationId: true,
	name: true,
	normalizedName: true,
	description: true,
	code: true,
	isSystem: true,
	updatedAt: true,
	permissions: {
		where: { granted: true },
		select: { permission: { select: { id: true, code: true } } },
	},
} satisfies Prisma.RoleSelect;

type RoleTransactionClient = Prisma.TransactionClient;

const createTransactionRepository = (transaction: RoleTransactionClient) => ({
	findRole: (roleId: string, organizationId: string) =>
		transaction.role.findFirst({
			where: { id: roleId, organizationId, deletedAt: null },
			select: roleMutationSelect,
		}),

	findPermissions: (permissionIds: string[]) =>
		transaction.permission.findMany({
			where: { id: { in: permissionIds } },
			select: { id: true, code: true },
		}),

	createRole: (data: {
		organizationId: string;
		name: string;
		normalizedName: string;
		code: string;
		description: string | null;
	}) =>
		transaction.role.create({
			data: { ...data, isSystem: false },
			select: { id: true },
		}),

	updateRole: (
		roleId: string,
		organizationId: string,
		expectedUpdatedAt: Date,
		data: Prisma.RoleUpdateManyMutationInput,
	) =>
		transaction.role.updateMany({
			where: {
				id: roleId,
				organizationId,
				updatedAt: expectedUpdatedAt,
				deletedAt: null,
			},
			data,
		}),

	replacePermissions: async (roleId: string, permissionIds: string[]): Promise<void> => {
		await transaction.rolePermission.deleteMany({ where: { roleId } });

		if (permissionIds.length > 0) {
			await transaction.rolePermission.createMany({
				data: permissionIds.map(permissionId => ({ roleId, permissionId, granted: true })),
			});
		}
	},

	writeAudit: (data: {
		actorUserId: string;
		organizationId: string;
		entityId: string;
		action: 'ROLE_CREATED' | 'ROLE_UPDATED';
		changes: Prisma.InputJsonValue;
	}) =>
		transaction.auditLog.create({
			data: {
				...data,
				entityType: 'Role',
			},
		}),

	getDetail: (roleId: string, organizationId: string) =>
		transaction.role.findFirstOrThrow({
			where: { id: roleId, organizationId, deletedAt: null },
			select: roleDetailSelect,
		}),

	softDelete: (roleId: string) =>
		transaction.role.update({ where: { id: roleId }, data: { deletedAt: new Date() } }),
});

export type RoleTransactionRepository = ReturnType<typeof createTransactionRepository>;

export const isRoleUniqueConstraintError = (
	error: unknown,
): error is PrismaClient.PrismaClientKnownRequestError =>
	error instanceof PrismaClient.PrismaClientKnownRequestError && error.code === 'P2002';

export const roleDb = {
	async getRoles(filters: RoleListQuery) {
		const skip = (filters.page - 1) * filters.pageSize;
		const where: Prisma.RoleWhereInput = {
			organizationId: filters.organizationId,
			deletedAt: null,
			...(filters.isSystem !== undefined ? { isSystem: filters.isSystem } : {}),
			...(filters.search
				? {
						OR: [
							{ name: { contains: filters.search, mode: 'insensitive' as const } },
							{ code: { contains: filters.search, mode: 'insensitive' as const } },
							{ description: { contains: filters.search, mode: 'insensitive' as const } },
						],
					}
				: {}),
		};

		const [roles, total] = await Promise.all([
			prisma.role.findMany({
				where,
				skip,
				take: filters.pageSize,
				orderBy: { [filters.orderBy]: filters.order },
				select: roleListSelect,
			}),
			prisma.role.count({ where }),
		]);

		return { roles, total, page: filters.page, pageSize: filters.pageSize };
	},

	getRoleById: (roleId: string, organizationId: string) =>
		prisma.role.findFirst({
			where: { id: roleId, organizationId, deletedAt: null },
			select: roleDetailSelect,
		}),

	async actorHasOrganizationScope(userId: string, organizationId: string): Promise<boolean> {
		const assignments = await prisma.userRole.count({
			where: {
				userId,
				role: { deletedAt: null },
				OR: [{ organizationId }, { role: { organizationId } }],
			},
		});

		return assignments > 0;
	},

	async getRolePermissions(roleId: string, organizationId: string, page: number, pageSize: number) {
		const role = await prisma.role.findFirst({
			where: { id: roleId, organizationId, deletedAt: null },
			select: { id: true },
		});

		if (!role) return null;

		const where: Prisma.RolePermissionWhereInput = { roleId, granted: true };
		const [rows, total] = await Promise.all([
			prisma.rolePermission.findMany({
				where,
				skip: (page - 1) * pageSize,
				take: pageSize,
				orderBy: { permission: { code: 'asc' } },
				select: { permission: true },
			}),
			prisma.rolePermission.count({ where }),
		]);

		return { permissions: rows.map(row => row.permission), total, page, pageSize };
	},

	withTransaction: <T>(operation: (repository: RoleTransactionRepository) => Promise<T>) =>
		prisma.$transaction(transaction => operation(createTransactionRepository(transaction))),
};
