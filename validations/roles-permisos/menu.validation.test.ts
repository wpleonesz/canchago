import { describe, expect, it } from 'vitest';

import { menuListQuerySchema } from './menu.validation';

describe('menuListQuerySchema', () => {
	it('aplica valores por defecto cuando no se envía nada', () => {
		const result = menuListQuerySchema.safeParse({});

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toEqual({ page: 1, pageSize: 20 });
		}
	});

	it('rechaza pageSize por encima del máximo permitido', () => {
		expect(menuListQuerySchema.safeParse({ pageSize: '101' }).success).toBe(false);
	});

	it('rechaza campos no soportados por el modelo real (mass assignment)', () => {
		expect(menuListQuerySchema.safeParse({ module: 'roles' }).success).toBe(false);
	});
});
