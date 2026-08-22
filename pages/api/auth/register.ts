import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

import { routerOptions } from '@/lib/api/router-config';
import { registerRateLimit } from '@/middleware/rate-limit';
import { register } from '@/services/auth/register.service';
import { throwValidationError } from '@/lib/errors/throw-validation-error';
import { registerSchema } from '@/validations/auth/register.validation';

const handler = createRouter<NextApiRequest, NextApiResponse>();

// Sin auth/access: es el único endpoint público que crea usuarios (feature 016). El límite de
// tasa corre primero para no gastar una llamada a Keycloak en un intento ya bloqueado.
handler.use(registerRateLimit).post(async (req, res): Promise<void> => {
	const parsed = registerSchema.safeParse(req.body);
	throwValidationError(parsed);

	const result = await register(parsed.data);

	res.status(201).json({ data: result });
});

export default handler.handler(routerOptions);
