import {
	isRoleUniqueConstraintError,
	roleDb,
	type RoleTransactionRepository,
} from '@/database/roles-permisos/role.db';
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from '@/errors';
import { createRoleCode, normalizeRoleIdentity } from '@/helper/roles';
import type { SessionUser } from '@/lib/session';
import { isAdministrator } from '@/services/users/role-guard';
import type {
	CreateRoleInput,
	RoleListQuery,
	UpdateRoleInput,
} from '@/validations/roles-permisos/role.validation';

const ensureOrganizationScope = async (
	actingUser: SessionUser,
	organizationId: string,
	opaque = false,
): Promise<void> => {
	if (isAdministrator(actingUser)) return;

	const hasScope = await roleDb.actorHasOrganizationScope(actingUser.id, organizationId);
	if (hasScope) return;

	if (opaque) {
		throw new NotFoundError('El rol solicitado no existe.');
	}

	throw new AuthorizationError('No tienes acceso a los roles de esta organización.');
};

const ensurePermissionSubset = (actingUser: SessionUser, permissionCodes: string[]): void => {
	if (isAdministrator(actingUser)) return;

	const grantedCodes = new Set(actingUser.permissions.map(permission => permission.code));
	if (permissionCodes.some(code => !grantedCodes.has(code))) {
		throw new AuthorizationError('No puedes administrar capacidades superiores a las tuyas.');
	}
};

const getPermissionsOrThrow = async (
	repository: RoleTransactionRepository,
	permissionIds: string[],
) => {
	if (permissionIds.length === 0) return [];

	const permissions = await repository.findPermissions(permissionIds);
	if (permissions.length !== permissionIds.length) {
		throw new ValidationError('Uno o más permisos no existen o ya no están disponibles.');
	}

	return permissions;
};

const createRole = async (
	organizationId: string,
	input: CreateRoleInput,
	actingUser: SessionUser,
) => {
	await ensureOrganizationScope(actingUser, organizationId);

	try {
		return await roleDb.withTransaction(async repository => {
			const permissions = await getPermissionsOrThrow(repository, input.permissionIds);
			ensurePermissionSubset(
				actingUser,
				permissions.map(permission => permission.code),
			);

			const role = await repository.createRole({
				organizationId,
				name: input.name,
				normalizedName: normalizeRoleIdentity(input.name),
				code: createRoleCode(input.name),
				description: input.description ?? null,
			});

			await repository.replacePermissions(
				role.id,
				permissions.map(permission => permission.id),
			);
			await repository.writeAudit({
				actorUserId: actingUser.id,
				organizationId,
				entityId: role.id,
				action: 'ROLE_CREATED',
				changes: {
					name: input.name,
					description: input.description ?? null,
					permissionsAdded: permissions.map(permission => permission.code),
				},
			});

			return repository.getDetail(role.id, organizationId);
		});
	} catch (error) {
		if (isRoleUniqueConstraintError(error)) {
			throw new ConflictError('Ya existe un rol con ese nombre o código en la organización.');
		}

		throw error;
	}
};

const updateRole = async (
	roleId: string,
	organizationId: string,
	input: UpdateRoleInput,
	actingUser: SessionUser,
) => {
	await ensureOrganizationScope(actingUser, organizationId, true);

	try {
		return await roleDb.withTransaction(async repository => {
			const current = await repository.findRole(roleId, organizationId);
			if (!current) throw new NotFoundError('El rol solicitado no existe.');
			if (current.isSystem) {
				throw new AuthorizationError('Los roles de sistema no se pueden modificar por HTTP.');
			}

			const currentPermissions = current.permissions.map(({ permission }) => permission);
			const requestedPermissions =
				input.permissionIds === undefined
					? currentPermissions
					: await getPermissionsOrThrow(repository, input.permissionIds);

			ensurePermissionSubset(
				actingUser,
				[...currentPermissions, ...requestedPermissions].map(permission => permission.code),
			);

			const update = await repository.updateRole(
				roleId,
				organizationId,
				new Date(input.expectedUpdatedAt),
				{
					...(input.name !== undefined
						? { name: input.name, normalizedName: normalizeRoleIdentity(input.name) }
						: {}),
					...(input.description !== undefined ? { description: input.description } : {}),
					updatedAt: new Date(),
				},
			);

			if (update.count === 0) {
				throw new ConflictError(
					'El rol cambió desde que lo abriste. Recarga los datos antes de guardar.',
				);
			}

			if (input.permissionIds !== undefined) {
				await repository.replacePermissions(
					roleId,
					requestedPermissions.map(permission => permission.id),
				);
			}

			const previousCodes = new Set(currentPermissions.map(permission => permission.code));
			const requestedCodes = new Set(requestedPermissions.map(permission => permission.code));
			await repository.writeAudit({
				actorUserId: actingUser.id,
				organizationId,
				entityId: roleId,
				action: 'ROLE_UPDATED',
				changes: {
					...(input.name !== undefined && input.name !== current.name
						? { name: { from: current.name, to: input.name } }
						: {}),
					...(input.description !== undefined && input.description !== current.description
						? { descriptionChanged: true }
						: {}),
					permissionsAdded: [...requestedCodes].filter(code => !previousCodes.has(code)),
					permissionsRemoved: [...previousCodes].filter(code => !requestedCodes.has(code)),
				},
			});

			return repository.getDetail(roleId, organizationId);
		});
	} catch (error) {
		if (isRoleUniqueConstraintError(error)) {
			throw new ConflictError('Ya existe un rol con ese nombre en la organización.');
		}

		throw error;
	}
};

const deleteRole = async (
	roleId: string,
	organizationId: string,
	actingUser: SessionUser,
): Promise<void> => {
	await ensureOrganizationScope(actingUser, organizationId, true);

	await roleDb.withTransaction(async repository => {
		const role = await repository.findRole(roleId, organizationId);
		if (!role) throw new NotFoundError('El rol solicitado no existe.');
		if (role.isSystem) {
			throw new AuthorizationError('Los roles de sistema no se pueden eliminar.');
		}

		ensurePermissionSubset(
			actingUser,
			role.permissions.map(({ permission }) => permission.code),
		);
		await repository.softDelete(roleId);
	});
};

export const roleService = {
	async getRoles(filters: RoleListQuery, actingUser: SessionUser) {
		await ensureOrganizationScope(actingUser, filters.organizationId);
		return roleDb.getRoles(filters);
	},

	async getRoleById(roleId: string, organizationId: string, actingUser: SessionUser) {
		await ensureOrganizationScope(actingUser, organizationId, true);
		const role = await roleDb.getRoleById(roleId, organizationId);
		if (!role) throw new NotFoundError('El rol solicitado no existe.');
		return role;
	},

	async getRolePermissions(
		roleId: string,
		organizationId: string,
		page: number,
		pageSize: number,
		actingUser: SessionUser,
	) {
		await ensureOrganizationScope(actingUser, organizationId, true);
		const result = await roleDb.getRolePermissions(roleId, organizationId, page, pageSize);
		if (!result) throw new NotFoundError('El rol solicitado no existe.');
		return result;
	},

	createRole,
	updateRole,
	deleteRole,
};
