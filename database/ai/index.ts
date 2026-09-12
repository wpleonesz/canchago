import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/database/client';
import { AI_MAX_CANDIDATES } from '@/validations/ai';
import type { SlotRecommendationsBody } from '@/validations/ai';

export const listAvailableCandidates = async (input: SlotRecommendationsBody) => {
	const slots = await prisma.availabilitySlot.findMany({
		where: {
			status: 'PUBLISHED',
			startsAt: { gte: new Date(input.from), lte: new Date(input.to) },
			bookings: { none: { status: 'CONFIRMED' } },
			resource: {
				status: 'ACTIVE',
				deletedAt: null,
				...(input.maxHourlyPrice === undefined
					? {}
					: { hourlyPrice: { lte: new Prisma.Decimal(input.maxHourlyPrice) } }),
				venue: {
					status: 'ACTIVE',
					deletedAt: null,
					organization: { status: 'ACTIVE', deletedAt: null },
				},
			},
		},
		select: {
			id: true,
			startsAt: true,
			endsAt: true,
			resource: {
				select: {
					id: true,
					name: true,
					description: true,
					address: true,
					hourlyPrice: true,
					currency: true,
					venue: { select: { name: true, organization: { select: { name: true } } } },
				},
			},
		},
		orderBy: { startsAt: 'asc' },
		take: AI_MAX_CANDIDATES * 3,
	});
	return slots.slice(0, AI_MAX_CANDIDATES);
};

export const listUpcomingOwnBookings = (userId: string, horizonDays: number) => {
	const until = new Date(Date.now() + horizonDays * 24 * 60 * 60 * 1000);
	return prisma.booking.findMany({
		where: {
			userId,
			status: 'CONFIRMED',
			availabilitySlot: { startsAt: { gt: new Date(), lte: until } },
		},
		select: {
			id: true,
			availabilitySlot: { select: { startsAt: true, endsAt: true } },
			resource: { select: { name: true, venue: { select: { name: true } } } },
		},
		orderBy: { availabilitySlot: { startsAt: 'asc' } },
		take: AI_MAX_CANDIDATES,
	});
};
