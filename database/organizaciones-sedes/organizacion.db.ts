import type { Prisma } from '@/generated/prisma/client';
import { Prisma as PrismaClient } from '@/generated/prisma/client';

import { prisma } from '@/database/client';
import { NotFoundError } from '@/errors/not-found-error';
import { normalizePagination } from '@/helper/pagination';
import type { OrganizationQueryParams } from '@/validations/organizaciones-sedes';

export const isOrganizationUniqueConstraintError = (
	error: unknown,
): error is PrismaClient.PrismaClientKnownRequestError =>
	error instanceof PrismaClient.PrismaClientKnownRequestError && error.code === 'P2002';

const selectOrganizationFields = {
	id: true,
	name: true,
	legalName: true,
	taxIdentification: true,
	email: true,
	phone: true,
	domain: true,
	status: true,
	createdAt: true,
	updatedAt: true,
} satisfies Prisma.OrganizationSelect;

const selectOrganizationListFields = {
	...selectOrganizationFields,
	_count: { select: { venues: { where: { deletedAt: null } } } },
} satisfies Prisma.OrganizationSelect;

type OrganizationListRow = Prisma.OrganizationGetPayload<{
	select: typeof selectOrganizationListFields;
}>;

const mapListRow = (row: OrganizationListRow) => {
	const { _count, ...organization } = row;
	return { ...organization, venuesCount: _count.venues };
};

type TransactionClient = Prisma.TransactionClient;

const createTransactionRepository = (transaction: TransactionClient) => ({
	findOrganization: (organizationId: string) =>
		transaction.organization.findFirst({
			where: { id: organizationId, deletedAt: null },
			select: selectOrganizationFields,
		}),

	createOrganization: (data: {
		name: string;
		normalizedName: string;
		legalName: string | null;
		taxIdentification: string | null;
		email: string | null;
		phone: string | null;
		domain: string | null;
	}) =>
		transaction.organization.create({
			data: { ...data, status: 'ACTIVE' },
			select: selectOrganizationFields,
		}),

	updateOrganization: (
		organizationId: string,
		expectedUpdatedAt: Date,
		data: Prisma.OrganizationUpdateManyMutationInput,
	) =>
		transaction.organization.updateMany({
			where: { id: organizationId, updatedAt: expectedUpdatedAt, deletedAt: null },
			data,
		}),

	removeWithCascade: async (organizationId: string) => {
		await transaction.venue.updateMany({
			where: { organizationId, deletedAt: null },
			data: { deletedAt: new Date() },
		});

		return transaction.organization.update({
			where: { id: organizationId },
			data: { deletedAt: new Date() },
			select: selectOrganizationFields,
		});
	},

	writeAudit: (data: {
		actorUserId: string;
		organizationId: string;
		entityId: string;
		action: 'ORGANIZATION_CREATED' | 'ORGANIZATION_UPDATED';
		changes: Prisma.InputJsonValue;
	}) =>
		transaction.auditLog.create({
			data: { ...data, entityType: 'Organization' },
		}),

	getDetail: (organizationId: string) =>
		transaction.organization.findFirstOrThrow({
			where: { id: organizationId, deletedAt: null },
			select: selectOrganizationFields,
		}),
});

export type OrganizationTransactionRepository = ReturnType<typeof createTransactionRepository>;

export const getAll = async (
	filters: OrganizationQueryParams,
	actor: { userId: string; isAdministrator: boolean },
) => {
	const { skip, take, meta } = normalizePagination(filters);

	const where: Prisma.OrganizationWhereInput = {
		deletedAt: null,
		...(filters.status ? { status: filters.status } : {}),
		...(filters.hasActiveVenues === 'true'
			? { venues: { some: { status: 'ACTIVE', deletedAt: null } } }
			: {}),
		...(!actor.isAdministrator
			? {
					OR: [
						{
							userRoles: {
								some: { userId: actor.userId, role: { deletedAt: null } },
							},
						},
						{
							roles: {
								some: {
									deletedAt: null,
									userRoles: { some: { userId: actor.userId } },
								},
							},
						},
					],
				}
			: {}),
	};

	if (filters.search) {
		where.AND = {
			OR: [
				{ name: { contains: filters.search, mode: 'insensitive' } },
				{ email: { contains: filters.search, mode: 'insensitive' } },
			],
		};
	}

	const [organizations, total] = await Promise.all([
		prisma.organization.findMany({
			where,
			select: selectOrganizationListFields,
			skip,
			take,
			orderBy: filters.orderBy
				? { [filters.orderBy]: filters.order ?? 'asc' }
				: { createdAt: 'desc' },
		}),
		prisma.organization.count({ where }),
	]);

	return { organizations: organizations.map(mapListRow), meta: meta(total) };
};

export const actorHasOrganizationScope = async (
	userId: string,
	organizationId: string,
): Promise<boolean> => {
	const assignments = await prisma.userRole.count({
		where: {
			userId,
			role: { deletedAt: null },
			OR: [{ organizationId }, { role: { organizationId } }],
		},
	});

	return assignments > 0;
};

export const getUnique = async (organizationId: string) => {
	const record = await prisma.organization.findFirst({
		where: { id: organizationId, deletedAt: null },
		select: selectOrganizationFields,
	});

	if (!record) {
		throw new NotFoundError('La organización solicitada no existe.');
	}

	return record;
};

export const withTransaction = <T>(
	operation: (repository: OrganizationTransactionRepository) => Promise<T>,
) => prisma.$transaction(transaction => operation(createTransactionRepository(transaction)));
