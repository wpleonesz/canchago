import { z } from 'zod';
import { VALIDATION_MESSAGES } from '../schemas';

const ALLOWED_ORDER_BY = ['name', 'email', 'createdAt'] as const;
const ALLOWED_ORDER = ['asc', 'desc'] as const;

export const createUserSchema = z.object({
	email: z.string().email(VALIDATION_MESSAGES.EMAIL),
	firstName: z
		.string()
		.min(1, VALIDATION_MESSAGES.REQUIRED)
		.max(100, VALIDATION_MESSAGES.MAX_LENGTH(100)),
	lastName: z
		.string()
		.min(1, VALIDATION_MESSAGES.REQUIRED)
		.max(100, VALIDATION_MESSAGES.MAX_LENGTH(100)),
	organizationId: z.string().uuid(VALIDATION_MESSAGES.UUID),
	roleIds: z.array(z.string().uuid(VALIDATION_MESSAGES.UUID)).optional(),
});

export const updateUserSchema = createUserSchema.partial();

export const userQuerySchema = z.object({
	page: z.coerce.number().int().min(1, VALIDATION_MESSAGES.MIN_VALUE(1)).optional(),
	pageSize: z.coerce
		.number()
		.int()
		.min(1, VALIDATION_MESSAGES.MIN_VALUE(1))
		.max(100, VALIDATION_MESSAGES.MAX_VALUE(100))
		.optional(),
	organizationId: z.string().uuid(VALIDATION_MESSAGES.UUID).optional(),
	active: z.coerce.boolean().optional(),
	search: z.string().max(255, VALIDATION_MESSAGES.MAX_LENGTH(255)).optional(),
	orderBy: z.enum(ALLOWED_ORDER_BY).optional(),
	order: z.enum(ALLOWED_ORDER).optional(),
});

export const userParamsSchema = z.object({
	userId: z.string().uuid(VALIDATION_MESSAGES.UUID),
});

const profileNameSchema = z
	.string()
	.trim()
	.min(1, VALIDATION_MESSAGES.REQUIRED)
	.max(100, VALIDATION_MESSAGES.MAX_LENGTH(100));

export const updateAdminUserProfileSchema = z
	.object({
		firstName: profileNameSchema.optional(),
		lastName: profileNameSchema.optional(),
		expectedProfileUpdatedAt: z.iso.datetime({ offset: true }),
	})
	.strict()
	.refine(body => body.firstName !== undefined || body.lastName !== undefined, {
		message: 'Debes enviar al menos un dato de perfil para actualizar.',
	});

const OPTIONAL_PROFILE_FIELDS = [
	'phone',
	'facebookUrl',
	'instagramUrl',
	'linkedinUrl',
	'xUrl',
	'githubUrl',
	'tiktokUrl',
	'websiteUrl',
] as const;

const optionalPhoneSchema = z
	.union([z.string().trim().max(16), z.null()])
	.refine(value => value === null || value === '' || /^\+[1-9]\d{7,14}$/u.test(value), {
		message: 'El celular debe usar formato internacional, por ejemplo +593999999999.',
	});

const buildOptionalUrlSchema = (domains?: string[]) =>
	z.union([z.string().trim().max(500), z.null()]).refine(value => {
		if (value === null || value === '') return true;

		try {
			const url = new URL(value);
			if (url.protocol !== 'https:' || url.username || url.password) return false;
			if (!domains) return true;
			const hostname = url.hostname.toLowerCase();
			return domains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
		} catch {
			return false;
		}
	}, 'Ingresa una URL HTTPS válida para esta plataforma.');

export const updateOwnProfileSchema = z
	.object({
		phone: optionalPhoneSchema.optional(),
		facebookUrl: buildOptionalUrlSchema(['facebook.com']).optional(),
		instagramUrl: buildOptionalUrlSchema(['instagram.com']).optional(),
		linkedinUrl: buildOptionalUrlSchema(['linkedin.com']).optional(),
		xUrl: buildOptionalUrlSchema(['x.com', 'twitter.com']).optional(),
		githubUrl: buildOptionalUrlSchema(['github.com']).optional(),
		tiktokUrl: buildOptionalUrlSchema(['tiktok.com']).optional(),
		websiteUrl: buildOptionalUrlSchema().optional(),
		expectedProfileUpdatedAt: z.iso.datetime({ offset: true }),
	})
	.strict()
	.refine(body => OPTIONAL_PROFILE_FIELDS.some(field => body[field] !== undefined), {
		message: 'Debes enviar al menos un dato de perfil para actualizar.',
	});

export const updateOwnAvatarSchema = z
	.object({
		imageBase64: z
			.string()
			.min(4)
			.regex(/^[A-Za-z0-9+/]+={0,2}$/u, 'La imagen no tiene una codificación base64 válida.'),
		mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
	})
	.strict();

export const userRolesQuerySchema = z.object({
	page: z.coerce.number().int().min(1, VALIDATION_MESSAGES.MIN_VALUE(1)).optional(),
	pageSize: z.coerce
		.number()
		.int()
		.min(1, VALIDATION_MESSAGES.MIN_VALUE(1))
		.max(100, VALIDATION_MESSAGES.MAX_VALUE(100))
		.optional(),
});

export const assignUserRolesSchema = z.object({
	roleIds: z
		.array(z.string().uuid(VALIDATION_MESSAGES.UUID))
		.min(1, VALIDATION_MESSAGES.REQUIRED)
		.refine(roleIds => new Set(roleIds).size === roleIds.length, {
			message: 'roleIds no puede contener valores duplicados.',
		}),
});

export const userRoleParamsSchema = userParamsSchema.extend({
	roleId: z.string().uuid(VALIDATION_MESSAGES.UUID),
});

export type CreateUserBody = z.infer<typeof createUserSchema>;
export type UpdateUserBody = z.infer<typeof updateUserSchema>;
export type UserQueryParams = z.infer<typeof userQuerySchema>;
export type UserParams = z.infer<typeof userParamsSchema>;
export type UpdateAdminUserProfileBody = z.infer<typeof updateAdminUserProfileSchema>;
export type UpdateOwnProfileBody = z.infer<typeof updateOwnProfileSchema>;
export type UpdateOwnAvatarBody = z.infer<typeof updateOwnAvatarSchema>;
export type UserRolesQuery = z.infer<typeof userRolesQuerySchema>;
