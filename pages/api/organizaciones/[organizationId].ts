import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

import { auth } from '@/middleware/auth';
import { access } from '@/middleware/access';
import { routerOptions } from '@/pages/api/_router';
import { organizacionService } from '@/services/organizaciones-sedes';
import {
	organizationParamsSchema,
	updateOrganizationSchema,
} from '@/validations/organizaciones-sedes';
import { ValidationError } from '@/errors/auth';

const handler = createRouter<NextApiRequest, NextApiResponse>();

handler
	.use(auth)
	.get(access('organizaciones.read'), async (req, res): Promise<void> => {
		const parsed = organizationParamsSchema.safeParse(req.query);

		if (!parsed.success) {
			throw new ValidationError('Parámetros de ruta inválidos.');
		}

		const organization = await organizacionService.getById(parsed.data.organizationId);

		res.status(200).json({ data: organization });
	})
	.patch(access('organizaciones.manage'), async (req, res): Promise<void> => {
		const parsedParams = organizationParamsSchema.safeParse(req.query);
		const parsedBody = updateOrganizationSchema.safeParse(req.body);

		if (!parsedParams.success || !parsedBody.success) {
			throw new ValidationError('Los datos enviados no son válidos.');
		}

		const organization = await organizacionService.update(
			parsedParams.data.organizationId,
			parsedBody.data,
		);

		res.status(200).json({ data: organization });
	})
	.delete(access('organizaciones.manage'), async (req, res): Promise<void> => {
		const parsed = organizationParamsSchema.safeParse(req.query);

		if (!parsed.success) {
			throw new ValidationError('Parámetros de ruta inválidos.');
		}

		await organizacionService.remove(parsed.data.organizationId);

		res.status(204).end();
	});

export default handler.handler(routerOptions);
