import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

import { auth } from '@/middleware/auth';
import { access } from '@/middleware/access';
import { routerOptions } from '@/lib/api/router-config';
import { sedeService } from '@/services/organizaciones-sedes';
import { sedeParamsSchema, updateSedeSchema } from '@/validations/organizaciones-sedes';
import { throwValidationError } from '@/lib/errors/throw-validation-error';

const handler = createRouter<NextApiRequest, NextApiResponse>();

handler
	.use(auth)
	.get(access('organizaciones.read'), async (req, res): Promise<void> => {
		const parsed = sedeParamsSchema.safeParse(req.query);
		throwValidationError(parsed);

		const sede = await sedeService.getById(parsed.data.sedeId);

		res.status(200).json({ data: sede });
	})
	.patch(access('organizaciones.manage'), async (req, res): Promise<void> => {
		const parsedParams = sedeParamsSchema.safeParse(req.query);
		const parsedBody = updateSedeSchema.safeParse(req.body);

		throwValidationError(parsedParams);
		throwValidationError(parsedBody);

		const sede = await sedeService.update(parsedParams.data.sedeId, parsedBody.data);

		res.status(200).json({ data: sede });
	})
	.delete(access('organizaciones.manage'), async (req, res): Promise<void> => {
		const parsed = sedeParamsSchema.safeParse(req.query);
		throwValidationError(parsed);

		await sedeService.remove(parsed.data.sedeId);

		res.status(204).end();
	});

export default handler.handler(routerOptions);
