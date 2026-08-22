import { z } from 'zod';
import { VALIDATION_MESSAGES } from '../schemas';

// Espeja la política real del realm de Keycloak (ver keycloak/realm-canchago.json,
// `passwordPolicy: "length(8) and notUsername"`) — solo mejora UX, Keycloak sigue validando
// en última instancia al crear el usuario.
const passwordSchema = z.string().min(8, VALIDATION_MESSAGES.MIN_LENGTH(8));

const organizationInputSchema = z.object({
	name: z
		.string()
		.min(1, VALIDATION_MESSAGES.REQUIRED)
		.max(150, VALIDATION_MESSAGES.MAX_LENGTH(150)),
	legalName: z.string().max(200, VALIDATION_MESSAGES.MAX_LENGTH(200)).optional(),
	taxIdentification: z.string().max(30, VALIDATION_MESSAGES.MAX_LENGTH(30)).optional(),
	email: z.string().email(VALIDATION_MESSAGES.EMAIL).optional().or(z.literal('')),
	phone: z.string().max(20, VALIDATION_MESSAGES.MAX_LENGTH(20)).optional().or(z.literal('')),
	domain: z.string().max(255, VALIDATION_MESSAGES.MAX_LENGTH(255)).optional().or(z.literal('')),
});

const venueInputSchema = z.object({
	name: z
		.string()
		.min(1, VALIDATION_MESSAGES.REQUIRED)
		.max(150, VALIDATION_MESSAGES.MAX_LENGTH(150)),
	address: z.string().max(500, VALIDATION_MESSAGES.MAX_LENGTH(500)).optional().or(z.literal('')),
	phone: z.string().max(20, VALIDATION_MESSAGES.MAX_LENGTH(20)).optional().or(z.literal('')),
	email: z.string().email(VALIDATION_MESSAGES.EMAIL).optional().or(z.literal('')),
});

export const registerSchema = z
	.object({
		email: z.string().email(VALIDATION_MESSAGES.EMAIL),
		password: passwordSchema,
		firstName: z
			.string()
			.min(1, VALIDATION_MESSAGES.REQUIRED)
			.max(100, VALIDATION_MESSAGES.MAX_LENGTH(100)),
		lastName: z
			.string()
			.min(1, VALIDATION_MESSAGES.REQUIRED)
			.max(100, VALIDATION_MESSAGES.MAX_LENGTH(100)),
		accountType: z.enum(['futbolista', 'gestor-de-cancha']),
		organization: organizationInputSchema.optional(),
		venue: venueInputSchema.optional(),
	})
	.superRefine((data, ctx) => {
		if (data.accountType !== 'gestor-de-cancha') {
			return;
		}

		if (!data.organization) {
			ctx.addIssue({
				code: 'custom',
				path: ['organization'],
				message: 'Los datos de la organización son obligatorios para este tipo de cuenta.',
			});
		}

		if (!data.venue) {
			ctx.addIssue({
				code: 'custom',
				path: ['venue'],
				message: 'Los datos de la sede son obligatorios para este tipo de cuenta.',
			});
		}
	});

export type RegisterBody = z.infer<typeof registerSchema>;
