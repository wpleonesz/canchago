import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';
import { z } from 'zod';

import { auth } from '@/middleware/auth';
import { access } from '@/middleware/access';
import { routerOptions } from '@/lib/api/router-config';
import { userService } from '@/services/users';
import { throwValidationError } from '@/lib/errors/throw-validation-error';
import { VALIDATION_MESSAGES } from '@/validations/schemas';
import { NotFoundError } from '@/errors/not-found-error';

const handler = createRouter<NextApiRequest, NextApiResponse>();

const paramsSchema = z.object({
	userId: z.string().uuid(VALIDATION_MESSAGES.UUID),
	roleId: z.string().uuid(VALIDATION_MESSAGES.UUID),
});

handler.use(auth).delete(access('users.manage'), async (req, res): Promise<void> => {
	const parsed = paramsSchema.safeParse({
		userId: req.query.userId,
		roleId: req.query.roleId,
	});

	throwValidationError(parsed);

	const user = await userService.getById(parsed.data.userId);
	if (!user) {
		throw new NotFoundError('El usuario solicitado no existe.');
	}

	await userService.removeRoleFromUser(parsed.data.userId, parsed.data.roleId);

	res.status(204).end();
});

export default handler.handler(routerOptions);
