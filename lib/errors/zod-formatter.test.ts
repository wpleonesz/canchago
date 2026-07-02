import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { formatZodError } from './zod-formatter';

describe('formatZodError', () => {
	it('should format a single validation error', () => {
		const schema = z.object({
			email: z.string().email('Invalid email format'),
		});

		const result = schema.safeParse({ email: 'not-an-email' });

		if (!result.success) {
			const formatted = formatZodError(result.error);

			expect(formatted).toHaveLength(1);
			expect(formatted[0]).toMatchObject({
				field: 'email',
				message: 'Invalid email format',
				type: 'invalid_format',
			});
		}
	});

	it('should format multiple validation errors', () => {
		const schema = z.object({
			email: z.string().email('Invalid email'),
			age: z.number().min(18, 'Must be 18 or older'),
		});

		const result = schema.safeParse({ email: 'invalid', age: 10 });

		if (!result.success) {
			const formatted = formatZodError(result.error);

			expect(formatted.length).toBeGreaterThanOrEqual(1);
			expect(formatted.some(d => d.field === 'email')).toBe(true);
		}
	});

	it('should format type validation errors', () => {
		const schema = z.object({
			count: z.number('Must be a number'),
		});

		const result = schema.safeParse({ count: 'not-a-number' });

		if (!result.success) {
			const formatted = formatZodError(result.error);

			expect(formatted[0]).toMatchObject({
				field: 'count',
				type: 'invalid_type',
			});
		}
	});

	it('should format nested field paths', () => {
		const schema = z.object({
			user: z.object({
				name: z.string().min(1, 'Name is required'),
			}),
		});

		const result = schema.safeParse({ user: { name: '' } });

		if (!result.success) {
			const formatted = formatZodError(result.error);

			expect(formatted[0].field).toBe('user.name');
		}
	});

	it('should include constraint information for size validations', () => {
		const schema = z.object({
			password: z.string().min(8, 'Too short'),
		});

		const result = schema.safeParse({ password: '123' });

		if (!result.success) {
			const formatted = formatZodError(result.error);

			expect(formatted[0]).toMatchObject({
				type: 'too_small',
				constraint: 'min_8',
			});
		}
	});

	it('should format enum validation errors', () => {
		const schema = z.object({
			status: z.enum(['active', 'inactive'], { message: 'Invalid status' }),
		});

		const result = schema.safeParse({ status: 'unknown' });

		if (!result.success) {
			const formatted = formatZodError(result.error);

			expect(formatted[0].field).toBe('status');
			expect(formatted[0].type).toBe('invalid_value');
		}
	});
});
