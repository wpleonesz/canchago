import type { NextApiRequest, NextApiResponse } from 'next';
import { ZodError } from 'zod';

import { AppError } from '@/errors';
import { logger } from '@/lib/logger';
import { formatZodError } from '@/lib/errors/zod-formatter';

const handleError = (err: unknown, _req: NextApiRequest, res: NextApiResponse): void => {
	const requestId = _req.headers['x-request-id'] as string | undefined;

	if (err instanceof AppError) {
		logger.warn({ requestId, error: err.name, statusCode: err.statusCode }, err.message);

		res.status(err.statusCode).json({
			error: {
				code: err.code,
				message: err.message,
				...(err.details && { details: err.details }),
			},
		});
		return;
	}

	if (err instanceof ZodError) {
		const details = formatZodError(err);
		logger.warn({ requestId, fieldCount: details.length }, 'Validation failed');

		res.status(400).json({
			error: {
				code: 'VALIDATION_ERROR',
				message: 'Los datos enviados contienen errores de validación.',
				details,
			},
		});
		return;
	}

	const errorObject = err instanceof Error ? err : new Error(String(err));
	logger.error({ requestId, stack: errorObject.stack }, 'Unhandled error');

	res.status(500).json({
		error: {
			code: 'INTERNAL_ERROR',
			message: 'Error interno del servidor.',
		},
	});
};

const STATUS_CODE_MAP: Record<number, string> = {
	400: 'VALIDATION_ERROR',
	401: 'UNAUTHORIZED',
	403: 'FORBIDDEN',
	404: 'NOT_FOUND',
	409: 'CONFLICT',
	422: 'BUSINESS_RULE_ERROR',
	429: 'TOO_MANY_REQUESTS',
};

export const routerOptions = {
	onError: handleError,

	onNoMatch: (_req: NextApiRequest, res: NextApiResponse): void => {
		res.status(405).json({
			error: {
				code: 'METHOD_NOT_ALLOWED',
				message: 'Método HTTP no permitido.',
			},
		});
	},
};
