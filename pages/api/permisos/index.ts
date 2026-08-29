import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

import { routerOptions } from '@/lib/api/router-config';
import { throwValidationError } from '@/lib/errors/throw-validation-error';
import { access } from '@/middleware/access';
import { auth } from '@/middleware/auth';
import { permissionService } from '@/services/roles-permisos/permission.service';
import { permissionListQuerySchema } from '@/validations/roles-permisos/permission.validation';

const handler = createRouter<NextApiRequest, NextApiResponse>();

handler.use(auth).get(access('permisos.read'), async (req, res): Promise<void> => {
	const query = permissionListQuerySchema.safeParse(req.query);
	throwValidationError(query);

	const result = await permissionService.getPermissions(
		query.data.page,
		query.data.pageSize,
		query.data.search,
		query.data.module,
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
