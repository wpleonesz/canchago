import { describe, expect, it } from 'vitest';
import { availabilityQuerySchema, createBookingSchema, createSlotSchema } from './index';

describe('validaciones de agendamiento', () => {
	it('acepta franjas válidas cualquier día de lunes a domingo', () => {
		for (const day of [
			'2026-09-14',
			'2026-09-15',
			'2026-09-16',
			'2026-09-17',
			'2026-09-18',
			'2026-09-19',
			'2026-09-20',
		]) {
			expect(
				createSlotSchema.safeParse({
					startsAt: `${day}T10:00:00.000Z`,
					endsAt: `${day}T11:00:00.000Z`,
					publish: true,
				}).success,
			).toBe(true);
		}
	});

	it('rechaza una franja cuyo fin no es posterior al inicio', () => {
		expect(
			createSlotSchema.safeParse({
				startsAt: '2026-09-20T11:00:00.000Z',
				endsAt: '2026-09-20T10:00:00.000Z',
			}).success,
		).toBe(false);
	});

	it('valida rango de consulta e idempotencia', () => {
		expect(
			availabilityQuerySchema.safeParse({
				from: '2026-09-20T00:00:00.000Z',
				to: '2026-09-21T00:00:00.000Z',
			}).success,
		).toBe(true);
		expect(
			createBookingSchema.safeParse({
				availabilitySlotId: '11111111-1111-4111-8111-111111111111',
				idempotencyKey: 'request-123',
			}).success,
		).toBe(true);
	});
});
