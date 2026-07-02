import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';
import { z } from 'zod';

import { auth } from '@/middleware/auth';
import { access } from '@/middleware/access';
import { routerOptions } from '@/pages/api/_router';
import { userService } from '@/services/users';
import { userParamsSchema } from '@/validations/users';
import { ValidationError } from '@/errors/auth';
import { NotFoundError } from '@/errors/not-found-error';

const handler = createRouter<NextApiRequest, NextApiResponse>();

const userRolesQuerySchema = z.object({
	page: z.coerce.number().int().min(1).optional(),
	pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

const assignRolesSchema = z.object({
	roleIds: z.array(z.string().uuid('Invalid role ID')).min(1, 'At least one role is required'),
});

handler
	.use(auth)
	.get(access('users.read'), async (req, res): Promise<void> => {
		const parsedParams = userParamsSchema.safeParse({ userId: req.query.userId });
		const parsedQuery = userRolesQuerySchema.safeParse(req.query);

		if (!parsedParams.success || !parsedQuery.success) {
			throw new ValidationError('Invalid parameters');
		}

		const user = await userService.getById(parsedParams.data.userId);
		if (!user) {
			throw new NotFoundError('User not found');
		}

		const roles = user.roles || [];

		res.status(200).json({
			data: roles,
			meta: {
				total: roles.length,
			},
		});
	})
	.post(access('users.manage'), async (req, res): Promise<void> => {
		const parsedParams = userParamsSchema.safeParse({ userId: req.query.userId });
		const parsedBody = assignRolesSchema.safeParse(req.body);

		if (!parsedParams.success || !parsedBody.success) {
			throw new ValidationError('Invalid parameters or body');
		}

		const user = await userService.getById(parsedParams.data.userId);
		if (!user) {
			throw new NotFoundError('User not found');
		}

		for (const roleId of parsedBody.data.roleIds) {
			await userService.addRoleToUser(parsedParams.data.userId, roleId);
		}

		const updatedUser = await userService.getById(parsedParams.data.userId);

		res.status(201).json({
			data: updatedUser.roles,
		});
	});

export default handler.handler(routerOptions);
