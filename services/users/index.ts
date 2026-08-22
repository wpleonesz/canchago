import * as userData from '@/database/users';
import { BusinessRuleError } from '@/errors/business-rule-error';
import { ConflictError } from '@/errors/conflict-error';
import { NotFoundError } from '@/errors/not-found-error';
import type { SessionUser } from '@/lib/session';
import type { CreateUserBody, UpdateUserBody, UserQueryParams } from '@/validations/users';

import { assertCanAssignRoles } from './role-guard';

type AssignableRole = Awaited<ReturnType<typeof userData.getAssignableRoles>>[number];

const validateAssignableRoles = async (
	roleIds: string[],
	organizationId?: string,
): Promise<AssignableRole[]> => {
	const uniqueRoleIds = [...new Set(roleIds)];
	const roles = await userData.getAssignableRoles(uniqueRoleIds);

	if (roles.length !== uniqueRoleIds.length) {
		throw new BusinessRuleError('Uno o más roles no existen o ya no están activos.');
	}

	if (
		organizationId &&
		roles.some(role => role.organizationId !== null && role.organizationId !== organizationId)
	) {
		throw new BusinessRuleError('Todos los roles deben pertenecer a la organización indicada.');
	}

	return roles;
};

export const getAll = async (query: UserQueryParams) => {
	const { users, meta } = await userData.getAll(query);
	return {
		data: users.map(user => ({
			id: user.id,
			email: user.email,
			firstName: user.profile?.firstName ?? '',
			lastName: user.profile?.lastName ?? '',
			active: user.status === 'ACTIVE',
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,
		})),
		meta,
	};
};

export const create = async (body: CreateUserBody, actingUser: SessionUser) => {
	if (body.roleIds) {
		await assertCanAssignRoles(actingUser, body.roleIds);
		await validateAssignableRoles(body.roleIds, body.organizationId);
	}

	const userWithRoles = await userData.createWithRoles(body);

	return {
		id: userWithRoles.id,
		email: userWithRoles.email,
		firstName: userWithRoles.profile?.firstName ?? '',
		lastName: userWithRoles.profile?.lastName ?? '',
		active: userWithRoles.status === 'ACTIVE',
		roles: userWithRoles.userRoles.map(ur => ur.role),
		createdAt: userWithRoles.createdAt,
	};
};

export const getById = async (userId: string) => {
	const user = await userData.record(userId).getUnique();

	if (!user) {
		throw new NotFoundError('El usuario solicitado no existe.');
	}

	return {
		id: user.id,
		email: user.email,
		firstName: user.profile?.firstName ?? '',
		lastName: user.profile?.lastName ?? '',
		active: user.status === 'ACTIVE',
		roles: user.userRoles.map(ur => ur.role),
		createdAt: user.createdAt,
		updatedAt: user.updatedAt,
	};
};

export const update = async (userId: string, body: UpdateUserBody, actingUser: SessionUser) => {
	const existing = await userData.record(userId).getUnique();

	if (!existing) {
		throw new NotFoundError('El usuario solicitado no existe.');
	}

	if (body.roleIds !== undefined) {
		await assertCanAssignRoles(actingUser, body.roleIds);
	}

	try {
		const roles =
			body.roleIds === undefined
				? undefined
				: await validateAssignableRoles(body.roleIds, body.organizationId);
		const userWithRoles = await userData.updateWithRoles(userId, body, roles);

		return {
			id: userWithRoles.id,
			email: userWithRoles.email,
			firstName: userWithRoles.profile?.firstName ?? '',
			lastName: userWithRoles.profile?.lastName ?? '',
			active: userWithRoles.status === 'ACTIVE',
			roles: userWithRoles.userRoles.map(ur => ur.role),
			createdAt: userWithRoles.createdAt,
			updatedAt: userWithRoles.updatedAt,
		};
	} catch (error) {
		if (error instanceof ConflictError) {
			throw error;
		}

		throw error;
	}
};

export const remove = async (userId: string) => {
	const existing = await userData.record(userId).getUnique();

	if (!existing) {
		throw new NotFoundError('El usuario solicitado no existe.');
	}

	await userData.record(userId).remove();
};

export const userService = {
	getAll,
	create,
	getById,
	update,
	remove,
	getRolesByUserId: userData.getRolesByUserId,
	assignRolesToUser: async (
		userId: string,
		roleIds: string[],
		actingUser: SessionUser,
		organizationId?: string,
	): Promise<void> => {
		await assertCanAssignRoles(actingUser, roleIds);
		const roles = await validateAssignableRoles(roleIds, organizationId);
		await userData.assignRolesToUser(userId, roles);
	},
	addRolesToUser: async (
		userId: string,
		roleIds: string[],
		actingUser: SessionUser,
	): Promise<void> => {
		await assertCanAssignRoles(actingUser, roleIds);
		const roles = await validateAssignableRoles(roleIds);
		await userData.addRolesToUser(userId, roles);
	},
	addRoleToUser: userData.addRoleToUser,
	removeRoleFromUser: async (userId: string, roleId: string): Promise<void> => {
		const removed = await userData.removeRoleFromUser(userId, roleId);

		if (!removed) {
			throw new NotFoundError('El rol no está asignado al usuario.');
		}
	},
	assertCanAssignRoles,
};
