import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

import { auth } from '@/middleware/auth';
import { access } from '@/middleware/access';
import { routerOptions } from '@/lib/api/router-config';
import { roleService } from '@/services/roles-permisos/role.service';
import { permissionService } from '@/services/roles-permisos/permission.service';
import {
	createRoleInputSchema,
	paginationSchema,
} from '@/validations/roles-permisos/role.validation';
import { throwValidationError } from '@/lib/errors/throw-validation-error';
import { ConflictError, ValidationError } from '@/errors';

const handler = createRouter<NextApiRequest, NextApiResponse>();

handler
	.use(auth)
	.get(access('roles.read'), async (req, res): Promise<void> => {
		const pagination = paginationSchema.safeParse(req.query);
		throwValidationError(pagination);

		const { organizationId } = req.query;

		if (!organizationId || typeof organizationId !== 'string') {
			throw new ValidationError('Falta el identificador de la organización.');
		}

		const result = await roleService.getRoles(
			organizationId,
			pagination.data.page,
			pagination.data.pageSize,
		);

		res.status(200).json({
			data: result.roles,
			meta: {
				page: result.page,
				pageSize: result.pageSize,
				total: result.total,
				totalPages: Math.ceil(result.total / result.pageSize),
			},
		});
	})
	.post(access('roles.manage'), async (req, res): Promise<void> => {
		const { organizationId } = req.query;

		if (!organizationId || typeof organizationId !== 'string') {
			throw new ValidationError('Falta el identificador de la organización.');
		}

		const parsed = createRoleInputSchema.safeParse({
			...req.body,
			organizationId,
		});
		throwValidationError(parsed);

		if (parsed.data.permissionIds && parsed.data.permissionIds.length > 0) {
			await permissionService.validatePermissionIds(parsed.data.permissionIds);
		}

		try {
			const role = await roleService.createRole(parsed.data);

			res.status(201).json({ data: role });
		} catch (error) {
			const err = error as Error;

			if (err.message.includes('already exists')) {
				throw new ConflictError(err.message);
			}

			throw err;
		}
	});

export default handler.handler(routerOptions);
