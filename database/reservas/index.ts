import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/database/client';
import { normalizePagination } from '@/helper/pagination';
import type {
	AvailabilityQuery,
	CreateResourceBody,
	CreateSlotBody,
	UpdateSlotBody,
} from '@/validations/reservas';

const resourceSelect = {
	id: true,
	name: true,
	description: true,
	status: true,
	createdAt: true,
	updatedAt: true,
	venue: { select: { id: true, name: true, organization: { select: { id: true, name: true } } } },
} satisfies Prisma.ResourceSelect;

export const listResources = async (page = 1, pageSize = 20) => {
	const { skip, take, meta } = normalizePagination({ page, pageSize });
	const where = {
		status: 'ACTIVE' as const,
		deletedAt: null,
		venue: {
			status: 'ACTIVE',
			deletedAt: null,
			organization: { status: 'ACTIVE', deletedAt: null },
		},
	};
	const [data, total] = await Promise.all([
		prisma.resource.findMany({
			where,
			select: resourceSelect,
			skip,
			take,
			orderBy: { name: 'asc' },
		}),
		prisma.resource.count({ where }),
	]);
	return { data, meta: meta(total) };
};

export const getResource = (resourceId: string) =>
	prisma.resource.findFirst({
		where: {
			id: resourceId,
			status: 'ACTIVE',
			deletedAt: null,
			venue: {
				status: 'ACTIVE',
				deletedAt: null,
				organization: { status: 'ACTIVE', deletedAt: null },
			},
		},
		select: resourceSelect,
	});

export const actorCanManageVenue = async (
	userId: string,
	organizationId: string,
	venueId: string,
) =>
	Boolean(
		await prisma.userRole.findFirst({
			where: {
				userId,
				organizationId,
				OR: [{ venueId: null }, { venueId }],
				role: { code: 'gestor-de-cancha', deletedAt: null },
			},
			select: { id: true },
		}),
	);

export const actorCanManageResource = async (userId: string, resourceId: string) =>
	Boolean(
		await prisma.userRole.findFirst({
			where: {
				userId,
				role: { code: 'gestor-de-cancha', deletedAt: null },
				OR: [
					{
						venueId: null,
						organizationId: { not: null },
						organization: { venues: { some: { resources: { some: { id: resourceId } } } } },
					},
					{ venue: { resources: { some: { id: resourceId } } } },
				],
			},
			select: { id: true },
		}),
	);

export const createResource = (venueId: string, body: CreateResourceBody) =>
	prisma.resource.create({
		data: { venueId, name: body.name, description: body.description || null },
		select: resourceSelect,
	});

export const getVenue = (organizationId: string, venueId: string) =>
	prisma.venue.findFirst({
		where: {
			id: venueId,
			organizationId,
			status: 'ACTIVE',
			deletedAt: null,
			organization: { status: 'ACTIVE', deletedAt: null },
		},
		select: { id: true },
	});

export const listAvailability = async (resourceId: string, query: AvailabilityQuery) => {
	const { skip, take, meta } = normalizePagination(query);
	const where = {
		resourceId,
		status: query.includeAll ? undefined : ('PUBLISHED' as const),
		startsAt: {
			gte: query.includeAll
				? new Date(query.from)
				: new Date(Math.max(Date.now(), new Date(query.from).getTime())),
		},
		endsAt: { lte: new Date(query.to) },
		bookings: query.includeAll ? undefined : { none: { status: 'CONFIRMED' as const } },
	};
	const [data, total] = await Promise.all([
		prisma.availabilitySlot.findMany({
			where,
			include: { bookings: { where: { status: 'CONFIRMED' }, select: { id: true } } },
			skip,
			take,
			orderBy: { startsAt: 'asc' },
		}),
		prisma.availabilitySlot.count({ where }),
	]);
	return { data, meta: meta(total) };
};

