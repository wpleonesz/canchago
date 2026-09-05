import { describe, expect, it } from 'vitest';

import { updateRolePermissionsSchema } from './permission.validation';

const PERMISSION_ID = '123e4567-e89b-42d3-a456-426614174003';
const UPDATED_AT = '2026-09-04T12:00:00.000Z';

describe('updateRolePermissionsSchema', () => {
	it('acepta el reemplazo completo, incluido el conjunto vacío', () => {
		expect(
			updateRolePermissionsSchema.safeParse({
				permissionIds: [],
				expectedUpdatedAt: UPDATED_AT,
			}).success,
		).toBe(true);
	});

	it('rechaza IDs duplicados', () => {
		expect(
			updateRolePermissionsSchema.safeParse({
				permissionIds: [PERMISSION_ID, PERMISSION_ID],
				expectedUpdatedAt: UPDATED_AT,
			}).success,
		).toBe(false);
	});

	it('rechaza mass assignment', () => {
		expect(
			updateRolePermissionsSchema.safeParse({
				permissionIds: [PERMISSION_ID],
				expectedUpdatedAt: UPDATED_AT,
				isSystem: false,
			}).success,
		).toBe(false);
	});
});
