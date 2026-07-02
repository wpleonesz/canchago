import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';
import { z } from 'zod';

import { auth } from '@/middleware/auth';
import { access } from '@/middleware/access';
import { routerOptions } from '@/pages/api/_router';
import { userService } from '@/services/users';
import { ValidationError } from '@/errors/auth';
import { NotFoundError } from '@/errors/not-found-error';

const handler = createRouter<NextApiRequest, NextApiResponse>();

const paramsSchema = z.object({
	userId: z.string().uuid('Invalid user ID'),
	roleId: z.string().uuid('Invalid role ID'),
});

handler.use(auth).delete(access('users.manage'), async (req, res): Promise<void> => {
	const parsed = paramsSchema.safeParse({
		userId: req.query.userId,
		roleId: req.query.roleId,
	});

	if (!parsed.success) {
		throw new ValidationError('Invalid parameters');
	}

	const user = await userService.getById(parsed.data.userId);
	if (!user) {
		throw new NotFoundError('User not found');
	}

	await userService.removeRoleFromUser(parsed.data.userId, parsed.data.roleId);

	res.status(204).end();
});

export default handler.handler(routerOptions);
