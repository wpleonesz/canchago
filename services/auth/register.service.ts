import { prisma } from '@/database/client';
import { accessRequestDb } from '@/database/organizaciones-sedes';
import { createFromRegistration } from '@/database/users';
import { BusinessRuleError } from '@/errors/business-rule-error';
import { ConflictError } from '@/errors/conflict-error';
import {
	createKeycloakUser,
	deleteKeycloakUser,
	KeycloakUserConflictError,
} from '@/lib/oauth/admin';
import { logger } from '@/lib/logger';
import type { RegisterBody } from '@/validations/auth/register.validation';

const FUTBOLISTA_ROLE_CODE = 'futbolista';

export type RegisterResult =
	| {
			accountType: 'futbolista';
			user: { id: string; email: string; firstName: string; lastName: string };
	  }
	| {
			accountType: 'gestor-de-cancha';
			user: { id: string; email: string; firstName: string; lastName: string };
			accessRequestId: string;
			organizationStatus: 'PENDING_APPROVAL';
	  };

/**
 * Orquesta el registro público (feature 016): valida unicidad en Canchago antes de gastar una
 * llamada a Keycloak, crea la identidad real ahí, y luego crea el registro en Canchago. Si el
 * paso de Canchago falla después de haber creado el usuario en Keycloak, revierte (elimina) ese
 * usuario antes de propagar el error — nunca deja una cuenta a medias en Keycloak sin registro
 * en Canchago.
 */
export const register = async (body: RegisterBody): Promise<RegisterResult> => {
	const existingUser = await prisma.user.findUnique({ where: { email: body.email } });

	if (existingUser) {
		throw new ConflictError('Ya existe una cuenta con ese correo electrónico.');
	}

	let keycloakId: string;

	try {
		const created = await createKeycloakUser({
			email: body.email,
			password: body.password,
			firstName: body.firstName,
			lastName: body.lastName,
		});
		keycloakId = created.keycloakId;
	} catch (error) {
		if (error instanceof KeycloakUserConflictError) {
			throw new ConflictError(error.message);
		}

		throw error;
	}

	try {
		if (body.accountType === 'futbolista') {
			// El rol está fijado en código, nunca viene del body de la petición — no hay
			// superficie de escalamiento que proteger aquí (ver spec 016, "Decisiones").
			const futbolistaRole = await prisma.role.findFirst({
				where: { code: FUTBOLISTA_ROLE_CODE, organizationId: null, deletedAt: null },
				select: { id: true },
			});

			if (!futbolistaRole) {
				throw new BusinessRuleError(
					'El rol Futbolista no está disponible en este entorno. Contacta a soporte.',
				);
			}

			const user = await createFromRegistration(
				keycloakId,
				{ email: body.email, firstName: body.firstName, lastName: body.lastName },
				futbolistaRole.id,
			);

			return {
				accountType: 'futbolista',
				user: {
					id: user.id,
					email: user.email,
					firstName: user.profile?.firstName ?? body.firstName,
					lastName: user.profile?.lastName ?? body.lastName,
				},
			};
		}

		// accountType === 'gestor-de-cancha' — validado por registerSchema.superRefine que
		// `organization`/`venue` vienen presentes en este caso. Usuario + organización + sede +
		// solicitud se crean en UNA sola transacción (ver createUserWithAccessRequest) — si
		// cualquiera de los pasos falla, ninguno queda a medias.
		const { user, accessRequest } = await accessRequestDb.createUserWithAccessRequest(
			keycloakId,
			{ email: body.email, firstName: body.firstName, lastName: body.lastName },
			body.organization!,
			body.venue!,
		);

		return {
			accountType: 'gestor-de-cancha',
			user: {
				id: user.id,
				email: user.email,
				firstName: body.firstName,
				lastName: body.lastName,
			},
			accessRequestId: accessRequest.id,
			organizationStatus: 'PENDING_APPROVAL',
		};
	} catch (error) {
		try {
			await deleteKeycloakUser(keycloakId);
		} catch (cleanupError) {
			logger.error(
				{ keycloakId, cleanupError },
				'No se pudo revertir la creación del usuario en Keycloak tras un fallo en Canchago — requiere limpieza manual.',
			);
		}

		throw error;
	}
};
