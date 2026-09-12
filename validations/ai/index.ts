import { z } from 'zod';

export const AI_MAX_CANDIDATES = 12;
export const AI_MAX_OUTPUT_CHARACTERS = 2000;
export const AI_MAX_SUMMARY_DAYS = 30;

const instant = z.iso.datetime({ offset: true });

export const slotRecommendationsSchema = z
	.object({
		from: instant,
		to: instant,
		preferredTimeOfDay: z.enum(['MORNING', 'AFTERNOON', 'EVENING']).optional(),
		maxHourlyPrice: z.coerce.number().nonnegative().max(999999.99).optional(),
	})
	.strict()
	.superRefine((value, context) => {
		const from = new Date(value.from);
		const to = new Date(value.to);
		if (from >= to)
			context.addIssue({
				code: 'custom',
				path: ['to'],
				message: 'El fin debe ser posterior al inicio.',
			});
		if (from <= new Date())
			context.addIssue({
				code: 'custom',
				path: ['from'],
				message: 'El rango debe comenzar en el futuro.',
			});
		if (to.getTime() - from.getTime() > 7 * 24 * 60 * 60 * 1000)
			context.addIssue({
				code: 'custom',
				path: ['to'],
				message: 'El rango no puede superar siete días.',
			});
	});

export const upcomingBookingsSummarySchema = z
	.object({ horizonDays: z.coerce.number().int().min(1).max(AI_MAX_SUMMARY_DAYS).default(7) })
	.strict();

export const aiRecommendationsProviderResponseSchema = z
	.object({
		explanation: z.string().trim().min(1).max(AI_MAX_OUTPUT_CHARACTERS),
		recommendations: z
			.array(
				z
					.object({
						availabilitySlotId: z.string().uuid(),
						reason: z.string().trim().min(1).max(500),
					})
					.strict(),
			)
			.max(5),
	})
	.strict();

export const aiSummaryProviderResponseSchema = z
	.object({ summary: z.string().trim().min(1).max(AI_MAX_OUTPUT_CHARACTERS) })
	.strict();

export type SlotRecommendationsBody = z.infer<typeof slotRecommendationsSchema>;
export type UpcomingBookingsSummaryBody = z.infer<typeof upcomingBookingsSummarySchema>;
