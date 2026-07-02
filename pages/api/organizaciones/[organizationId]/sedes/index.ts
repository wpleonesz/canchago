import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

import { auth } from '@/middleware/auth';
import { access } from '@/middleware/access';
import { routerOptions } from '@/pages/api/_router';
import { sedeService } from '@/services/organizaciones-sedes';
import {
	sedeCollectionParamsSchema,
	sedeQuerySchema,
	createSedeSchema,
} from '@/validations/organizaciones-sedes';
import { ValidationError } from '@/errors/auth';

const handler = createRouter<NextApiRequest, NextApiResponse>();

handler
	.use(auth)
	.get(access('organizaciones.read'), async (req, res): Promise<void> => {
		const parsedParams = sedeCollectionParamsSchema.safeParse(req.query);
		const parsedQuery = sedeQuerySchema.safeParse(req.query);

		if (!parsedParams.success || !parsedQuery.success) {
			throw new ValidationError('Parámetros inválidos.');
		}

		const result = await sedeService.getAll(parsedParams.data.organizationId, parsedQuery.data);

		res.status(200).json(result);
	})
	.post(access('organizaciones.manage'), async (req, res): Promise<void> => {
		const parsedParams = sedeCollectionParamsSchema.safeParse(req.query);
		const parsedBody = createSedeSchema.safeParse(req.body);

		if (!parsedParams.success || !parsedBody.success) {
			throw new ValidationError('Los datos enviados no son válidos.');
		}

		const sede = await sedeService.create(parsedParams.data.organizationId, parsedBody.data);

		res.status(201).json({ data: sede });
	});

export default handler.handler(routerOptions);
