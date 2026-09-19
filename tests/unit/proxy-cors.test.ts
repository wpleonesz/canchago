import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import { proxy } from '@/proxy';

// La app nativa llama desde otro origen, así que el preflight debe anunciar todos los métodos que usa la API;
// si falta uno (p. ej. PUT del avatar y de weekday-discounts) el WebView bloquea la petición antes de enviarla.
describe('CORS proxy', () => {
	it('anuncia PUT junto al resto de métodos en el preflight', () => {
		const response = proxy(
			new NextRequest('http://localhost:3000/api/profile/avatar', {
				method: 'OPTIONS',
				headers: { origin: 'http://localhost', 'access-control-request-method': 'PUT' },
			}),
		);

		expect(response.status).toBe(204);
		const methods = (response.headers.get('access-control-allow-methods') ?? '').split(',');
		expect(methods).toEqual(
			expect.arrayContaining(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']),
		);
	});

	it('añade las cabeceras CORS a las respuestas normales', () => {
		const response = proxy(new NextRequest('http://localhost:3000/api/profile', { method: 'GET' }));

		expect(response.headers.get('access-control-allow-origin')).toBe('*');
		expect(response.headers.get('access-control-allow-methods')).toContain('PUT');
	});
});
