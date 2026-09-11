import * as userData from '@/database/users';
import { AuthorizationError } from '@/errors/auth';
import { BusinessRuleError } from '@/errors/business-rule-error';
import { ConflictError } from '@/errors/conflict-error';
import { NotFoundError } from '@/errors/not-found-error';
import type { SessionUser } from '@/lib/session';
import { normalizeAvatar } from '@/lib/images/avatar';
import type {
	CreateUserBody,
	UpdateAdminUserProfileBody,
	UpdateOwnAvatarBody,
	UpdateOwnProfileBody,
	UpdateUserBody,
	UserQueryParams,
} from '@/validations/users';

import { assertCanAssignRoles, isAdministrator } from './role-guard';

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

	if (roles.some(role => role.organizationId !== null && !organizationId)) {
		throw new BusinessRuleError('La organización es obligatoria para los roles de organización.');
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
	let roles: AssignableRole[] = [];
	if (body.roleIds) {
		await assertCanAssignRoles(actingUser, body.roleIds);
		roles = await validateAssignableRoles(body.roleIds, body.organizationId);
	}

	const userWithRoles = await userData.createWithRoles(body, roles);

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

const mapAdminProfile = (
	user: NonNullable<Awaited<ReturnType<typeof userData.getAdminProfile>>>,
) => {
	if (!user.profile) {
		throw new NotFoundError('El perfil del usuario solicitado no existe.');
	}

	return {
		id: user.id,
		email: user.email,
		firstName: user.profile.firstName,
		lastName: user.profile.lastName,
		active: user.status === 'ACTIVE',
		profileUpdatedAt: user.profile.updatedAt,
	};
};

export const getAdminProfile = async (userId: string) => {
	const user = await userData.getAdminProfile(userId);

	if (!user) {
		throw new NotFoundError('El usuario solicitado no existe.');
	}

	return mapAdminProfile(user);
};

export const updateAdminProfile = async (
	userId: string,
	body: UpdateAdminUserProfileBody,
	actingUser: SessionUser,
) => {
	const result = await userData.updateAdminProfile(userId, body, isAdministrator(actingUser));

	if (result.outcome === 'UPDATED') {
		return mapAdminProfile(result.user);
	}

	if (result.outcome === 'NOT_FOUND') {
		throw new NotFoundError('El usuario o su perfil no existe.');
	}

	if (result.outcome === 'INACTIVE') {
		throw new ConflictError('No se puede editar el perfil de un usuario inactivo.');
	}

	if (result.outcome === 'SYSTEM_ROLE') {
		throw new AuthorizationError('No tienes permiso para editar un usuario de sistema.');
	}

	if (result.outcome === 'CONFLICT') {
		throw new ConflictError(
			'El perfil fue modificado por otra persona. Recarga los datos antes de guardar.',
		);
	}

	throw new ConflictError('No fue posible actualizar el perfil.');
};

const mapOwnProfile = (
	profile: NonNullable<Awaited<ReturnType<typeof userData.getOwnProfile>>>,
) => ({
	phone: profile.phone,
	facebookUrl: profile.facebookUrl,
	instagramUrl: profile.instagramUrl,
	linkedinUrl: profile.linkedinUrl,
	xUrl: profile.xUrl,
	githubUrl: profile.githubUrl,
	tiktokUrl: profile.tiktokUrl,
	websiteUrl: profile.websiteUrl,
	hasAvatar: profile.avatarMimeType === 'image/webp',
	avatarUpdatedAt: profile.avatarUpdatedAt,
	profileUpdatedAt: profile.updatedAt,
});

export const getOwnProfile = async (userId: string) => {
	const profile = await userData.getOwnProfile(userId);

	if (!profile) {
		throw new NotFoundError('El perfil del usuario autenticado no existe.');
	}

	return mapOwnProfile(profile);
};

export const updateOwnProfile = async (userId: string, body: UpdateOwnProfileBody) => {
	const profile = await userData.updateOwnProfile(userId, body);

	if (!profile) {
		const existing = await userData.getOwnProfile(userId);
		if (!existing) {
			throw new NotFoundError('El perfil del usuario autenticado no existe.');
		}

		throw new ConflictError(
			'El perfil fue modificado en otra sesión. Recarga los datos antes de guardar.',
		);
	}

	return mapOwnProfile(profile);
};

export const getOwnAvatar = async (userId: string) => {
	const avatar = await userData.getOwnAvatar(userId);

	if (!avatar?.avatarData || avatar.avatarMimeType !== 'image/webp') {
		throw new NotFoundError('El usuario no tiene una fotografía de perfil.');
	}

	return {
		data: avatar.avatarData,
		mimeType: 'image/webp' as const,
		updatedAt: avatar.avatarUpdatedAt,
	};
};

export const updateOwnAvatar = async (userId: string, body: UpdateOwnAvatarBody) => {
	const existing = await userData.getOwnProfile(userId);
	if (!existing) {
		throw new NotFoundError('El perfil del usuario autenticado no existe.');
	}

	const avatar = await normalizeAvatar(body);
	return userData.updateOwnAvatar(userId, avatar);
};

export const removeOwnAvatar = async (userId: string): Promise<void> => {
	const result = await userData.removeOwnAvatar(userId);
	if (result.count === 0) {
		throw new NotFoundError('El perfil del usuario autenticado no existe.');
	}
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
	getAdminProfile,
	updateAdminProfile,
	getOwnProfile,
	updateOwnProfile,
	getOwnAvatar,
	updateOwnAvatar,
	removeOwnAvatar,
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
