import { organizacionDb } from '@/database/organizaciones-sedes';
import type { OrganizationTransactionRepository } from '@/database/organizaciones-sedes/organizacion.db';
import { AuthorizationError, ConflictError, NotFoundError } from '@/errors';
import { normalizeOrganizationIdentity, normalizeOrganizationName } from '@/helper/organizaciones';
import type { SessionUser } from '@/lib/session';
import { isAdministrator } from '@/services/users/role-guard';
import type {
	CreateOrganizationBody,
	OrganizationQueryParams,
	UpdateOrganizationBody,
} from '@/validations/organizaciones-sedes';

export const ensureOrganizationScope = async (
	actingUser: SessionUser,
	organizationId: string,
	opaque = false,
): Promise<void> => {
	if (isAdministrator(actingUser)) return;

	const hasScope = await organizacionDb.actorHasOrganizationScope(actingUser.id, organizationId);
	if (hasScope) return;

	if (opaque) {
		throw new NotFoundError('La organización solicitada no existe.');
	}

	throw new AuthorizationError('No tienes acceso a esta organización.');
};

export const getAll = async (filters: OrganizationQueryParams, actingUser: SessionUser) =>
	organizacionDb.getAll(filters, {
		userId: actingUser.id,
		isAdministrator: isAdministrator(actingUser),
	});

export const getById = async (organizationId: string, actingUser: SessionUser) => {
	await ensureOrganizationScope(actingUser, organizationId, true);
	return organizacionDb.getUnique(organizationId);
};

export const create = async (data: CreateOrganizationBody, actingUser: SessionUser) => {
	try {
		return await organizacionDb.withTransaction(async repository => {
			const organization = await repository.createOrganization({
				name: normalizeOrganizationName(data.name),
				normalizedName: normalizeOrganizationIdentity(data.name),
				legalName: data.legalName ?? null,
				taxIdentification: data.taxIdentification ?? null,
				email: data.email || null,
				phone: data.phone || null,
				domain: data.domain || null,
			});

			await repository.writeAudit({
				actorUserId: actingUser.id,
				organizationId: organization.id,
				entityId: organization.id,
				action: 'ORGANIZATION_CREATED',
				changes: {
					name: organization.name,
					legalName: organization.legalName,
					taxIdentification: organization.taxIdentification,
					email: organization.email,
					phone: organization.phone,
					domain: organization.domain,
				},
			});

			return organization;
		});
	} catch (error) {
		if (organizacionDb.isOrganizationUniqueConstraintError(error)) {
			throw new ConflictError('Ya existe una organización con ese nombre.');
		}

		throw error;
	}
};

export const update = async (
	organizationId: string,
	data: UpdateOrganizationBody,
	actingUser: SessionUser,
) => {
	await ensureOrganizationScope(actingUser, organizationId, true);

	if (data.status !== undefined && !isAdministrator(actingUser)) {
		throw new AuthorizationError(
			'Solo un administrador puede cambiar el estado de la organización.',
		);
	}

	try {
		return await organizacionDb.withTransaction(
			async (repository: OrganizationTransactionRepository) => {
				const current = await repository.findOrganization(organizationId);
				if (!current) {
					throw new NotFoundError('La organización solicitada no existe.');
				}

				const { expectedUpdatedAt, ...editable } = data;

				const updateResult = await repository.updateOrganization(
					organizationId,
					new Date(expectedUpdatedAt),
					{
						...(editable.name !== undefined
							? {
									name: normalizeOrganizationName(editable.name),
									normalizedName: normalizeOrganizationIdentity(editable.name),
								}
							: {}),
						...(editable.legalName !== undefined ? { legalName: editable.legalName } : {}),
						...(editable.taxIdentification !== undefined
							? { taxIdentification: editable.taxIdentification }
							: {}),
						...(editable.email !== undefined ? { email: editable.email || null } : {}),
						...(editable.phone !== undefined ? { phone: editable.phone || null } : {}),
						...(editable.domain !== undefined ? { domain: editable.domain || null } : {}),
						...(editable.status !== undefined ? { status: editable.status } : {}),
						updatedAt: new Date(),
					},
				);

				if (updateResult.count === 0) {
					throw new ConflictError(
						'La organización cambió desde que la abriste. Recarga los datos antes de guardar.',
					);
				}

				await repository.writeAudit({
					actorUserId: actingUser.id,
					organizationId,
					entityId: organizationId,
					action: 'ORGANIZATION_UPDATED',
					changes: Object.fromEntries(
						Object.entries(editable).filter(([, value]) => value !== undefined),
					),
				});

				return repository.getDetail(organizationId);
			},
		);
	} catch (error) {
		if (organizacionDb.isOrganizationUniqueConstraintError(error)) {
			throw new ConflictError('Ya existe una organización con ese nombre.');
		}

		throw error;
	}
};

export const remove = async (organizationId: string, actingUser: SessionUser) => {
	await ensureOrganizationScope(actingUser, organizationId, true);

	return organizacionDb.withTransaction(async repository => {
		const current = await repository.findOrganization(organizationId);
		if (!current) {
			throw new NotFoundError('La organización solicitada no existe.');
		}

		return repository.removeWithCascade(organizationId);
	});
};
