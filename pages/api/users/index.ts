import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

import { auth } from '@/middleware/auth';
import { access } from '@/middleware/access';
import { routerOptions } from '@/pages/api/_router';
import { userService } from '@/services/users';
import { userQuerySchema, createUserSchema } from '@/validations/users';
import { ValidationError } from '@/errors/auth';

const handler = createRouter<NextApiRequest, NextApiResponse>();

handler
	.use(auth)
	.get(access('users.read'), async (req, res): Promise<void> => {
		const parsed = userQuerySchema.safeParse(req.query);

		if (!parsed.success) {
			throw new ValidationError('Parámetros de consulta inválidos.');
		}

		const result = await userService.getAll(parsed.data);

		res.status(200).json(result);
	})
	.post(access('users.create'), async (req, res): Promise<void> => {
		const parsed = createUserSchema.safeParse(req.body);

		if (!parsed.success) {
			throw new ValidationError('Los datos enviados no son válidos.');
		}

		const user = await userService.create(parsed.data);

		res.status(201).json({ data: user });
	});

export default handler.handler(routerOptions);
