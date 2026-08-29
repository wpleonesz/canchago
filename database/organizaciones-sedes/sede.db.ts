import type { Prisma } from '@/generated/prisma/client';
import { Prisma as PrismaClient } from '@/generated/prisma/client';

import { prisma } from '@/database/client';
import { NotFoundError } from '@/errors/not-found-error';
import { normalizePagination } from '@/helper/pagination';
import type { SedeQueryParams } from '@/validations/organizaciones-sedes';

export const isSedeUniqueConstraintError = (
	error: unknown,
): error is PrismaClient.PrismaClientKnownRequestError =>
	error instanceof PrismaClient.PrismaClientKnownRequestError && error.code === 'P2002';

const selectSedeFields = {
	id: true,
	organizationId: true,
	name: true,
	address: true,
	phone: true,
	email: true,
	status: true,
	createdAt: true,
	updatedAt: true,
} satisfies Prisma.VenueSelect;

type TransactionClient = Prisma.TransactionClient;

const createTransactionRepository = (transaction: TransactionClient) => ({
	findOrganization: (organizationId: string) =>
		transaction.organization.findFirst({
			where: { id: organizationId, deletedAt: null },
			select: { id: true },
		}),

	// Alcance real: exige que la sede pertenezca a organizationId, no solo que exista por id.
	// Este es el cambio que cierra el IDOR de sede entre organizaciones (feature 019).
	findVenue: (venueId: string, organizationId: string) =>
		transaction.venue.findFirst({
			where: { id: venueId, organizationId, deletedAt: null },
			select: selectSedeFields,
		}),

	createVenue: (
		organizationId: string,
		data: { name: string; address: string | null; phone: string | null; email: string | null },
	) =>
		transaction.venue.create({
			data: { ...data, organizationId, status: 'ACTIVE' },
			select: selectSedeFields,
		}),

	updateVenue: (
		venueId: string,
		organizationId: string,
		expectedUpdatedAt: Date,
		data: Prisma.VenueUpdateManyMutationInput,
	) =>
		transaction.venue.updateMany({
			where: { id: venueId, organizationId, updatedAt: expectedUpdatedAt, deletedAt: null },
			data,
		}),

	removeVenue: (venueId: string, organizationId: string) =>
		transaction.venue.updateMany({
			where: { id: venueId, organizationId, deletedAt: null },
			data: { deletedAt: new Date() },
		}),

	writeAudit: (data: {
		actorUserId: string;
		organizationId: string;
		entityId: string;
		action: 'VENUE_CREATED' | 'VENUE_UPDATED';
		changes: Prisma.InputJsonValue;
	}) =>
		transaction.auditLog.create({
			data: { ...data, entityType: 'Venue' },
		}),

	getDetail: (venueId: string, organizationId: string) =>
		transaction.venue.findFirstOrThrow({
			where: { id: venueId, organizationId, deletedAt: null },
			select: selectSedeFields,
		}),
});

export type SedeTransactionRepository = ReturnType<typeof createTransactionRepository>;

export const getAll = async (organizationId: string, filters: SedeQueryParams) => {
	const { skip, take, meta } = normalizePagination(filters);

	const where: Prisma.VenueWhereInput = {
		organizationId,
		deletedAt: null,
	};

	if (filters.search) {
		where.OR = [
			{ name: { contains: filters.search, mode: 'insensitive' } },
			{ email: { contains: filters.search, mode: 'insensitive' } },
		];
	}

	const [venues, total] = await Promise.all([
		prisma.venue.findMany({
			where,
			select: selectSedeFields,
			skip,
			take,
			orderBy: filters.orderBy
				? { [filters.orderBy]: filters.order ?? 'asc' }
				: { createdAt: 'desc' },
		}),
		prisma.venue.count({ where }),
	]);

	return { venues, meta: meta(total) };
};

export const getUnique = async (venueId: string, organizationId: string) => {
	const record = await prisma.venue.findFirst({
		where: { id: venueId, organizationId, deletedAt: null },
		select: selectSedeFields,
	});

	if (!record) {
		throw new NotFoundError('La sede solicitada no existe.');
	}

	return record;
};

export const withTransaction = <T>(
	operation: (repository: SedeTransactionRepository) => Promise<T>,
) => prisma.$transaction(transaction => operation(createTransactionRepository(transaction)));
