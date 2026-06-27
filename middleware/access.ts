import type { NextApiRequest, NextApiResponse } from 'next';
import type { NextHandler } from 'next-connect';

import { AuthorizationError } from '@/errors/auth';

export const requirePermissions =
	(...requiredPermissions: string[]) =>
	async (req: NextApiRequest, _res: NextApiResponse, next: NextHandler): Promise<void> => {
		const permissions = req.user?.permissions ?? [];
		const grantedPermissions = new Set(permissions.map(permission => permission.code));

		const missingPermissions = requiredPermissions.filter(
			permission => !grantedPermissions.has(permission),
		);

		if (missingPermissions.length > 0) {
			throw new AuthorizationError(`Missing permissions: ${missingPermissions.join(', ')}`);
		}

		await next();
	};
