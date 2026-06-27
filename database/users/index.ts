import { prisma } from '@/database/client';

import { env } from '@/lib/config/env';
import type { SessionPermission, SessionRole, SessionUser } from '@/lib/session';

type OAuthSyncUser = {
	user: SessionUser;
};

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
): SessionRole[] => roles.map(entry => entry.role);

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
