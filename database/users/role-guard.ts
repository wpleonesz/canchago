import { prisma } from '@/database/client';
import { ConflictError } from '@/errors/conflict-error';

const ADMIN_ROLE_CODE = 'administrador';

type RoleGuardTransactionClient = {
	role: Pick<typeof prisma.role, 'findFirst'>;
	userRole: Pick<typeof prisma.userRole, 'count'>;
};

type AssertKeepsAtLeastOneAdminOptions = {
	/** Reemplazo completo de roles (`assignRolesToUser`): si el rol admin sigue en la lista nueva, no hay nada que proteger. */
	newRoleIds?: string[];
	/** Remoción puntual de un rol (`removeRoleFromUser`): solo importa si el rol removido ES el rol admin. */
	removingRoleId?: string;
};

/**
 * Rechaza dejar la plataforma sin ningún usuario activo con el rol global `Administrador`.
 * Debe llamarse dentro de la misma transacción que la escritura que protege (desactivar
 * usuario, remover un rol o reemplazar todos los roles de un usuario).
 */
export const assertKeepsAtLeastOneAdmin = async (
	tx: RoleGuardTransactionClient,
	userId: string,
	options: AssertKeepsAtLeastOneAdminOptions = {},
): Promise<void> => {
	const adminRole = await tx.role.findFirst({
		where: { code: ADMIN_ROLE_CODE, organizationId: null },
		select: { id: true },
	});

	if (!adminRole) {
		return;
	}

	if (options.newRoleIds?.includes(adminRole.id)) {
		return;
	}

	if (options.removingRoleId && options.removingRoleId !== adminRole.id) {
		return;
	}

	const targetIsCurrentlyAdmin = await tx.userRole.count({
		where: { userId, roleId: adminRole.id },
	});

	if (targetIsCurrentlyAdmin === 0) {
		return;
	}

	const remainingAdmins = await tx.userRole.count({
		where: {
			userId: { not: userId },
			roleId: adminRole.id,
			user: { status: 'ACTIVE' },
		},
	});

	if (remainingAdmins === 0) {
		throw new ConflictError('No es posible dejar la plataforma sin ningún administrador activo.');
	}
};
