import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';
import { z } from 'zod';

import { auth } from '@/middleware/auth';
import { access } from '@/middleware/access';
import { routerOptions } from '@/lib/api/router-config';
import { userService } from '@/services/users';
import { userParamsSchema } from '@/validations/users';
import { throwValidationError } from '@/lib/errors/throw-validation-error';
import { NotFoundError } from '@/errors/not-found-error';
import { VALIDATION_MESSAGES } from '@/validations/schemas';

const handler = createRouter<NextApiRequest, NextApiResponse>();

const userRolesQuerySchema = z.object({
	page: z.coerce.number().int().min(1, VALIDATION_MESSAGES.MIN_VALUE(1)).optional(),
	pageSize: z.coerce
		.number()
		.int()
		.min(1, VALIDATION_MESSAGES.MIN_VALUE(1))
		.max(100, VALIDATION_MESSAGES.MAX_VALUE(100))
		.optional(),
});

const assignRolesSchema = z.object({
	roleIds: z.array(z.string().uuid(VALIDATION_MESSAGES.UUID)).min(1, VALIDATION_MESSAGES.REQUIRED),
});

handler
	.use(auth)
	.get(access('users.read'), async (req, res): Promise<void> => {
		const parsedParams = userParamsSchema.safeParse({ userId: req.query.userId });
		const parsedQuery = userRolesQuerySchema.safeParse(req.query);

		throwValidationError(parsedParams);
		throwValidationError(parsedQuery);

		const user = await userService.getById(parsedParams.data.userId);
		if (!user) {
			throw new NotFoundError('El usuario solicitado no existe.');
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

		throwValidationError(parsedParams);
		throwValidationError(parsedBody);

		const user = await userService.getById(parsedParams.data.userId);
		if (!user) {
			throw new NotFoundError('El usuario solicitado no existe.');
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
