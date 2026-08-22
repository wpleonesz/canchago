import { env } from '@/lib/config/env';

// API de administración de Keycloak — solo usada por el registro público (feature 016) para
// crear la identidad real de un usuario. Usa el cliente de servicio `canchago-registration-service`
// (client_credentials, rol de cliente `manage-users` de `realm-management` — mínimo privilegio,
// nunca una cuenta de administrador de realm completa). Ninguna otra parte del backend necesita esto.

const requireAdminCredentials = (): { clientId: string; clientSecret: string } => {
	if (!env.OAUTH_ADMIN_CLIENT_ID || !env.OAUTH_ADMIN_CLIENT_SECRET) {
		throw new Error(
			'OAUTH_ADMIN_CLIENT_ID/OAUTH_ADMIN_CLIENT_SECRET no están configuradas — el registro público no puede crear usuarios en Keycloak.',
		);
	}

	return { clientId: env.OAUTH_ADMIN_CLIENT_ID, clientSecret: env.OAUTH_ADMIN_CLIENT_SECRET };
};

/** `OAUTH_ISSUER` es `<base>/realms/<realm>` — la API de administración vive en `<base>/admin/realms/<realm>`. */
const getAdminBaseUrl = (): string => {
	const issuerUrl = new URL(env.OAUTH_ISSUER);
	const realm = issuerUrl.pathname.split('/').filter(Boolean).pop();

	if (!realm) {
		throw new Error('No se pudo determinar el realm de Keycloak a partir de OAUTH_ISSUER.');
	}

	return `${issuerUrl.origin}/admin/realms/${realm}`;
};

export const getAdminAccessToken = async (): Promise<string> => {
	const { clientId, clientSecret } = requireAdminCredentials();

	const response = await fetch(env.OAUTH_TOKEN_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
		},
		body: new URLSearchParams({ grant_type: 'client_credentials' }),
	});

	if (!response.ok) {
		throw new Error('No se pudo autenticar el servicio de registro contra Keycloak.');
	}

	const body = (await response.json()) as { access_token?: string };

	if (typeof body.access_token !== 'string') {
		throw new Error('Keycloak no devolvió un token de administración válido.');
	}

	return body.access_token;
};

export type CreateKeycloakUserInput = {
	email: string;
	password: string;
	firstName: string;
	lastName: string;
};

export class KeycloakUserConflictError extends Error {}

/** Crea el usuario en Keycloak y devuelve su `id` real (el que luego se usa como `providerAccountId`). */
export const createKeycloakUser = async (
	input: CreateKeycloakUserInput,
): Promise<{ keycloakId: string }> => {
	const accessToken = await getAdminAccessToken();
	const adminBaseUrl = getAdminBaseUrl();

	const response = await fetch(`${adminBaseUrl}/users`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${accessToken}`,
		},
		body: JSON.stringify({
			username: input.email,
			email: input.email,
			firstName: input.firstName,
			lastName: input.lastName,
			enabled: true,
			// Sin infraestructura de envío de correo hoy (ver spec 016, "Fuera de alcance") — se
			// refleja el estado real, no se finge una verificación que no ocurrió.
			emailVerified: false,
			credentials: [{ type: 'password', value: input.password, temporary: false }],
		}),
	});

	if (response.status === 409) {
		throw new KeycloakUserConflictError('Ya existe una cuenta con ese correo electrónico.');
	}

	if (!response.ok) {
		throw new Error('No se pudo crear el usuario en Keycloak.');
	}

	const location = response.headers.get('Location');
	const keycloakId = location?.split('/').filter(Boolean).pop();

	if (!keycloakId) {
		throw new Error('Keycloak no devolvió el identificador del usuario creado.');
	}

	return { keycloakId };
};

/** Compensación: si el paso posterior en Canchago falla, se revierte la creación en Keycloak. */
export const deleteKeycloakUser = async (keycloakId: string): Promise<void> => {
	const accessToken = await getAdminAccessToken();
	const adminBaseUrl = getAdminBaseUrl();

	await fetch(`${adminBaseUrl}/users/${keycloakId}`, {
		method: 'DELETE',
		headers: { Authorization: `Bearer ${accessToken}` },
	});
};
