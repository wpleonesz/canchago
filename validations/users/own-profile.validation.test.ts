import { describe, expect, it } from 'vitest';

import { updateOwnAvatarSchema, updateOwnProfileSchema } from './index';

const UPDATED_AT = '2026-08-21T12:00:00.000Z';

describe('updateOwnProfileSchema', () => {
	it('acepta celular E.164, vacíos y URLs HTTPS de los dominios esperados', () => {
		expect(
			updateOwnProfileSchema.parse({
				phone: ' +593999999999 ',
				facebookUrl: 'https://www.facebook.com/persona',
				githubUrl: '',
				websiteUrl: null,
				expectedProfileUpdatedAt: UPDATED_AT,
			}),
		).toMatchObject({ phone: '+593999999999', githubUrl: '', websiteUrl: null });
	});

	it('rechaza teléfonos inválidos y URLs inseguras o de dominio incorrecto', () => {
		for (const body of [
			{ phone: '0999999999' },
			{ instagramUrl: 'http://instagram.com/persona' },
			{ linkedinUrl: 'https://linkedin.com.evil.example/persona' },
			{ xUrl: 'https://user:secret@x.com/persona' },
		]) {
			expect(
				updateOwnProfileSchema.safeParse({ ...body, expectedProfileUpdatedAt: UPDATED_AT }).success,
			).toBe(false);
		}
	});

	it('bloquea mass assignment de identidad, seguridad y autorización', () => {
		for (const field of ['email', 'username', 'roleIds', 'permissions', 'passwordHash', 'status']) {
			expect(
				updateOwnProfileSchema.safeParse({
					phone: null,
					expectedProfileUpdatedAt: UPDATED_AT,
					[field]: 'manipulado',
				}).success,
			).toBe(false);
		}
	});
});

describe('updateOwnAvatarSchema', () => {
	it('acepta solo MIME de imagen permitido y base64 puro', () => {
		expect(
			updateOwnAvatarSchema.safeParse({ imageBase64: 'YWJjZA==', mimeType: 'image/png' }).success,
		).toBe(true);
		expect(
			updateOwnAvatarSchema.safeParse({
				imageBase64: 'data:image/png;base64,YQ==',
				mimeType: 'image/png',
			}).success,
		).toBe(false);
		expect(
			updateOwnAvatarSchema.safeParse({ imageBase64: 'YWJjZA==', mimeType: 'image/svg+xml' })
				.success,
		).toBe(false);
	});
});
