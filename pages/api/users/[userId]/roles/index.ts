import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

import { auth } from '@/middleware/auth';
import { access } from '@/middleware/access';
import { routerOptions } from '@/lib/api/router-config';
import { userService } from '@/services/users';
import { assignUserRolesSchema, userParamsSchema, userRolesQuerySchema } from '@/validations/users';
import { throwValidationError } from '@/lib/errors/throw-validation-error';
import { AuthenticationError } from '@/errors/auth';

const handler = createRouter<NextApiRequest, NextApiResponse>();

handler
	.use(auth)
	.get(access('users.read'), async (req, res): Promise<void> => {
		const parsedParams = userParamsSchema.safeParse({ userId: req.query.userId });
		const parsedQuery = userRolesQuerySchema.safeParse(req.query);

		throwValidationError(parsedParams);
		throwValidationError(parsedQuery);

		await userService.getById(parsedParams.data.userId);
		const result = await userService.getRolesByUserId(
			parsedParams.data.userId,
			parsedQuery.data.page,
			parsedQuery.data.pageSize,
		);

		res.status(200).json({
			data: result.roles,
			meta: result.meta,
		});
	})
	.post(access('users.manage'), async (req, res): Promise<void> => {
		const parsedParams = userParamsSchema.safeParse({ userId: req.query.userId });
		const parsedBody = assignUserRolesSchema.safeParse(req.body);

		throwValidationError(parsedParams);
		throwValidationError(parsedBody);

		if (!req.user) {
			throw new AuthenticationError();
		}

		await userService.getById(parsedParams.data.userId);
		await userService.addRolesToUser(parsedParams.data.userId, parsedBody.data.roleIds, req.user);

		const updatedUser = await userService.getById(parsedParams.data.userId);

		res.status(201).json({
			data: updatedUser.roles,
		});
	});

export default handler.handler(routerOptions);
