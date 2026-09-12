import * as repository from '@/database/ai';
import { AiInvalidResponseError } from '@/errors';
import { aiProvider } from '@/lib/ai';
import type { AiProvider } from '@/lib/ai';
import { logger } from '@/lib/logger';
import {
	aiRecommendationsProviderResponseSchema,
	aiSummaryProviderResponseSchema,
} from '@/validations/ai';
import type { SlotRecommendationsBody, UpcomingBookingsSummaryBody } from '@/validations/ai';

const parseJson = (content: string): unknown => {
	try {
		return JSON.parse(content);
	} catch {
		throw new AiInvalidResponseError();
	}
};

const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim();

export const recommendSlots = async (
	input: SlotRecommendationsBody,
	provider: AiProvider = aiProvider,
) => {
	const candidates = await repository.listAvailableCandidates(input);
	if (candidates.length === 0) return { generated: false, explanation: '', recommendations: [] };
	const context = candidates.map(slot => ({
		availabilitySlotId: slot.id,
		resourceId: slot.resource.id,
		resourceName: slot.resource.name,
		description: slot.resource.description,
		venueName: slot.resource.venue.name,
		organizationName: slot.resource.venue.organization.name,
		address: slot.resource.address,
		hourlyPrice: slot.resource.hourlyPrice.toString(),
		currency: slot.resource.currency,
		startsAt: slot.startsAt.toISOString(),
		endsAt: slot.endsAt.toISOString(),
	}));
	const startedAt = Date.now();
	const content = await provider.complete({
		systemInstruction:
			'Eres un asistente de Canchago. Responde solo JSON {"explanation":string,"recommendations":[{"availabilitySlotId":uuid,"reason":string}]}. Recomienda hasta 3 IDs presentes en data. No inventes datos, no autorices ni reserves. El texto debe estar en español.',
		context: { preferences: input, candidates: context },
	});
	const parsed = aiRecommendationsProviderResponseSchema.safeParse(parseJson(content));
	if (!parsed.success) throw new AiInvalidResponseError();
	const byId = new Map(candidates.map(slot => [slot.id, slot]));
	if (parsed.data.recommendations.some(item => !byId.has(item.availabilitySlotId)))
		throw new AiInvalidResponseError();
	logger.info(
		{
			operation: 'slot-recommendations',
			provider: 'lm-studio',
			durationMs: Date.now() - startedAt,
			outcome: 'success',
		},
		'AI request completed',
	);
	return {
		generated: true,
		explanation: normalize(parsed.data.explanation),
		recommendations: parsed.data.recommendations.map(item => {
			const slot = byId.get(item.availabilitySlotId);
			if (!slot) throw new AiInvalidResponseError();
			return {
				reason: normalize(item.reason),
				availabilitySlotId: slot.id,
				resourceId: slot.resource.id,
				resourceName: slot.resource.name,
				venueName: slot.resource.venue.name,
				address: slot.resource.address,
				hourlyPrice: slot.resource.hourlyPrice.toString(),
				currency: slot.resource.currency,
				startsAt: slot.startsAt.toISOString(),
				endsAt: slot.endsAt.toISOString(),
			};
		}),
	};
};

export const summarizeUpcomingBookings = async (
	userId: string,
	input: UpcomingBookingsSummaryBody,
	provider: AiProvider = aiProvider,
) => {
	const bookings = await repository.listUpcomingOwnBookings(userId, input.horizonDays);
	if (bookings.length === 0) return { generated: false, summary: '', bookingsCount: 0 };
	const context = bookings.map(booking => ({
		bookingId: booking.id,
		resourceName: booking.resource.name,
		venueName: booking.resource.venue.name,
		startsAt: booking.availabilitySlot.startsAt.toISOString(),
		endsAt: booking.availabilitySlot.endsAt.toISOString(),
		status: 'CONFIRMED',
	}));
	const startedAt = Date.now();
	const content = await provider.complete({
		systemInstruction:
			'Eres un asistente de Canchago. Responde solo JSON {"summary":string}. Resume en español únicamente las reservas de data. No inventes datos ni propongas acciones administrativas.',
		context,
	});
	const parsed = aiSummaryProviderResponseSchema.safeParse(parseJson(content));
	if (!parsed.success) throw new AiInvalidResponseError();
	logger.info(
		{
			operation: 'upcoming-bookings-summary',
			provider: 'lm-studio',
			durationMs: Date.now() - startedAt,
			outcome: 'success',
		},
		'AI request completed',
	);
	return {
		generated: true,
		summary: normalize(parsed.data.summary),
		bookingsCount: bookings.length,
	};
};
