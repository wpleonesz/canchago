import { prisma } from '@/database/client';
import { AuthorizationError } from '@/errors/auth';
import type { SessionUser } from '@/lib/session';

const ADMIN_ROLE_CODE = 'administrador';

export const isAdministrator = (actingUser: SessionUser): boolean =>
	actingUser.roles.some(role => role.code === ADMIN_ROLE_CODE);

/**
 * Rechaza asignar un rol `isSystem: true` (como `Administrador`) a menos que quien hace
 * la petición ya tenga ese mismo rol. Sin este guardia, cualquier usuario con `users.manage`
 * podría auto-otorgarse privilegios de super admin manipulando el payload directamente.
 */
export const assertCanAssignRoles = async (
	actingUser: SessionUser,
	roleIds: string[],
): Promise<void> => {
	if (roleIds.length === 0 || isAdministrator(actingUser)) {
		return;
	}

	const roles = await prisma.role.findMany({
		where: { id: { in: roleIds } },
		select: { isSystem: true },
	});

	const assignsSystemRole = roles.some(role => role.isSystem);

	if (assignsSystemRole) {
		throw new AuthorizationError('No tienes permiso para asignar un rol de sistema.');
	}
};
