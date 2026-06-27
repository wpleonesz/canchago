import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

import { authMiddleware } from '@/middleware/auth';
import { requirePermissions } from '@/middleware/access';
import * as userService from '@/services/users';
import { userQuerySchema, createUserSchema } from '@/validations/users';
import { ConflictError } from '@/errors/conflict-error';

const router = createRouter<NextApiRequest, NextApiResponse>();

router
	.use(authMiddleware)
	.get(requirePermissions('users.read'), async (req, res) => {
		const parsedQuery = userQuerySchema.safeParse(req.query);

		if (!parsedQuery.success) {
			return res.status(400).json({
				error: {
					code: 'VALIDATION_ERROR',
					message: 'Invalid query parameters',
					details: parsedQuery.error.flatten(),
				},
			});
		}

		const result = await userService.getAll(parsedQuery.data);

		res.status(200).json(result);
	})
	.post(requirePermissions('users.create'), async (req, res) => {
		const parsedBody = createUserSchema.safeParse(req.body);

		if (!parsedBody.success) {
			return res.status(400).json({
				error: {
					code: 'VALIDATION_ERROR',
					message: 'Invalid request body',
					details: parsedBody.error.flatten(),
				},
			});
		}

		try {
			const user = await userService.create(parsedBody.data);

			res.status(201).json({
				data: user,
			});
		} catch (error) {
			if (error instanceof ConflictError) {
				return res.status(409).json({
					error: {
						code: 'CONFLICT',
						message: error.message,
					},
				});
			}

			throw error;
		}
	});

export default router.handler({
	onError: (error, _req, res) => {
		const message = error instanceof Error ? error.message : 'Internal server error';

		if (message.includes('Missing permissions')) {
			return res.status(403).json({
				error: {
					code: 'FORBIDDEN',
					message: 'Insufficient permissions',
				},
			});
		}

		if (message.includes('Missing session cookie') || message.includes('Unauthorized')) {
			return res.status(401).json({
				error: {
					code: 'UNAUTHORIZED',
					message,
				},
			});
		}

		res.status(500).json({
			error: {
				code: 'INTERNAL_SERVER_ERROR',
				message,
			},
		});
	},
	onNoMatch: (_req, res) => {
		res.status(405).end();
	},
});
