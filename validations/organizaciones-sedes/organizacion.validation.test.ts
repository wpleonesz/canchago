import { describe, expect, it } from 'vitest';

import { createOrganizationSchema, updateOrganizationSchema } from './organizacion.validation';

describe('validación de organizaciones', () => {
	it('acepta un payload de creación válido', () => {
		const result = createOrganizationSchema.safeParse({ name: 'Cancha Central' });
		expect(result.success).toBe(true);
	});

	it('rechaza mass assignment en creación', () => {
		expect(
			createOrganizationSchema.safeParse({
				name: 'Cancha Central',
				id: '550e8400-e29b-41d4-a716-446655440000',
				status: 'ACTIVE',
			}).success,
		).toBe(false);
	});

	it('exige expectedUpdatedAt en PATCH', () => {
		expect(updateOrganizationSchema.safeParse({ name: 'Otro nombre' }).success).toBe(false);
		expect(
			updateOrganizationSchema.safeParse({
				name: 'Otro nombre',
				expectedUpdatedAt: '2026-08-29T12:00:00.000Z',
			}).success,
		).toBe(true);
	});

	it('rechaza mass assignment en PATCH', () => {
		expect(
			updateOrganizationSchema.safeParse({
				expectedUpdatedAt: '2026-08-29T12:00:00.000Z',
				id: '550e8400-e29b-41d4-a716-446655440000',
			}).success,
		).toBe(false);
	});

	it('exige al menos un campo editable además de expectedUpdatedAt', () => {
		expect(
			updateOrganizationSchema.safeParse({ expectedUpdatedAt: '2026-08-29T12:00:00.000Z' }).success,
		).toBe(false);
	});

	it('acepta status ACTIVE/INACTIVE en PATCH (feature 023)', () => {
		expect(
			updateOrganizationSchema.safeParse({
				status: 'INACTIVE',
				expectedUpdatedAt: '2026-08-29T12:00:00.000Z',
			}).success,
		).toBe(true);
		expect(
			updateOrganizationSchema.safeParse({
				status: 'ACTIVE',
				expectedUpdatedAt: '2026-08-29T12:00:00.000Z',
			}).success,
		).toBe(true);
	});

	it('rechaza PENDING_APPROVAL u otros valores de status en PATCH', () => {
		expect(
			updateOrganizationSchema.safeParse({
				status: 'PENDING_APPROVAL',
				expectedUpdatedAt: '2026-08-29T12:00:00.000Z',
			}).success,
		).toBe(false);
		expect(
			updateOrganizationSchema.safeParse({
				status: 'DELETED',
				expectedUpdatedAt: '2026-08-29T12:00:00.000Z',
			}).success,
		).toBe(false);
	});
});
