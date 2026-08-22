import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

import { auth } from '@/middleware/auth';
import { access } from '@/middleware/access';
import { routerOptions } from '@/lib/api/router-config';
import { userService } from '@/services/users';
import { throwValidationError } from '@/lib/errors/throw-validation-error';
import { userRoleParamsSchema } from '@/validations/users';

const handler = createRouter<NextApiRequest, NextApiResponse>();

handler.use(auth).delete(access('users.manage'), async (req, res): Promise<void> => {
	const parsed = userRoleParamsSchema.safeParse({
		userId: req.query.userId,
		roleId: req.query.roleId,
	});

	throwValidationError(parsed);

	await userService.getById(parsed.data.userId);

	await userService.removeRoleFromUser(parsed.data.userId, parsed.data.roleId);

	res.status(204).end();
});

export default handler.handler(routerOptions);
