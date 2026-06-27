import type { NextApiRequest, NextApiResponse } from 'next';

interface KnownError extends Error {
	statusCode: number;
	code?: string;
	details?: unknown;
}

const isKnownError = (err: unknown): err is KnownError =>
	err instanceof Error && typeof (err as KnownError).statusCode === 'number';

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
	onError: (err: unknown, _req: NextApiRequest, res: NextApiResponse): void => {
		if (isKnownError(err)) {
			const code = err.code ?? STATUS_CODE_MAP[err.statusCode] ?? 'INTERNAL_ERROR';

			res.status(err.statusCode).json({
				error: {
					code,
					message: err.message,
					...(err.details !== undefined && { details: err.details }),
				},
			});

			return;
		}

		res.status(500).json({
			error: {
				code: 'INTERNAL_ERROR',
				message: 'Error interno del servidor.',
			},
		});
	},

	onNoMatch: (_req: NextApiRequest, res: NextApiResponse): void => {
		res.status(405).json({
			error: {
				code: 'METHOD_NOT_ALLOWED',
				message: 'Método HTTP no permitido.',
			},
		});
	},
};
