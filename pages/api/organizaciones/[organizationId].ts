import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

import { auth } from '@/middleware/auth';
import { access } from '@/middleware/access';
import { routerOptions } from '@/lib/api/router-config';
import { organizacionService } from '@/services/organizaciones-sedes';
import {
	organizationParamsSchema,
	updateOrganizationSchema,
} from '@/validations/organizaciones-sedes';
import { throwValidationError } from '@/lib/errors/throw-validation-error';

const handler = createRouter<NextApiRequest, NextApiResponse>();

handler
	.use(auth)
	.get(access('organizaciones.read'), async (req, res): Promise<void> => {
		const parsed = organizationParamsSchema.safeParse(req.query);
		throwValidationError(parsed);

		const organization = await organizacionService.getById(parsed.data.organizationId);

		res.status(200).json({ data: organization });
	})
	.patch(access('organizaciones.manage'), async (req, res): Promise<void> => {
		const parsedParams = organizationParamsSchema.safeParse(req.query);
		const parsedBody = updateOrganizationSchema.safeParse(req.body);

		throwValidationError(parsedParams);
		throwValidationError(parsedBody);

		const organization = await organizacionService.update(
			parsedParams.data.organizationId,
			parsedBody.data,
		);

		res.status(200).json({ data: organization });
	})
	.delete(access('organizaciones.manage'), async (req, res): Promise<void> => {
		const parsed = organizationParamsSchema.safeParse(req.query);
		throwValidationError(parsed);

		await organizacionService.remove(parsed.data.organizationId);

		res.status(204).end();
	});

export default handler.handler(routerOptions);
