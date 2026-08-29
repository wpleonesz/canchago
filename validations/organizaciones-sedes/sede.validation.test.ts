import { describe, expect, it } from 'vitest';

import {
	createSedeSchema,
	sedeCollectionParamsSchema,
	sedeQuerySchema,
	updateSedeSchema,
} from './sede.validation';

describe('validación de sedes', () => {
	it('acepta un payload de creación válido', () => {
		expect(createSedeSchema.safeParse({ name: 'Sede Norte' }).success).toBe(true);
	});

	it('rechaza mass assignment en creación, incluyendo organizationId', () => {
		expect(
			createSedeSchema.safeParse({
				name: 'Sede Norte',
				organizationId: '550e8400-e29b-41d4-a716-446655440000',
			}).success,
		).toBe(false);
	});

	it('exige expectedUpdatedAt en PATCH', () => {
		expect(updateSedeSchema.safeParse({ name: 'Sede Norte' }).success).toBe(false);
		expect(
			updateSedeSchema.safeParse({
				name: 'Sede Norte',
				expectedUpdatedAt: '2026-08-29T12:00:00.000Z',
			}).success,
		).toBe(true);
	});

	it('rechaza mass assignment en PATCH, incluyendo organizationId', () => {
		expect(
			updateSedeSchema.safeParse({
				expectedUpdatedAt: '2026-08-29T12:00:00.000Z',
				organizationId: '550e8400-e29b-41d4-a716-446655440000',
			}).success,
		).toBe(false);
	});

	it('sedeQuerySchema y sedeCollectionParamsSchema no son .strict(): comparten req.query en el listado', () => {
		// Ambos deben tolerar las claves de la otra schema al parsear el mismo objeto, o el
		// listado real (sedes/index.ts GET) rompería con 400 en cada petición.
		const sharedQuery = {
			organizationId: '550e8400-e29b-41d4-a716-446655440000',
			page: '1',
			search: 'norte',
		};
		expect(sedeCollectionParamsSchema.safeParse(sharedQuery).success).toBe(true);
		expect(sedeQuerySchema.safeParse(sharedQuery).success).toBe(true);
	});
});
