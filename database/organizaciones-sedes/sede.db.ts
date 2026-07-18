import type { Prisma } from '@/generated/prisma/client';
import { Prisma as PrismaClient } from '@/generated/prisma/client';

import { prisma } from '@/database/client';
import { ConflictError } from '@/errors/conflict-error';
import { NotFoundError } from '@/errors/not-found-error';
import { normalizePagination } from '@/helper/pagination';
import type {
	CreateSedeBody,
	SedeQueryParams,
	UpdateSedeBody,
} from '@/validations/organizaciones-sedes';

const isPrismaUniqueConstraintError = (
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
};

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

export const create = async (organizationId: string, data: CreateSedeBody) => {
	try {
		const venue = await prisma.venue.create({
			data: {
				organizationId,
				name: data.name,
				address: data.address || null,
				phone: data.phone || null,
				email: data.email || null,
				status: 'ACTIVE',
			},
			select: selectSedeFields,
		});

		return venue;
	} catch (error) {
		if (isPrismaUniqueConstraintError(error)) {
			throw new ConflictError('Ya existe una sede con ese nombre en esta organización.');
		}

		throw error;
	}
};

export const record = (sedeId: string) => ({
	getUnique: async () => {
		const record = await prisma.venue.findUnique({
			where: { id: sedeId },
			select: { ...selectSedeFields, deletedAt: true },
		});

		if (!record || record.deletedAt) {
			throw new NotFoundError('La sede solicitada no existe.');
		}

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { deletedAt, ...venue } = record;
		return venue;
	},

	update: async (data: UpdateSedeBody) => {
		const venue = await prisma.venue.findUnique({
			where: { id: sedeId },
			select: { deletedAt: true },
		});

		if (!venue || venue.deletedAt) {
			throw new NotFoundError('La sede solicitada no existe.');
		}

		try {
			return await prisma.venue.update({
				where: { id: sedeId },
				data: {
					...(data.name && { name: data.name }),
					...(data.address !== undefined && { address: data.address || null }),
					...(data.phone !== undefined && { phone: data.phone || null }),
					...(data.email !== undefined && { email: data.email || null }),
				},
				select: selectSedeFields,
			});
		} catch (error) {
			if (isPrismaUniqueConstraintError(error)) {
				throw new ConflictError('Ya existe una sede con ese nombre en esta organización.');
			}

			throw error;
		}
	},

	remove: async () => {
		const venue = await prisma.venue.findUnique({
			where: { id: sedeId },
			select: { deletedAt: true },
		});

		if (!venue || venue.deletedAt) {
			throw new NotFoundError('La sede solicitada no existe.');
		}

		return await prisma.venue.update({
			where: { id: sedeId },
			data: { deletedAt: new Date() },
			select: selectSedeFields,
		});
	},
});

export const ESCAPE = ['name', 'address', 'phone', 'email'];
