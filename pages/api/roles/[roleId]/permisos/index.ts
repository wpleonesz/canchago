import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

import { AuthenticationError } from '@/errors';
import { routerOptions } from '@/lib/api/router-config';
import { throwValidationError } from '@/lib/errors/throw-validation-error';
import { access } from '@/middleware/access';
import { auth } from '@/middleware/auth';
import { roleService } from '@/services/roles-permisos/role.service';
import { updateRolePermissionsSchema } from '@/validations/roles-permisos/permission.validation';
import { rolePermissionsQuerySchema } from '@/validations/roles-permisos/role.validation';

const handler = createRouter<NextApiRequest, NextApiResponse>();

handler
	.use(auth)
	.get(access('roles.read'), async (req, res): Promise<void> => {
		if (!req.user) throw new AuthenticationError();
		const query = rolePermissionsQuerySchema.safeParse(req.query);
		throwValidationError(query);

		const result = await roleService.getRolePermissions(
			query.data.roleId,
			query.data.organizationId,
			query.data.page,
			query.data.pageSize,
			req.user,
		);

		res.status(200).json({
			data: result.permissions,
			meta: {
				page: result.page,
				pageSize: result.pageSize,
				total: result.total,
				totalPages: Math.ceil(result.total / result.pageSize),
			},
		});
	})
	.patch(access('roles.manage'), async (req, res): Promise<void> => {
		if (!req.user) throw new AuthenticationError();
		const query = rolePermissionsQuerySchema
			.pick({ roleId: true, organizationId: true })
			.strict()
			.safeParse(req.query);
		throwValidationError(query);
		const body = updateRolePermissionsSchema.safeParse(req.body);
		throwValidationError(body);

		const role = await roleService.updateRole(
			query.data.roleId,
			query.data.organizationId,
			body.data,
			req.user,
		);
		res.status(200).json({ data: role });
	});

export default handler.handler(routerOptions);
