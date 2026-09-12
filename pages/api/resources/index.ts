import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';
import { auth } from '@/middleware/auth';
import { access } from '@/middleware/access';
import { routerOptions } from '@/lib/api/router-config';
import * as service from '@/services/reservas';
import { resourceQuerySchema } from '@/validations/reservas';
import { throwValidationError } from '@/lib/errors/throw-validation-error';

const handler = createRouter<NextApiRequest, NextApiResponse>();
handler.use(auth).get(access('resources.read'), async (req, res): Promise<void> => {
	const parsed = resourceQuerySchema.safeParse(req.query);
	throwValidationError(parsed);
	res
		.status(200)
		.json(
			await service.listResources(
				parsed.data.page,
				parsed.data.pageSize,
				parsed.data.includeInactive === 'true',
			),
		);
});
export default handler.handler(routerOptions);
