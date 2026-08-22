import type { Prisma } from '@/generated/prisma/client';
import { Prisma as PrismaClient } from '@/generated/prisma/client';

import { prisma } from '@/database/client';
import { ConflictError } from '@/errors/conflict-error';
import { env } from '@/lib/config/env';
import { normalizePagination } from '@/helper/pagination';
import type { SessionPermission, SessionRole, SessionUser } from '@/lib/session';
import type {
	CreateUserBody,
	UpdateAdminUserProfileBody,
	UpdateUserBody,
	UserQueryParams,
} from '@/validations/users';

import { assertKeepsAtLeastOneAdmin } from './role-guard';

type OAuthSyncUser = {
	user: SessionUser;
};

const isPrismaUniqueConstraintError = (
	error: unknown,
): error is PrismaClient.PrismaClientKnownRequestError =>
	error instanceof PrismaClient.PrismaClientKnownRequestError && error.code === 'P2002';

const splitDisplayName = (displayName: string): { firstName: string; lastName: string } => {
	const parts = displayName.trim().split(/\s+/u).filter(Boolean);

	if (parts.length === 0) {
		return { firstName: 'Usuario', lastName: 'OAuth' };
	}

	if (parts.length === 1) {
		return { firstName: parts[0], lastName: '' };
	}

	return {
		firstName: parts[0],
		lastName: parts.slice(1).join(' '),
	};
};

const buildDisplayName = (
	firstName: string | null | undefined,
	lastName: string | null | undefined,
	email: string,
): string => {
	const name = [firstName, lastName]
		.filter((value): value is string => Boolean(value && value.trim()))
		.join(' ')
		.trim();

	return name || email;
};

const mapRoles = (
	roles: Array<{ role: { id: string; code: string; name: string } }>,
): SessionRole[] =>
	roles.map(({ role }) => ({
		id: role.id,
		code: role.code,
		name: role.name,
	}));

const mapPermissions = (
	roles: Array<{
		role: {
			permissions: Array<{
				permission: { id: string; code: string };
			}>;
		};
	}>,
): SessionPermission[] => {
	const seen = new Map<string, SessionPermission>();

	for (const role of roles) {
		for (const granted of role.role.permissions) {
			seen.set(granted.permission.id, granted.permission);
		}
	}

	return [...seen.values()];
};

const loadUserWithAccess = async (userId: string) =>
	prisma.user.findUnique({
		where: { id: userId },
		include: {
			profile: true,
			userRoles: {
				include: {
					role: {
						include: {
							permissions: {
								include: {
									permission: true,
								},
							},
						},
					},
				},
			},
		},
	});

/**
 * Carga el usuario con sus roles y permisos vigentes.
 *
 * El middleware `auth` la llama en CADA petición, en vez de leer al usuario de la cookie.
 * Cuesta una consulta, y a cambio un rol o permiso concedido surte efecto de inmediato,
 * sin obligar al usuario a cerrar sesión y volver a entrar.
 */
export const getSessionUser = async (userId: string): Promise<SessionUser | null> => {
	const user = await loadUserWithAccess(userId);

	if (!user) {
		return null;
	}

	return {
		id: user.id,
		email: user.email,
		name: buildDisplayName(user.profile?.firstName, user.profile?.lastName, user.email),
		roles: mapRoles(user.userRoles),
		permissions: mapPermissions(user.userRoles),
	};
};

export const findOrSyncByOAuth = async (
	oauthSubject: string,
	email: string,
	name: string,
): Promise<OAuthSyncUser> => {
	const existingAccount = await prisma.authAccount.findUnique({
		where: {
			provider_providerAccountId: {
				provider: env.OAUTH_PROVIDER_NAME,
				providerAccountId: oauthSubject,
			},
		},
	});

	if (existingAccount) {
		const updatedUser = await prisma.user.update({
			where: { id: existingAccount.userId },
			data: {
				email,
				profile: {
					upsert: {
						create: splitDisplayName(name),
						update: splitDisplayName(name),
					},
				},
			},
		});

		const user = await loadUserWithAccess(updatedUser.id);

		if (!user) {
			throw new Error('User synchronization failed');
		}

		return {
			user: {
				id: user.id,
				email: user.email,
				name: buildDisplayName(user.profile?.firstName, user.profile?.lastName, user.email),
				roles: mapRoles(user.userRoles),
				permissions: mapPermissions(user.userRoles),
			},
		};
	}

	const createdUser = await prisma.$transaction(async transaction => {
		const user = await transaction.user.create({
			data: {
				email,
				username: email.split('@')[0] || email,
				status: 'ACTIVE',
				profile: {
					create: splitDisplayName(name),
				},
				authAccounts: {
					create: {
						provider: env.OAUTH_PROVIDER_NAME,
						providerAccountId: oauthSubject,
					},
				},
			},
		});

		return user;
	});

	const user = await loadUserWithAccess(createdUser.id);

	if (!user) {
		throw new Error('User synchronization failed');
	}

	return {
		user: {
			id: user.id,
			email: user.email,
			name: buildDisplayName(user.profile?.firstName, user.profile?.lastName, user.email),
			roles: mapRoles(user.userRoles),
			permissions: mapPermissions(user.userRoles),
		},
	};
};

