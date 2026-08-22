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

const findUniqueAuthAccount = vi.fn();
const findUniqueUser = vi.fn();
const updateUser = vi.fn();
const deleteManyAuthAccount = vi.fn();
const createAuthAccount = vi.fn();
const txUpdateUser = vi.fn();
const txCreateUser = vi.fn();

const tx = {
	authAccount: { deleteMany: deleteManyAuthAccount, create: createAuthAccount },
	user: { update: txUpdateUser, create: txCreateUser },
};

vi.mock('@/database/client', () => ({
	prisma: {
		authAccount: { findUnique: (...args: unknown[]) => findUniqueAuthAccount(...args) },
		user: {
			findUnique: (...args: unknown[]) => findUniqueUser(...args),
			update: (...args: unknown[]) => updateUser(...args),
		},
		$transaction: (callback: (client: typeof tx) => unknown) => callback(tx),
	},
}));

import { findOrSyncByOAuth } from './index';

const OAUTH_SUBJECT_NEW = 'keycloak-subject-new';
const EMAIL = 'admin@canchago.local';

const USER_WITH_ACCESS = {
	id: 'user-1',
	email: EMAIL,
	profile: { firstName: 'Admin', lastName: 'Prueba' },
	userRoles: [],
};

describe('findOrSyncByOAuth', () => {
	beforeEach(() => {
		findUniqueAuthAccount.mockReset();
		findUniqueUser.mockReset();
		updateUser.mockReset();
		deleteManyAuthAccount.mockReset();
		createAuthAccount.mockReset();
		txUpdateUser.mockReset();
		txCreateUser.mockReset();
	});

	it('re-enlaza un usuario existente por email cuando el AuthAccount no coincide por sujeto OAuth', async () => {
		// Caso real: se recreó el contenedor de Keycloak, que regenera los IDs internos de los
		// usuarios — el providerAccountId guardado ya no coincide con ninguno, pero el usuario
		// sigue existiendo en Canchago por email. Antes de este fix, esto intentaba crear un
		// User duplicado y fallaba con un 500 genérico (P2002 en `email`).
		findUniqueAuthAccount.mockResolvedValue(null);
		findUniqueUser
			.mockResolvedValueOnce({ id: 'user-1', email: EMAIL })
			.mockResolvedValueOnce(USER_WITH_ACCESS);
		txUpdateUser.mockResolvedValue({ id: 'user-1' });

		const result = await findOrSyncByOAuth(OAUTH_SUBJECT_NEW, EMAIL, 'Admin Prueba');

		expect(deleteManyAuthAccount).toHaveBeenCalledWith({
			where: { userId: 'user-1', provider: 'example-oauth' },
		});
		expect(createAuthAccount).toHaveBeenCalledWith({
			data: { userId: 'user-1', provider: 'example-oauth', providerAccountId: OAUTH_SUBJECT_NEW },
		});
		expect(result.user.id).toBe('user-1');
		expect(result.user.email).toBe(EMAIL);
	});

	it('crea un usuario nuevo cuando ni el AuthAccount ni el email coinciden con nada existente', async () => {
		findUniqueAuthAccount.mockResolvedValue(null);
		findUniqueUser.mockResolvedValueOnce(null).mockResolvedValueOnce({
			id: 'user-2',
			email: 'nuevo@canchago.local',
			profile: { firstName: 'Nuevo', lastName: 'Usuario' },
			userRoles: [],
		});
		txCreateUser.mockResolvedValue({ id: 'user-2' });

		const result = await findOrSyncByOAuth(
			'keycloak-subject-brand-new',
			'nuevo@canchago.local',
			'Nuevo Usuario',
		);

		expect(txCreateUser).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ email: 'nuevo@canchago.local' }),
			}),
		);
		expect(deleteManyAuthAccount).not.toHaveBeenCalled();
		expect(result.user.id).toBe('user-2');
	});

	it('actualiza el usuario existente in-place cuando el AuthAccount ya coincide (camino sin cambios)', async () => {
		findUniqueAuthAccount.mockResolvedValue({ userId: 'user-1' });
		updateUser.mockResolvedValue({ id: 'user-1' });
		findUniqueUser.mockResolvedValueOnce(USER_WITH_ACCESS);

		const result = await findOrSyncByOAuth('keycloak-subject-existing', EMAIL, 'Admin Prueba');

		expect(deleteManyAuthAccount).not.toHaveBeenCalled();
		expect(createAuthAccount).not.toHaveBeenCalled();
		expect(result.user.id).toBe('user-1');
	});
});
