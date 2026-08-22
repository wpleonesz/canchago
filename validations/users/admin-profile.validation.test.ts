import { describe, expect, it } from 'vitest';

import { updateAdminUserProfileSchema } from './index';

const UPDATED_AT = '2026-08-21T12:00:00.000Z';

describe('updateAdminUserProfileSchema', () => {
	it('normaliza nombres válidos y conserva Unicode y espacios internos', () => {
		expect(
			updateAdminUserProfileSchema.parse({
				firstName: '  María José  ',
				lastName: ' Núñez ',
				expectedProfileUpdatedAt: UPDATED_AT,
			}),
		).toEqual({
			firstName: 'María José',
			lastName: 'Núñez',
			expectedProfileUpdatedAt: UPDATED_AT,
		});
	});

	it('rechaza cuerpos sin cambios, nombres vacíos o mayores a 100 caracteres', () => {
		expect(
			updateAdminUserProfileSchema.safeParse({ expectedProfileUpdatedAt: UPDATED_AT }).success,
		).toBe(false);
		expect(
			updateAdminUserProfileSchema.safeParse({
				firstName: '   ',
				expectedProfileUpdatedAt: UPDATED_AT,
			}).success,
		).toBe(false);
		expect(
			updateAdminUserProfileSchema.safeParse({
				lastName: 'a'.repeat(101),
				expectedProfileUpdatedAt: UPDATED_AT,
			}).success,
		).toBe(false);
	});

	it('rechaza timestamps inválidos y atributos protegidos', () => {
		expect(
			updateAdminUserProfileSchema.safeParse({
				firstName: 'Ada',
				expectedProfileUpdatedAt: 'ayer',
			}).success,
		).toBe(false);

		for (const protectedField of [
			'email',
			'username',
			'identification',
			'status',
			'roleIds',
			'permissions',
			'passwordHash',
			'userId',
		]) {
			expect(
				updateAdminUserProfileSchema.safeParse({
					firstName: 'Ada',
					expectedProfileUpdatedAt: UPDATED_AT,
					[protectedField]: 'valor-manipulado',
				}).success,
			).toBe(false);
		}
	});
});