const selectUserFields = {
	id: true,
	email: true,
	status: true,
	createdAt: true,
	updatedAt: true,
	profile: true,
	userRoles: {
		include: {
			role: true,
		},
	},
};

const selectAdminProfileFields = {
	id: true,
	email: true,
	status: true,
	profile: {
		select: {
			firstName: true,
			lastName: true,
			updatedAt: true,
		},
	},
} satisfies Prisma.UserSelect;

export const getAdminProfile = async (userId: string) =>
	prisma.user.findUnique({
		where: { id: userId },
		select: selectAdminProfileFields,
	});

export type AdminProfileUpdateResult =
	| { outcome: 'UPDATED'; user: NonNullable<Awaited<ReturnType<typeof getAdminProfile>>> }
	| { outcome: 'NOT_FOUND' | 'INACTIVE' | 'SYSTEM_ROLE' | 'CONFLICT' };

export const updateAdminProfile = async (
	userId: string,
	data: UpdateAdminUserProfileBody,
	actorIsAdministrator: boolean,
): Promise<AdminProfileUpdateResult> =>
	prisma.$transaction(async transaction => {
		const target = await transaction.user.findUnique({
			where: { id: userId },
			select: {
				status: true,
				profile: { select: { updatedAt: true } },
				userRoles: { select: { role: { select: { isSystem: true } } } },
			},
		});

		if (!target?.profile) {
			return { outcome: 'NOT_FOUND' };
		}

		if (target.status !== 'ACTIVE') {
			return { outcome: 'INACTIVE' };
		}

		if (!actorIsAdministrator && target.userRoles.some(({ role }) => role.isSystem)) {
			return { outcome: 'SYSTEM_ROLE' };
		}

		const update = await transaction.userProfile.updateMany({
			where: {
				userId,
				updatedAt: new Date(data.expectedProfileUpdatedAt),
			},
			data: {
				...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
				...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
			},
		});

		if (update.count === 0) {
			return { outcome: 'CONFLICT' };
		}

		const user = await transaction.user.findUnique({
			where: { id: userId },
			select: selectAdminProfileFields,
		});

		if (!user) {
			return { outcome: 'NOT_FOUND' };
		}

		return { outcome: 'UPDATED', user };
	});

export const getAll = async (filters: UserQueryParams) => {
	const { skip, take, meta } = normalizePagination(filters);

	const where: Prisma.UserWhereInput = {
		status: filters.active ? 'ACTIVE' : undefined,
	};

	if (filters.search) {
		where.OR = [
			{ email: { contains: filters.search, mode: 'insensitive' } },
			{ profile: { firstName: { contains: filters.search, mode: 'insensitive' } } },
			{ profile: { lastName: { contains: filters.search, mode: 'insensitive' } } },
		];
	}

	const [users, total] = await Promise.all([
		prisma.user.findMany({
			where,
			select: selectUserFields,
			skip,
			take,
			orderBy: filters.orderBy
				? { [filters.orderBy]: filters.order ?? 'asc' }
				: { createdAt: 'desc' },
		}),
		prisma.user.count({ where }),
	]);

	return { users, meta: meta(total) };
};

export const create = async (data: CreateUserBody) => {
	try {
		const user = await prisma.user.create({
			data: {
				email: data.email,
				username: data.email.split('@')[0] || data.email,
				status: 'ACTIVE',
				profile: {
					create: {
						firstName: data.firstName,
						lastName: data.lastName,
					},
				},
			},
			select: selectUserFields,
		});

		return user;
	} catch (error) {
		if (isPrismaUniqueConstraintError(error)) {
			throw new ConflictError('Ya existe un usuario con ese correo electrónico.');
		}

		throw error;
	}
};

export const createWithRoles = async (data: CreateUserBody) => {
	try {
		return await prisma.$transaction(async transaction =>
			transaction.user.create({
				data: {
					email: data.email,
					username: data.email.split('@')[0] || data.email,
					status: 'ACTIVE',
					profile: {
						create: {
							firstName: data.firstName,
							lastName: data.lastName,
						},
					},
					...(data.roleIds && data.roleIds.length > 0
						? {
								userRoles: {
									create: data.roleIds.map(roleId => ({
										roleId,
										organizationId: data.organizationId,
									})),
								},
							}
						: {}),
				},
				select: selectUserFields,
			}),
		);
	} catch (error) {
		if (isPrismaUniqueConstraintError(error)) {
			throw new ConflictError('Ya existe un usuario con ese correo electrónico.');
		}

		throw error;
	}
};

