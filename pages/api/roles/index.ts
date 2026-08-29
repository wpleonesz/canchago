import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

import { AuthenticationError } from '@/errors';
import { routerOptions } from '@/lib/api/router-config';
import { throwValidationError } from '@/lib/errors/throw-validation-error';
import { access } from '@/middleware/access';
import { auth } from '@/middleware/auth';
import { roleService } from '@/services/roles-permisos/role.service';
import {
	createRoleInputSchema,
	roleListQuerySchema,
} from '@/validations/roles-permisos/role.validation';

const handler = createRouter<NextApiRequest, NextApiResponse>();

handler
	.use(auth)
	.get(access('roles.read'), async (req, res): Promise<void> => {
		if (!req.user) throw new AuthenticationError();

		const parsed = roleListQuerySchema.safeParse(req.query);
		throwValidationError(parsed);
		const result = await roleService.getRoles(parsed.data, req.user);

		res.status(200).json({
			data: result.roles,
			meta: {
				page: result.page,
				pageSize: result.pageSize,
				total: result.total,
				totalPages: Math.ceil(result.total / result.pageSize),
			},
		});
	})
	.post(access('roles.manage'), async (req, res): Promise<void> => {
		if (!req.user) throw new AuthenticationError();

		const query = roleListQuerySchema.pick({ organizationId: true }).strict().safeParse(req.query);
		throwValidationError(query);
		const body = createRoleInputSchema.safeParse(req.body);
		throwValidationError(body);

		const role = await roleService.createRole(query.data.organizationId, body.data, req.user);
		res.status(201).json({ data: role });
	});

export default handler.handler(routerOptions);
