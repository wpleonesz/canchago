import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

import { AuthenticationError } from '@/errors';
import { routerOptions } from '@/lib/api/router-config';
import { throwValidationError } from '@/lib/errors/throw-validation-error';
import { access } from '@/middleware/access';
import { auth } from '@/middleware/auth';
import { roleService } from '@/services/roles-permisos/role.service';
import {
	roleParamsSchema,
	updateRoleInputSchema,
} from '@/validations/roles-permisos/role.validation';

const handler = createRouter<NextApiRequest, NextApiResponse>();

handler
	.use(auth)
	.get(access('roles.read'), async (req, res): Promise<void> => {
		if (!req.user) throw new AuthenticationError();
		const params = roleParamsSchema.safeParse(req.query);
		throwValidationError(params);

		const role = await roleService.getRoleById(
			params.data.roleId,
			params.data.organizationId,
			req.user,
		);
		res.status(200).json({ data: role });
	})
	.patch(access('roles.manage'), async (req, res): Promise<void> => {
		if (!req.user) throw new AuthenticationError();
		const params = roleParamsSchema.safeParse(req.query);
		throwValidationError(params);
		const body = updateRoleInputSchema.safeParse(req.body);
		throwValidationError(body);

		const role = await roleService.updateRole(
			params.data.roleId,
			params.data.organizationId,
			body.data,
			req.user,
		);
		res.status(200).json({ data: role });
	})
	.delete(access('roles.manage'), async (req, res): Promise<void> => {
		if (!req.user) throw new AuthenticationError();
		const params = roleParamsSchema.safeParse(req.query);
		throwValidationError(params);

		await roleService.deleteRole(params.data.roleId, params.data.organizationId, req.user);
		res.status(204).end();
	});

export default handler.handler(routerOptions);
