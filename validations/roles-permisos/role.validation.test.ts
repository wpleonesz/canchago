import { describe, expect, it } from 'vitest';

import {
	createRoleInputSchema,
	roleListQuerySchema,
	updateRoleInputSchema,
} from './role.validation';

const PERMISSION_ID = '550e8400-e29b-41d4-a716-446655440001';

describe('validación administrativa de roles', () => {
	it('normaliza nombre y descripción al crear', () => {
		const result = createRoleInputSchema.parse({
			name: '  Recepción   Principal ',
			description: '  Atención de reservas  ',
		});

		expect(result).toEqual({
			name: 'Recepción Principal',
			description: 'Atención de reservas',
			permissionIds: [],
		});
	});

	it('rechaza caracteres y atributos protegidos', () => {
		expect(createRoleInputSchema.safeParse({ name: 'Admin<script>' }).success).toBe(false);
		expect(createRoleInputSchema.safeParse({ name: 'Recepción', isSystem: true }).success).toBe(
			false,
		);
	});

	it('rechaza permissionIds duplicados', () => {
		expect(
			createRoleInputSchema.safeParse({
				name: 'Recepción',
				permissionIds: [PERMISSION_ID, PERMISSION_ID],
			}).success,
		).toBe(false);
	});

	it('exige versión y al menos un campo editable en PATCH', () => {
		expect(updateRoleInputSchema.safeParse({ name: 'Recepción' }).success).toBe(false);
		expect(
			updateRoleInputSchema.safeParse({ expectedUpdatedAt: '2026-08-29T12:00:00.000Z' }).success,
		).toBe(false);
	});

	it('rechaza mass assignment en PATCH', () => {
		expect(
			updateRoleInputSchema.safeParse({
				name: 'Recepción',
				expectedUpdatedAt: '2026-08-29T12:00:00.000Z',
				code: 'administrador',
			}).success,
		).toBe(false);
	});

	it('acepta búsqueda, filtro y orden remotos permitidos', () => {
		expect(
			roleListQuerySchema.parse({
				organizationId: '550e8400-e29b-41d4-a716-446655440000',
				search: 'recepción',
				isSystem: 'false',
				orderBy: 'name',
				order: 'asc',
			}),
		).toMatchObject({ page: 1, pageSize: 20, isSystem: false, orderBy: 'name' });
	});

	it('rechaza ordenamientos y queries desconocidos', () => {
		expect(
			roleListQuerySchema.safeParse({
				organizationId: '550e8400-e29b-41d4-a716-446655440000',
				orderBy: 'permissions',
			}).success,
		).toBe(false);
		expect(
			roleListQuerySchema.safeParse({
				organizationId: '550e8400-e29b-41d4-a716-446655440000',
				deletedAt: '2026-08-29',
			}).success,
		).toBe(false);
	});
});
