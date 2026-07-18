import * as userData from '@/database/users';
import { ConflictError } from '@/errors/conflict-error';
import { NotFoundError } from '@/errors/not-found-error';
import type { CreateUserBody, UpdateUserBody, UserQueryParams } from '@/validations/users';

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

export const create = async (body: CreateUserBody) => {
	const user = await userData.create(body);

	if (body.roleIds && body.roleIds.length > 0) {
		await userData.assignRolesToUser(user.id, body.roleIds);
	}

	const userWithRoles = await userData.record(user.id).getUnique();

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

export const update = async (userId: string, body: UpdateUserBody) => {
	const existing = await userData.record(userId).getUnique();

	if (!existing) {
		throw new NotFoundError('El usuario solicitado no existe.');
	}

	try {
		const user = await userData.record(userId).update(body);

		if (body.roleIds !== undefined) {
			await userData.assignRolesToUser(user.id, body.roleIds);
		}

		const userWithRoles = await userData.record(user.id).getUnique();

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
	assignRolesToUser: userData.assignRolesToUser,
	addRoleToUser: userData.addRoleToUser,
	removeRoleFromUser: userData.removeRoleFromUser,
};
