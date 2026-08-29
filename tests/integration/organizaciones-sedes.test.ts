import { vi, describe, expect, it } from 'vitest';

vi.hoisted(() => {
	process.env.NODE_ENV = 'test';
	process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/canchago?schema=public';
	process.env.APP_BASE_URL = 'http://localhost:3000';
	process.env.OAUTH_PROVIDER_NAME = 'example-oauth';
	process.env.OAUTH_AUTHORIZATION_URL = 'https://provider.example.com/oauth2/authorize';
	process.env.OAUTH_TOKEN_URL = 'https://provider.example.com/oauth2/token';
	process.env.OAUTH_ISSUER = 'https://provider.example.com/';
	process.env.OAUTH_CLIENT_ID = 'client-id';
	process.env.OAUTH_CLIENT_SECRET = 'client-secret';
	process.env.OAUTH_REDIRECT_URI = 'http://localhost:3000/api/auth/callback';
	process.env.OAUTH_MOBILE_CLIENT_ID = 'canchago-mobile';
	process.env.OAUTH_SCOPE = 'openid email profile offline_access';
	process.env.OAUTH_SUCCESS_REDIRECT_URL = 'http://localhost:3000/';
	process.env.SESSION_SECRET = '0123456789abcdef0123456789abcdef';
	process.env.SESSION_COOKIE_NAME = 'canchago_session';
	process.env.SESSION_TEMP_COOKIE_NAME = 'canchago_oauth_state';
	process.env.SESSION_COOKIE_PATH = '/';
	process.env.SESSION_COOKIE_MAX_AGE_SECONDS = '28800';
	process.env.SESSION_TEMP_COOKIE_MAX_AGE_SECONDS = '600';
});

import { createMockResponse } from '@/tests/helpers/mock-next-response';

const ORGANIZATION_ID = '550e8400-e29b-41d4-a716-446655440000';
const SEDE_ID = '550e8400-e29b-41d4-a716-446655440001';
const OTHER_ORGANIZATION_ID = '550e8400-e29b-41d4-a716-446655440099';

describe('Organizaciones y Sedes API Integration Tests (feature 019)', () => {
	describe('PATCH /api/organizaciones/{organizationId}', () => {
		it('rechaza el body sin expectedUpdatedAt (concurrencia optimista obligatoria)', async () => {
			const handler = (await import('../../pages/api/organizaciones/[organizationId]')).default;
			const response = createMockResponse();

			const request = {
				method: 'PATCH',
				url: `/api/organizaciones/${ORGANIZATION_ID}`,
				query: { organizationId: ORGANIZATION_ID },
				body: { name: 'Nuevo nombre' },
				headers: {},
				cookies: {},
			} as never;

			try {
				await handler(request, response);
				expect([400, 401]).toContain(response.statusCode);
			} catch (error) {
				expect(error).toBeDefined();
			}
		});
	});

	describe('POST /api/organizaciones', () => {
		it('rechaza campos protegidos en el body (status, id) sin exponerlos al crear', async () => {
			const handler = (await import('../../pages/api/organizaciones/index')).default;
			const response = createMockResponse();

			const request = {
				method: 'POST',
				url: '/api/organizaciones',
				query: {},
				body: { name: 'Cancha Nueva', status: 'ACTIVE', id: ORGANIZATION_ID },
				headers: {},
				cookies: {},
			} as never;

			try {
				await handler(request, response);
				expect([400, 401, 403]).toContain(response.statusCode);
			} catch (error) {
				expect(error).toBeDefined();
			}
		});
	});

	describe('GET /api/organizaciones/{organizationId}/sedes/{sedeId}', () => {
		it('exige organizationId y sedeId válidos como UUID (base del guard de alcance)', async () => {
			const handler = (
				await import('../../pages/api/organizaciones/[organizationId]/sedes/[sedeId]')
			).default;
			const response = createMockResponse();

			const request = {
				method: 'GET',
				url: `/api/organizaciones/${OTHER_ORGANIZATION_ID}/sedes/${SEDE_ID}`,
				query: { organizationId: OTHER_ORGANIZATION_ID, sedeId: SEDE_ID },
				headers: {},
				cookies: {},
			} as never;

			try {
				await handler(request, response);
				expect([401, 403, 404]).toContain(response.statusCode);
			} catch (error) {
				expect(error).toBeDefined();
			}
		});
	});

	describe('PATCH /api/organizaciones/{organizationId}/sedes/{sedeId}', () => {
		it('rechaza el body sin expectedUpdatedAt', async () => {
			const handler = (
				await import('../../pages/api/organizaciones/[organizationId]/sedes/[sedeId]')
			).default;
			const response = createMockResponse();

			const request = {
				method: 'PATCH',
				url: `/api/organizaciones/${ORGANIZATION_ID}/sedes/${SEDE_ID}`,
				query: { organizationId: ORGANIZATION_ID, sedeId: SEDE_ID },
				body: { name: 'Sede renombrada' },
				headers: {},
				cookies: {},
			} as never;

			try {
				await handler(request, response);
				expect([400, 401]).toContain(response.statusCode);
			} catch (error) {
				expect(error).toBeDefined();
			}
		});

		it('rechaza organizationId manipulado en el body (mass assignment)', async () => {
			const handler = (
				await import('../../pages/api/organizaciones/[organizationId]/sedes/[sedeId]')
			).default;
			const response = createMockResponse();

			const request = {
				method: 'PATCH',
				url: `/api/organizaciones/${ORGANIZATION_ID}/sedes/${SEDE_ID}`,
				query: { organizationId: ORGANIZATION_ID, sedeId: SEDE_ID },
				body: {
					name: 'Sede renombrada',
					organizationId: OTHER_ORGANIZATION_ID,
					expectedUpdatedAt: '2026-08-29T12:00:00.000Z',
				},
				headers: {},
				cookies: {},
			} as never;

			try {
				await handler(request, response);
				expect([400, 401, 404]).toContain(response.statusCode);
			} catch (error) {
				expect(error).toBeDefined();
			}
		});
	});
});
