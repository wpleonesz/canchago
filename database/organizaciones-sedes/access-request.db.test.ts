import { vi, describe, expect, it, beforeEach } from 'vitest';

vi.hoisted(() => {
	process.env.NODE_ENV = 'test';
	process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/canchago?schema=public';
	process.env.APP_BASE_URL = 'http://localhost:3000';
	process.env.OAUTH_PROVIDER_NAME = 'example-oauth';
	process.env.OAUTH_AUTHORIZATION_URL = 'https://provider.example.com/oauth2/authorize';
	process.env.OAUTH_TOKEN_URL = 'https://provider.example.com/oauth2/token';
	process.env.OAUTH_ISSUER = 'https://provider.example.com/realms/canchago';
	process.env.OAUTH_CLIENT_ID = 'client-id';
	process.env.OAUTH_CLIENT_SECRET = 'client-secret';
	process.env.OAUTH_REDIRECT_URI = 'http://localhost:3000/api/auth/callback';
	process.env.OAUTH_MOBILE_CLIENT_ID = 'canchago-mobile';
	process.env.SESSION_SECRET = '0123456789abcdef0123456789abcdef';
});

const findUniqueAccessRequest = vi.fn();
const updateAccessRequest = vi.fn();
const updateOrganization = vi.fn();
const updateManyVenue = vi.fn();
const findFirstRole = vi.fn();
const createRole = vi.fn();
const createUserRole = vi.fn();

const tx = {
	organizationAccessRequest: {
		findUnique: findUniqueAccessRequest,
		update: updateAccessRequest,
	},
	organization: { update: updateOrganization },
	venue: { updateMany: updateManyVenue },
	role: { findFirst: findFirstRole, create: createRole },
	userRole: { create: createUserRole },
};

vi.mock('@/database/client', () => ({
	prisma: {
		$transaction: (callback: (client: typeof tx) => unknown) => callback(tx),
	},
}));

import { approveAccessRequest, rejectAccessRequest } from './access-request.db';

const REQUEST_ID = 'request-1';
const REVIEWER_ID = 'reviewer-1';

describe('approveAccessRequest', () => {
	beforeEach(() => {
		Object.values(tx.organizationAccessRequest).forEach(fn => fn.mockReset());
		updateOrganization.mockReset();
		updateManyVenue.mockReset();
		findFirstRole.mockReset();
		createRole.mockReset();
		createUserRole.mockReset();
	});

	it('rechaza con conflicto si la solicitud no existe', async () => {
		findUniqueAccessRequest.mockResolvedValue(null);

		await expect(approveAccessRequest(REQUEST_ID, REVIEWER_ID)).rejects.toMatchObject({
			statusCode: 404,
		});
	});

	it('rechaza con conflicto si la solicitud ya fue revisada', async () => {
		findUniqueAccessRequest.mockResolvedValue({
			id: REQUEST_ID,
			status: 'APPROVED',
			organizationId: 'org-1',
			userId: 'user-1',
		});

		await expect(approveAccessRequest(REQUEST_ID, REVIEWER_ID)).rejects.toMatchObject({
			statusCode: 409,
		});

		expect(updateOrganization).not.toHaveBeenCalled();
	});

	it('crea el rol Gestor de Cancha solo si no existe ya para esa organización', async () => {
		findUniqueAccessRequest.mockResolvedValue({
			id: REQUEST_ID,
			status: 'PENDING',
			organizationId: 'org-1',
			userId: 'user-1',
		});
		findFirstRole.mockResolvedValue({ id: 'existing-role' });
		updateAccessRequest.mockResolvedValue({ id: REQUEST_ID, status: 'APPROVED' });

		await approveAccessRequest(REQUEST_ID, REVIEWER_ID);

		expect(createRole).not.toHaveBeenCalled();
		expect(createUserRole).toHaveBeenCalledWith({
			data: { userId: 'user-1', roleId: 'existing-role', organizationId: 'org-1' },
		});
	});

	it('activa la organización y sus sedes al aprobar', async () => {
		findUniqueAccessRequest.mockResolvedValue({
			id: REQUEST_ID,
			status: 'PENDING',
			organizationId: 'org-1',
			userId: 'user-1',
		});
		findFirstRole.mockResolvedValue(null);
		createRole.mockResolvedValue({ id: 'new-role' });
		updateAccessRequest.mockResolvedValue({ id: REQUEST_ID, status: 'APPROVED' });

		await approveAccessRequest(REQUEST_ID, REVIEWER_ID);

		expect(updateOrganization).toHaveBeenCalledWith({
			where: { id: 'org-1' },
			data: { status: 'ACTIVE' },
		});
		expect(updateManyVenue).toHaveBeenCalledWith({
			where: { organizationId: 'org-1' },
			data: { status: 'ACTIVE' },
		});
	});
});

describe('rejectAccessRequest', () => {
	beforeEach(() => {
		findUniqueAccessRequest.mockReset();
		updateAccessRequest.mockReset();
	});

	it('rechaza con conflicto si ya fue revisada', async () => {
		findUniqueAccessRequest.mockResolvedValue({ id: REQUEST_ID, status: 'REJECTED' });

		await expect(rejectAccessRequest(REQUEST_ID, REVIEWER_ID)).rejects.toMatchObject({
			statusCode: 409,
		});
	});

	it('marca la solicitud como rechazada con el motivo dado', async () => {
		findUniqueAccessRequest.mockResolvedValue({ id: REQUEST_ID, status: 'PENDING' });
		updateAccessRequest.mockResolvedValue({ id: REQUEST_ID, status: 'REJECTED' });

		await rejectAccessRequest(REQUEST_ID, REVIEWER_ID, 'No cumple los requisitos');

		expect(updateAccessRequest).toHaveBeenCalledWith({
			where: { id: REQUEST_ID },
			data: {
				status: 'REJECTED',
				reviewedAt: expect.any(Date),
				reviewedByUserId: REVIEWER_ID,
				rejectionReason: 'No cumple los requisitos',
			},
			select: expect.anything(),
		});
	});
});
