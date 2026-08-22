import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@/lib/session';

const ACTOR_ID = '550e8400-e29b-41d4-a716-446655440001';
const UPDATED_AT = '2026-08-21T12:00:00.000Z';
const getOwnProfile = vi.fn();
const updateOwnProfile = vi.fn();
const actingUser: SessionUser = {
	id: ACTOR_ID,
	email: 'user@example.com',
	name: 'User',
	roles: [],
	permissions: [],
};

vi.mock('@/middleware/auth', () => ({
	auth: async (req: never, _res: never, next: () => Promise<void>) => {
		(req as { user: SessionUser }).user = actingUser;
		await next();
	},
}));

vi.mock('@/services/users', () => ({
	userService: {
		getOwnProfile: (...args: unknown[]) => getOwnProfile(...args),
		updateOwnProfile: (...args: unknown[]) => updateOwnProfile(...args),
	},
}));

import { createMockResponse } from '../helpers/mock-next-response';

describe('/api/profile', () => {
	beforeEach(() => {
		getOwnProfile.mockReset();
		updateOwnProfile.mockReset();
	});

	it('obtiene exclusivamente el perfil asociado a la sesión', async () => {
		getOwnProfile.mockResolvedValue({ phone: null });
		const handler = (await import('../../pages/api/profile')).default;
		const response = createMockResponse();
		await handler(
			{
				method: 'GET',
				url: '/api/profile?userId=otro',
				query: { userId: 'otro' },
				headers: {},
				cookies: {},
			} as never,
			response,
		);
		expect(response.statusCode).toBe(200);
		expect(getOwnProfile).toHaveBeenCalledWith(ACTOR_ID);
	});

	it('evita IDOR y mass assignment aunque se manipulen query y payload', async () => {
		const handler = (await import('../../pages/api/profile')).default;
		const response = createMockResponse();
		await handler(
			{
				method: 'PATCH',
				url: '/api/profile?userId=otro',
				query: { userId: 'otro' },
				headers: {},
				cookies: {},
				body: {
					phone: '+593999999999',
					expectedProfileUpdatedAt: UPDATED_AT,
					userId: 'otro',
					roles: ['admin'],
				},
			} as never,
			response,
		);
		expect(response.statusCode).toBe(400);
		expect(updateOwnProfile).not.toHaveBeenCalled();
	});

	it('delega una actualización válida usando solo el id autenticado', async () => {
		updateOwnProfile.mockResolvedValue({ phone: '+593999999999' });
		const handler = (await import('../../pages/api/profile')).default;
		const response = createMockResponse();
		const body = { phone: '+593999999999', expectedProfileUpdatedAt: UPDATED_AT };
		await handler(
			{ method: 'PATCH', url: '/api/profile', query: {}, headers: {}, cookies: {}, body } as never,
			response,
		);
		expect(response.statusCode).toBe(200);
		expect(updateOwnProfile).toHaveBeenCalledWith(ACTOR_ID, body);
	});
});
