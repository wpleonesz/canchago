import type { Prisma } from '@/generated/prisma/client';
import { Prisma as PrismaClient } from '@/generated/prisma/client';

import { prisma } from '@/database/client';
import { ConflictError } from '@/errors/conflict-error';
import { NotFoundError } from '@/errors/not-found-error';
import { normalizePagination } from '@/helper/pagination';
import type {
	CreateOrganizationBody,
	OrganizationQueryParams,
	UpdateOrganizationBody,
} from '@/validations/organizaciones-sedes';

const isPrismaUniqueConstraintError = (
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
};

export const getAll = async (filters: OrganizationQueryParams) => {
	const { skip, take, meta } = normalizePagination(filters);

	const where: Prisma.OrganizationWhereInput = {
		deletedAt: null,
	};

	if (filters.search) {
		where.OR = [
			{ name: { contains: filters.search, mode: 'insensitive' } },
			{ email: { contains: filters.search, mode: 'insensitive' } },
		];
	}

	const [organizations, total] = await Promise.all([
		prisma.organization.findMany({
			where,
			select: selectOrganizationFields,
			skip,
			take,
			orderBy: filters.orderBy
				? { [filters.orderBy]: filters.order ?? 'asc' }
				: { createdAt: 'desc' },
		}),
		prisma.organization.count({ where }),
	]);

	return { organizations, meta: meta(total) };
};

export const create = async (data: CreateOrganizationBody) => {
	try {
		const organization = await prisma.organization.create({
			data: {
				name: data.name,
				legalName: data.legalName,
				taxIdentification: data.taxIdentification,
				email: data.email || null,
				phone: data.phone || null,
				domain: data.domain || null,
				status: 'ACTIVE',
			},
			select: selectOrganizationFields,
		});

		return organization;
	} catch (error) {
		if (isPrismaUniqueConstraintError(error)) {
			throw new ConflictError('Ya existe una organización con ese nombre.');
		}

		throw error;
	}
};

export const record = (organizationId: string) => ({
	getUnique: async () => {
		const record = await prisma.organization.findUnique({
			where: { id: organizationId },
			select: { ...selectOrganizationFields, deletedAt: true },
		});

		if (!record || record.deletedAt) {
			throw new NotFoundError('La organización solicitada no existe.');
		}

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { deletedAt, ...organization } = record;
		return organization;
	},

	update: async (data: UpdateOrganizationBody) => {
		const organization = await prisma.organization.findUnique({
			where: { id: organizationId },
			select: { deletedAt: true },
		});

		if (!organization || organization.deletedAt) {
			throw new NotFoundError('La organización solicitada no existe.');
		}

		try {
			return await prisma.organization.update({
				where: { id: organizationId },
				data: {
					...(data.name && { name: data.name }),
					...(data.legalName && { legalName: data.legalName }),
					...(data.taxIdentification && { taxIdentification: data.taxIdentification }),
					...(data.email !== undefined && { email: data.email || null }),
					...(data.phone !== undefined && { phone: data.phone || null }),
					...(data.domain !== undefined && { domain: data.domain || null }),
				},
				select: selectOrganizationFields,
			});
		} catch (error) {
			if (isPrismaUniqueConstraintError(error)) {
				throw new ConflictError('Ya existe una organización con ese nombre.');
			}

			throw error;
		}
	},

	remove: async () => {
		const organization = await prisma.organization.findUnique({
			where: { id: organizationId },
			select: { deletedAt: true },
		});

		if (!organization || organization.deletedAt) {
			throw new NotFoundError('La organización solicitada no existe.');
		}

		return await prisma.$transaction(async transaction => {
			await transaction.venue.updateMany({
				where: { organizationId },
				data: { deletedAt: new Date() },
			});

			return transaction.organization.update({
				where: { id: organizationId },
				data: { deletedAt: new Date() },
				select: selectOrganizationFields,
			});
		});
	},
});

export const ESCAPE = ['name', 'email', 'phone', 'domain'];
