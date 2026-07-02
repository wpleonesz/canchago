import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

import { auth } from '@/middleware/auth';
import { access } from '@/middleware/access';
import { routerOptions } from '@/lib/api/router-config';
import { permissionService } from '@/services/roles-permisos/permission.service';
import { paginationSchema } from '@/validations/roles-permisos/role.validation';
import { throwValidationError } from '@/lib/errors/throw-validation-error';

const handler = createRouter<NextApiRequest, NextApiResponse>();

handler.use(auth).get(access('permisos.read'), async (req, res): Promise<void> => {
	const pagination = paginationSchema.safeParse(req.query);
	throwValidationError(pagination);

	const result = await permissionService.getPermissions(
		pagination.data.page,
		pagination.data.pageSize,
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
});

export default handler.handler(routerOptions);
