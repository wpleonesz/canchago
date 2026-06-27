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

	return {
		id: user.id,
		email: user.email,
		firstName: user.profile?.firstName ?? '',
		lastName: user.profile?.lastName ?? '',
		active: user.status === 'ACTIVE',
		createdAt: user.createdAt,
	};
};

export const getById = async (userId: string) => {
	const user = await userData.record(userId).getUnique();

	if (!user) {
		throw new NotFoundError('User not found');
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
		throw new NotFoundError('User not found');
	}

	try {
		const user = await userData.record(userId).update(body);

		return {
			id: user.id,
			email: user.email,
			firstName: user.profile?.firstName ?? '',
			lastName: user.profile?.lastName ?? '',
			active: user.status === 'ACTIVE',
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,
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
		throw new NotFoundError('User not found');
	}

	await userData.record(userId).remove();
};
