import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

import { auth } from '@/middleware/auth';
import { access } from '@/middleware/access';
import { routerOptions } from '@/lib/api/router-config';
import { organizacionService } from '@/services/organizaciones-sedes';
import {
	organizationQuerySchema,
	createOrganizationSchema,
} from '@/validations/organizaciones-sedes';
import { throwValidationError } from '@/lib/errors/throw-validation-error';

const handler = createRouter<NextApiRequest, NextApiResponse>();

handler
	.use(auth)
	.get(access('organizaciones.read'), async (req, res): Promise<void> => {
		const parsed = organizationQuerySchema.safeParse(req.query);
		throwValidationError(parsed);

		const result = await organizacionService.getAll(parsed.data);

		res.status(200).json(result);
	})
	.post(access('organizaciones.manage'), async (req, res): Promise<void> => {
		const parsed = createOrganizationSchema.safeParse(req.body);
		throwValidationError(parsed);

		const organization = await organizacionService.create(parsed.data);

		res.status(201).json({ data: organization });
	});

export default handler.handler(routerOptions);