export const createSlot = async (resourceId: string, userId: string, body: CreateSlotBody) =>
	prisma.$transaction(
		async transaction => {
			const startsAt = new Date(body.startsAt);
			const endsAt = new Date(body.endsAt);
			const overlap = await transaction.availabilitySlot.findFirst({
				where: {
					resourceId,
					status: { in: ['DRAFT', 'PUBLISHED'] },
					startsAt: { lt: endsAt },
					endsAt: { gt: startsAt },
				},
				select: { id: true },
			});
			if (overlap) return null;
			return transaction.availabilitySlot.create({
				data: {
					resourceId,
					createdByUserId: userId,
					startsAt,
					endsAt,
					status: body.publish ? 'PUBLISHED' : 'DRAFT',
				},
			});
		},
		{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
	);

export const updateSlot = async (resourceId: string, slotId: string, body: UpdateSlotBody) =>
	prisma.$transaction(
		async transaction => {
			const current = await transaction.availabilitySlot.findFirst({
				where: { id: slotId, resourceId },
				include: { bookings: { where: { status: 'CONFIRMED' }, select: { id: true } } },
			});
			if (!current) return { kind: 'not-found' as const };
			if (current.updatedAt.getTime() !== new Date(body.expectedUpdatedAt).getTime())
				return { kind: 'stale' as const };
			const startsAt = body.startsAt ? new Date(body.startsAt) : current.startsAt;
			const endsAt = body.endsAt ? new Date(body.endsAt) : current.endsAt;
			if (startsAt >= endsAt) return { kind: 'invalid' as const };
			const changesInterval =
				startsAt.getTime() !== current.startsAt.getTime() ||
				endsAt.getTime() !== current.endsAt.getTime();
			if (current.bookings.length > 0 && (changesInterval || body.status === 'WITHDRAWN'))
				return { kind: 'booked' as const };
			if (startsAt <= new Date()) return { kind: 'past' as const };
			const nextStatus = body.status ?? current.status;
			if (nextStatus !== 'WITHDRAWN') {
				const overlap = await transaction.availabilitySlot.findFirst({
					where: {
						id: { not: slotId },
						resourceId,
						status: { in: ['DRAFT', 'PUBLISHED'] },
						startsAt: { lt: endsAt },
						endsAt: { gt: startsAt },
					},
					select: { id: true },
				});
				if (overlap) return { kind: 'overlap' as const };
			}
			const slot = await transaction.availabilitySlot.update({
				where: { id: slotId },
				data: { startsAt, endsAt, status: nextStatus },
			});
			return { kind: 'updated' as const, slot };
		},
		{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
	);

export const createBooking = async (userId: string, slotId: string, idempotencyKey: string) =>
	prisma.$transaction(
		async transaction => {
			const existing = await transaction.booking.findUnique({
				where: { userId_idempotencyKey: { userId, idempotencyKey } },
			});
			if (existing)
				return existing.availabilitySlotId === slotId
					? { booking: existing, repeated: true, idempotencyConflict: false }
					: { booking: existing, repeated: true, idempotencyConflict: true };
			const slot = await transaction.availabilitySlot.findFirst({
				where: {
					id: slotId,
					status: 'PUBLISHED',
					startsAt: { gt: new Date() },
					bookings: { none: { status: 'CONFIRMED' } },
					resource: {
						status: 'ACTIVE',
						deletedAt: null,
						venue: {
							status: 'ACTIVE',
							deletedAt: null,
							organization: { status: 'ACTIVE', deletedAt: null },
						},
					},
				},
				select: { id: true, resourceId: true },
			});
			if (!slot) return null;
			const booking = await transaction.booking.create({
				data: { userId, resourceId: slot.resourceId, availabilitySlotId: slot.id, idempotencyKey },
			});
			return { booking, repeated: false, idempotencyConflict: false };
		},
		{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
	);

export const listOwnBookings = async (userId: string, page = 1, pageSize = 20) => {
	const { skip, take, meta } = normalizePagination({ page, pageSize });
	const [data, total] = await Promise.all([
		prisma.booking.findMany({
			where: { userId },
			include: { resource: { select: resourceSelect }, availabilitySlot: true },
			skip,
			take,
			orderBy: { createdAt: 'desc' },
		}),
		prisma.booking.count({ where: { userId } }),
	]);
	return { data, meta: meta(total) };
};

export const cancelOwnBooking = async (userId: string, bookingId: string) =>
	prisma.booking.updateMany({
		where: {
			id: bookingId,
			userId,
			status: 'CONFIRMED',
			availabilitySlot: { startsAt: { gt: new Date() } },
		},
		data: { status: 'CANCELLED', cancelledAt: new Date() },
	});

export const getOwnBooking = (userId: string, bookingId: string) =>
	prisma.booking.findFirst({ where: { id: bookingId, userId } });
