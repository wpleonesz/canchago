import type { NextApiRequest, NextApiResponse } from 'next';
import type { NextHandler } from 'next-connect';
import { RateLimiterMemory } from 'rate-limiter-flexible';

import { TooManyRequestsError } from '@/errors';

// Primer uso de rate-limiter-flexible en el proyecto (dependencia instalada pero sin conectar
// hasta esta feature). RateLimiterMemory vive en el proceso: si el backend se escala
// horizontalmente el límite real es N× el configurado — ver spec 016 "Riesgos". Migrar a
// RateLimiterRedis (ya hay ioredis en el proyecto, feature 010) si eso llega a importar.
const ipLimiter = new RateLimiterMemory({ points: 5, duration: 60 * 60 });
const emailLimiter = new RateLimiterMemory({ points: 3, duration: 60 * 60 * 24 });
const aiLimiter = new RateLimiterMemory({ points: 10, duration: 60 });

const getClientIp = (req: NextApiRequest): string => {
	const forwarded = req.headers['x-forwarded-for'];

	if (typeof forwarded === 'string' && forwarded.length > 0) {
		return forwarded.split(',')[0].trim();
	}

	return req.socket.remoteAddress ?? 'unknown';
};

/** Límite de tasa por IP y por email para POST /api/auth/register — único endpoint que lo usa hoy. */
export const registerRateLimit = async (
	req: NextApiRequest,
	_res: NextApiResponse,
	next: NextHandler,
): Promise<void> => {
	const ip = getClientIp(req);
	const email =
		typeof req.body === 'object' && req.body !== null && typeof req.body.email === 'string'
			? req.body.email.toLowerCase()
			: undefined;

	try {
		await ipLimiter.consume(ip);

		if (email) {
			await emailLimiter.consume(email);
		}
	} catch {
		throw new TooManyRequestsError();
	}

	await next();
};

export const aiRateLimit = async (
	req: NextApiRequest,
	_res: NextApiResponse,
	next: NextHandler,
): Promise<void> => {
	try {
		await aiLimiter.consume(`${req.user?.id ?? 'anonymous'}:${req.url ?? 'ai'}`);
	} catch {
		throw new TooManyRequestsError(
			'Has realizado demasiadas solicitudes al asistente. Intenta más tarde.',
		);
	}
	await next();
};
