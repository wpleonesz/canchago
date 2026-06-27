import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

import { authMiddleware } from '@/middleware/auth';
import { requirePermissions } from '@/middleware/access';
import * as userService from '@/services/users';
import { userParamsSchema, updateUserSchema } from '@/validations/users';
import { NotFoundError } from '@/errors/not-found-error';
import { ConflictError } from '@/errors/conflict-error';

const router = createRouter<NextApiRequest, NextApiResponse>();

router
	.use(authMiddleware)
	.get(requirePermissions('users.read'), async (req, res) => {
		const parsedParams = userParamsSchema.safeParse(req.query);

		if (!parsedParams.success) {
			return res.status(400).json({
				error: {
					code: 'VALIDATION_ERROR',
					message: 'Invalid parameters',
					details: parsedParams.error.flatten(),
				},
			});
		}

		try {
			const user = await userService.getById(parsedParams.data.userId);

			res.status(200).json({
				data: user,
			});
		} catch (error) {
			if (error instanceof NotFoundError) {
				return res.status(404).json({
					error: {
						code: 'NOT_FOUND',
						message: error.message,
					},
				});
			}

			throw error;
		}
	})
	.patch(requirePermissions('users.update'), async (req, res) => {
		const parsedParams = userParamsSchema.safeParse(req.query);
		const parsedBody = updateUserSchema.safeParse(req.body);

		if (!parsedParams.success) {
			return res.status(400).json({
				error: {
					code: 'VALIDATION_ERROR',
					message: 'Invalid parameters',
					details: parsedParams.error.flatten(),
				},
			});
		}

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
			const user = await userService.update(parsedParams.data.userId, parsedBody.data);

			res.status(200).json({
				data: user,
			});
		} catch (error) {
			if (error instanceof NotFoundError) {
				return res.status(404).json({
					error: {
						code: 'NOT_FOUND',
						message: error.message,
					},
				});
			}

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
	})
	.delete(requirePermissions('users.delete'), async (req, res) => {
		const parsedParams = userParamsSchema.safeParse(req.query);

		if (!parsedParams.success) {
			return res.status(400).json({
				error: {
					code: 'VALIDATION_ERROR',
					message: 'Invalid parameters',
					details: parsedParams.error.flatten(),
				},
			});
		}

		try {
			await userService.remove(parsedParams.data.userId);

			res.status(204).end();
		} catch (error) {
			if (error instanceof NotFoundError) {
				return res.status(404).json({
					error: {
						code: 'NOT_FOUND',
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
