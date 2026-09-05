import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

import { routerOptions } from '@/lib/api/router-config';
import { throwValidationError } from '@/lib/errors/throw-validation-error';
import { access } from '@/middleware/access';
import { auth } from '@/middleware/auth';
import { menuService } from '@/services/roles-permisos/menu.service';
import { menuListQuerySchema } from '@/validations/roles-permisos/menu.validation';

const handler = createRouter<NextApiRequest, NextApiResponse>();

handler.use(auth).get(access('menus.read'), async (req, res): Promise<void> => {
	const query = menuListQuerySchema.safeParse(req.query);
	throwValidationError(query);

	const result = await menuService.getMenus(query.data.page, query.data.pageSize);

	res.status(200).json({
		data: result.menus,
		meta: result.meta,
	});
});

export default handler.handler(routerOptions);
