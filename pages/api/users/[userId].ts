import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

import { auth } from '@/middleware/auth';
import { access } from '@/middleware/access';
import { routerOptions } from '@/pages/api/_router';
import { userService } from '@/services/users';
import { userParamsSchema, updateUserSchema } from '@/validations/users';
import { ValidationError } from '@/errors/auth';

const handler = createRouter<NextApiRequest, NextApiResponse>();

handler
	.use(auth)
	.get(access('users.read'), async (req, res): Promise<void> => {
		const parsed = userParamsSchema.safeParse(req.query);

		if (!parsed.success) {
			throw new ValidationError('Parámetros de ruta inválidos.');
		}

		const user = await userService.getById(parsed.data.userId);

		res.status(200).json({ data: user });
	})
	.patch(access('users.update'), async (req, res): Promise<void> => {
		const parsedParams = userParamsSchema.safeParse(req.query);
		const parsedBody = updateUserSchema.safeParse(req.body);

		if (!parsedParams.success || !parsedBody.success) {
			throw new ValidationError('Los datos enviados no son válidos.');
		}

		const user = await userService.update(parsedParams.data.userId, parsedBody.data);

		res.status(200).json({ data: user });
	})
	.delete(access('users.delete'), async (req, res): Promise<void> => {
		const parsed = userParamsSchema.safeParse(req.query);

		if (!parsed.success) {
			throw new ValidationError('Parámetros de ruta inválidos.');
		}

		await userService.remove(parsed.data.userId);

		res.status(204).end();
	});

export default handler.handler(routerOptions);
