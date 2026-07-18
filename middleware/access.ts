import type { NextApiRequest, NextApiResponse } from 'next';
import type { NextHandler } from 'next-connect';

import { AuthorizationError } from '@/errors/auth';
import { env } from '@/lib/config/env';
import { logger } from '@/lib/logger';

export const access =
	(...requiredPermissions: string[]) =>
	async (req: NextApiRequest, _res: NextApiResponse, next: NextHandler): Promise<void> => {
		if (env.NODE_ENV !== 'production' && env.BYPASS_ACCESS_CONTROL) {
			await next();
			return;
		}

		const permissions = req.user?.permissions ?? [];
		const grantedPermissions = new Set(permissions.map(permission => permission.code));

		const missingPermissions = requiredPermissions.filter(
			permission => !grantedPermissions.has(permission),
		);

		if (missingPermissions.length > 0) {
			// Los codigos de permiso son detalle interno: se registran para el equipo,
			// pero al usuario final solo le llega un mensaje claro y sin jerga.
			logger.warn(
				{ userId: req.user?.id, missingPermissions },
				'Acceso denegado por permisos faltantes',
			);

			throw new AuthorizationError();
		}

		await next();
	};