export const getRolesByUserId = async (userId: string, page = 1, pageSize = 20) => {
	const where: Prisma.UserRoleWhereInput = { userId };
	const [userRoles, total] = await Promise.all([
		prisma.userRole.findMany({
			where,
			include: {
				role: true,
			},
			orderBy: { role: { name: 'asc' } },
			skip: (page - 1) * pageSize,
			take: pageSize,
		}),
		prisma.userRole.count({ where }),
	]);

	return {
		roles: userRoles.map(userRole => userRole.role),
		meta: {
			page,
			pageSize,
			total,
			totalPages: Math.ceil(total / pageSize),
		},
	};
};

export const getAssignableRoles = async (roleIds: string[]) =>
	prisma.role.findMany({
		where: {
			id: { in: roleIds },
			deletedAt: null,
		},
		select: {
			id: true,
			organizationId: true,
			isSystem: true,
		},
	});

export const assignRolesToUser = async (
	userId: string,
	roles: Array<{ id: string; organizationId: string | null }>,
) =>
	prisma.$transaction(async transaction => {
		await assertKeepsAtLeastOneAdmin(transaction, userId, {
			newRoleIds: roles.map(role => role.id),
		});

		await transaction.userRole.deleteMany({
			where: { userId },
		});

		if (roles.length > 0) {
			await transaction.userRole.createMany({
				data: roles.map(role => ({
					userId,
					roleId: role.id,
					organizationId: role.organizationId,
				})),
			});
		}
	});

export const updateWithRoles = async (
	userId: string,
	data: UpdateUserBody,
	roles?: Array<{ id: string; organizationId: string | null }>,
) =>
	prisma.$transaction(async transaction => {
		if (roles) {
			await assertKeepsAtLeastOneAdmin(transaction, userId, {
				newRoleIds: roles.map(role => role.id),
			});
		}

		await transaction.user.update({
			where: { id: userId },
			data: {
				...(data.email && { email: data.email }),
				...(data.firstName || data.lastName
					? {
							profile: {
								update: {
									...(data.firstName && { firstName: data.firstName }),
									...(data.lastName && { lastName: data.lastName }),
								},
							},
						}
					: {}),
			},
		});

		if (roles) {
			await transaction.userRole.deleteMany({ where: { userId } });

			if (roles.length > 0) {
				await transaction.userRole.createMany({
					data: roles.map(role => ({
						userId,
						roleId: role.id,
						organizationId: role.organizationId,
					})),
				});
			}
		}

		return transaction.user.findUniqueOrThrow({
			where: { id: userId },
			include: {
				profile: true,
				userRoles: { include: { role: true } },
			},
		});
	});

export const addRolesToUser = async (
	userId: string,
	roles: Array<{ id: string; organizationId: string | null }>,
) =>
	prisma.$transaction(async transaction => {
		const existing = await transaction.userRole.findMany({
			where: {
				userId,
				roleId: { in: roles.map(role => role.id) },
			},
			select: { roleId: true },
		});
		const existingRoleIds = new Set(existing.map(userRole => userRole.roleId));
		const missingRoles = roles.filter(role => !existingRoleIds.has(role.id));

		if (missingRoles.length > 0) {
			await transaction.userRole.createMany({
				data: missingRoles.map(role => ({
					userId,
					roleId: role.id,
					organizationId: role.organizationId,
				})),
			});
		}
	});

export const addRoleToUser = async (userId: string, roleId: string) => {
	const role = await prisma.role.findFirst({
		where: { id: roleId, deletedAt: null },
		select: { id: true, organizationId: true },
	});

	if (!role) {
		return false;
	}

	await addRolesToUser(userId, [role]);
	return true;
};

export const removeRoleFromUser = async (userId: string, roleId: string) =>
	prisma.$transaction(async transaction => {
		await assertKeepsAtLeastOneAdmin(transaction, userId, { removingRoleId: roleId });

		const result = await transaction.userRole.deleteMany({
			where: { userId, roleId },
		});

		return result.count > 0;
	});

export const record = (userId: string) => ({
	getUnique: async () =>
		prisma.user.findUnique({
			where: { id: userId },
			select: selectUserFields,
		}),
	update: async (data: UpdateUserBody) =>
		prisma.user.update({
			where: { id: userId },
			data: {
				...(data.email && { email: data.email }),
				...(data.firstName || data.lastName
					? {
							profile: {
								update: {
									...(data.firstName && { firstName: data.firstName }),
									...(data.lastName && { lastName: data.lastName }),
								},
							},
						}
					: {}),
			},
			select: selectUserFields,
		}),
	remove: async () =>
		prisma.$transaction(async transaction => {
			await assertKeepsAtLeastOneAdmin(transaction, userId);

			return transaction.user.update({
				where: { id: userId },
				data: {
					status: 'INACTIVE',
				},
				select: selectUserFields,
			});
		}),
});
