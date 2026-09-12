import { describe, expect, it } from 'vitest';
import { Prisma } from '@/generated/prisma/client';
import { calculateTotalPrice } from './index';

describe('precio de reserva', () => {
	it('prorratea la tarifa horaria y redondea a dos decimales', () => {
		expect(calculateTotalPrice(new Prisma.Decimal('30.00'), 90).toString()).toBe('45');
		expect(calculateTotalPrice(new Prisma.Decimal('10.00'), 20).toString()).toBe('3.33');
	});
});
