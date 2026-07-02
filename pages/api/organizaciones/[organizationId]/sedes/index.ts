import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

import { auth } from '@/middleware/auth';
import { access } from '@/middleware/access';
import { routerOptions } from '@/lib/api/router-config';
import { sedeService } from '@/services/organizaciones-sedes';
import {
	sedeCollectionParamsSchema,
	sedeQuerySchema,
	createSedeSchema,
} from '@/validations/organizaciones-sedes';
import { throwValidationError } from '@/lib/errors/throw-validation-error';

const handler = createRouter<NextApiRequest, NextApiResponse>();

handler
	.use(auth)
	.get(access('organizaciones.read'), async (req, res): Promise<void> => {
		const parsedParams = sedeCollectionParamsSchema.safeParse(req.query);
		const parsedQuery = sedeQuerySchema.safeParse(req.query);

		throwValidationError(parsedParams);
		throwValidationError(parsedQuery);

		const result = await sedeService.getAll(parsedParams.data.organizationId, parsedQuery.data);

		res.status(200).json(result);
	})
	.post(access('organizaciones.manage'), async (req, res): Promise<void> => {
		const parsedParams = sedeCollectionParamsSchema.safeParse(req.query);
		const parsedBody = createSedeSchema.safeParse(req.body);

		throwValidationError(parsedParams);
		throwValidationError(parsedBody);

		const sede = await sedeService.create(parsedParams.data.organizationId, parsedBody.data);

		res.status(201).json({ data: sede });
	});

export default handler.handler(routerOptions);
