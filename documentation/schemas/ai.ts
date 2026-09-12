import { z } from 'zod';

import { registry } from '@/documentation/registry';
import { ErrorResponseSchema } from '@/documentation/responses/common';

const RecommendationRequest = z.object({
	from: z.string().datetime({ offset: true }),
	to: z.string().datetime({ offset: true }),
	preferredTimeOfDay: z.enum(['MORNING', 'AFTERNOON', 'EVENING']).optional(),
	maxHourlyPrice: z.number().nonnegative().optional(),
});
const Recommendation = z.object({
	availabilitySlotId: z.string().uuid(),
	resourceId: z.string().uuid(),
	resourceName: z.string(),
	venueName: z.string(),
	address: z.string(),
	hourlyPrice: z.string(),
	currency: z.literal('USD'),
	startsAt: z.string().datetime(),
	endsAt: z.string().datetime(),
	reason: z.string(),
});
const RecommendationResponse = z.object({
	data: z.object({
		generated: z.boolean(),
		explanation: z.string(),
		recommendations: z.array(Recommendation),
	}),
});
const SummaryRequest = z.object({ horizonDays: z.number().int().min(1).max(30).default(7) });
const SummaryResponse = z.object({
	data: z.object({ generated: z.boolean(), summary: z.string(), bookingsCount: z.number().int() }),
});

registry.register('AiSlotRecommendationRequest', RecommendationRequest);
registry.register('AiSlotRecommendationResponse', RecommendationResponse);
registry.register('AiUpcomingBookingsSummaryRequest', SummaryRequest);
registry.register('AiUpcomingBookingsSummaryResponse', SummaryResponse);

const errors = Object.fromEntries(
	[400, 401, 403, 429, 502, 503, 504].map(status => [
		status,
		{
			description: 'Error normalizado',
			content: { 'application/json': { schema: ErrorResponseSchema } },
		},
	]),
);

registry.registerPath({
	method: 'post',
	path: '/ai/slot-recommendations',
	tags: ['Inteligencia artificial'],
	summary: 'Recomienda franjas reales disponibles mediante IA',
	description:
		'Consulta primero la fuente de verdad de Canchago. La IA no reserva ni autoriza acciones.',
	security: [{ cookieAuth: [] }, { bearerAuth: [] }],
	request: { body: { content: { 'application/json': { schema: RecommendationRequest } } } },
	responses: {
		200: {
			description: 'Recomendaciones normalizadas',
			content: { 'application/json': { schema: RecommendationResponse } },
		},
		...errors,
	},
});

registry.registerPath({
	method: 'post',
	path: '/ai/upcoming-bookings-summary',
	tags: ['Inteligencia artificial'],
	summary: 'Resume las próximas reservas del usuario autenticado',
	description: 'No acepta userId y nunca consulta reservas de otra persona.',
	security: [{ cookieAuth: [] }, { bearerAuth: [] }],
	request: { body: { content: { 'application/json': { schema: SummaryRequest } } } },
	responses: {
		200: {
			description: 'Resumen normalizado o estado vacío',
			content: { 'application/json': { schema: SummaryResponse } },
		},
		...errors,
	},
});
