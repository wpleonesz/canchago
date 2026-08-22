import { describe, expect, it } from 'vitest';

import {
	assignUserRolesSchema,
	createUserSchema,
	userRoleParamsSchema,
	userRolesQuerySchema,
} from './index';

const ROLE_ID = '123e4567-e89b-42d3-a456-426614174001';
const USER_ID = '123e4567-e89b-42d3-a456-426614174002';
const ORGANIZATION_ID = '123e4567-e89b-42d3-a456-426614174003';

describe('validaciones de roles de usuario', () => {
	it('acepta roleIds opcionales al crear un usuario', () => {
		const result = createUserSchema.safeParse({
			email: 'admin@example.com',
			firstName: 'Ada',
			lastName: 'Lovelace',
			organizationId: ORGANIZATION_ID,
			roleIds: [ROLE_ID],
		});

		expect(result.success).toBe(true);
	});

	it('rechaza roleIds malformados', () => {
		expect(assignUserRolesSchema.safeParse({ roleIds: ['no-es-uuid'] }).success).toBe(false);
	});

	it('rechaza arrays vacíos y roles duplicados en la asignación incremental', () => {
		expect(assignUserRolesSchema.safeParse({ roleIds: [] }).success).toBe(false);
		expect(assignUserRolesSchema.safeParse({ roleIds: [ROLE_ID, ROLE_ID] }).success).toBe(false);
	});

	it('normaliza y limita la paginación', () => {
		expect(userRolesQuerySchema.parse({ page: '2', pageSize: '10' })).toEqual({
			page: 2,
			pageSize: 10,
		});
		expect(userRolesQuerySchema.safeParse({ page: 0, pageSize: 101 }).success).toBe(false);
	});

	it('valida userId y roleId de la ruta de eliminación', () => {
		expect(userRoleParamsSchema.safeParse({ userId: USER_ID, roleId: ROLE_ID }).success).toBe(true);
		expect(userRoleParamsSchema.safeParse({ userId: USER_ID, roleId: 'invalid' }).success).toBe(
			false,
		);
	});
});
