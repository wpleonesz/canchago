import { sedeDb } from '@/database/organizaciones-sedes';
import { ConflictError, NotFoundError } from '@/errors';
import { normalizeVenueName } from '@/helper/organizaciones';
import type { SessionUser } from '@/lib/session';
import type {
	CreateSedeBody,
	SedeQueryParams,
	UpdateSedeBody,
} from '@/validations/organizaciones-sedes';

import { ensureOrganizationScope } from './organizacion.service';

export const getAll = async (
	organizationId: string,
	filters: SedeQueryParams,
	actingUser: SessionUser,
) => {
	await ensureOrganizationScope(actingUser, organizationId, true);
	return sedeDb.getAll(organizationId, filters);
};

export const getById = async (sedeId: string, organizationId: string, actingUser: SessionUser) => {
	await ensureOrganizationScope(actingUser, organizationId, true);
	return sedeDb.getUnique(sedeId, organizationId);
};

export const create = async (
	organizationId: string,
	data: CreateSedeBody,
	actingUser: SessionUser,
) => {
	await ensureOrganizationScope(actingUser, organizationId, true);

	try {
		return await sedeDb.withTransaction(async repository => {
			const organization = await repository.findOrganization(organizationId);
			if (!organization) {
				throw new NotFoundError('La organización solicitada no existe.');
			}

			const venue = await repository.createVenue(organizationId, {
				name: normalizeVenueName(data.name),
				address: data.address || null,
				phone: data.phone || null,
				email: data.email || null,
			});

			await repository.writeAudit({
				actorUserId: actingUser.id,
				organizationId,
				entityId: venue.id,
				action: 'VENUE_CREATED',
				changes: {
					name: venue.name,
					address: venue.address,
					phone: venue.phone,
					email: venue.email,
				},
			});

			return venue;
		});
	} catch (error) {
		if (sedeDb.isSedeUniqueConstraintError(error)) {
			throw new ConflictError('Ya existe una sede con ese nombre en esta organización.');
		}

		throw error;
	}
};

export const update = async (
	sedeId: string,
	organizationId: string,
	data: UpdateSedeBody,
	actingUser: SessionUser,
) => {
	await ensureOrganizationScope(actingUser, organizationId, true);

	try {
		return await sedeDb.withTransaction(async repository => {
			const current = await repository.findVenue(sedeId, organizationId);
			if (!current) {
				throw new NotFoundError('La sede solicitada no existe.');
			}

			const { expectedUpdatedAt, ...editable } = data;

			const updateResult = await repository.updateVenue(
				sedeId,
				organizationId,
				new Date(expectedUpdatedAt),
				{
					...(editable.name !== undefined ? { name: normalizeVenueName(editable.name) } : {}),
					...(editable.address !== undefined ? { address: editable.address || null } : {}),
					...(editable.phone !== undefined ? { phone: editable.phone || null } : {}),
					...(editable.email !== undefined ? { email: editable.email || null } : {}),
					updatedAt: new Date(),
				},
			);

			if (updateResult.count === 0) {
				throw new ConflictError(
					'La sede cambió desde que la abriste. Recarga los datos antes de guardar.',
				);
			}

			await repository.writeAudit({
				actorUserId: actingUser.id,
				organizationId,
				entityId: sedeId,
				action: 'VENUE_UPDATED',
				changes: Object.fromEntries(
					Object.entries(editable).filter(([, value]) => value !== undefined),
				),
			});

			return repository.getDetail(sedeId, organizationId);
		});
	} catch (error) {
		if (sedeDb.isSedeUniqueConstraintError(error)) {
			throw new ConflictError('Ya existe una sede con ese nombre en esta organización.');
		}

		throw error;
	}
};

export const remove = async (sedeId: string, organizationId: string, actingUser: SessionUser) => {
	await ensureOrganizationScope(actingUser, organizationId, true);

	return sedeDb.withTransaction(async repository => {
		const current = await repository.findVenue(sedeId, organizationId);
		if (!current) {
			throw new NotFoundError('La sede solicitada no existe.');
		}

		await repository.removeVenue(sedeId, organizationId);
	});
};
