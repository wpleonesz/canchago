import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

import { auth } from '@/middleware/auth';
import { access } from '@/middleware/access';
import { routerOptions } from '@/pages/api/_router';
import { roleService } from '@/services/roles-permisos/role.service';
import { permissionService } from '@/services/roles-permisos/permission.service';
import {
	createRoleInputSchema,
	paginationSchema,
} from '@/validations/roles-permisos/role.validation';
import { ValidationError } from '@/errors/auth';
import { ConflictError } from '@/errors/conflict-error';

const handler = createRouter<NextApiRequest, NextApiResponse>();

handler
	.use(auth)
	.get(access('roles.read'), async (req, res): Promise<void> => {
		const pagination = paginationSchema.safeParse(req.query);

		if (!pagination.success) {
			throw new ValidationError('Parámetros de paginación inválidos.');
		}

		const { organizationId } = req.query;

		if (!organizationId || typeof organizationId !== 'string') {
			throw new ValidationError('organizationId requerido en query parameters.');
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
			throw new ValidationError('organizationId requerido en query parameters.');
		}

		const parsed = createRoleInputSchema.safeParse({
			...req.body,
			organizationId,
		});

		if (!parsed.success) {
			throw new ValidationError('Los datos enviados no son válidos.');
		}

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
