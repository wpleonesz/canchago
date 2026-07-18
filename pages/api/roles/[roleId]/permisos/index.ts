import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

import { auth } from '@/middleware/auth';
import { access } from '@/middleware/access';
import { routerOptions } from '@/lib/api/router-config';
import { roleService } from '@/services/roles-permisos/role.service';
import { rolePermissionDb } from '@/database/roles-permisos/role-permission.db';
import { permissionService } from '@/services/roles-permisos/permission.service';
import { paginationSchema } from '@/validations/roles-permisos/role.validation';
import { updateRolePermissionsSchema } from '@/validations/roles-permisos/permission.validation';
import { throwValidationError } from '@/lib/errors/throw-validation-error';
import { NotFoundError, ValidationError } from '@/errors';

const handler = createRouter<NextApiRequest, NextApiResponse>();

handler
	.use(auth)
	.get(access('roles.read'), async (req, res): Promise<void> => {
		const { roleId, organizationId } = req.query;
		const pagination = paginationSchema.safeParse(req.query);
		throwValidationError(pagination);

		if (!organizationId || typeof organizationId !== 'string' || typeof roleId !== 'string') {
			throw new ValidationError(
				'Faltan datos requeridos: identificador del rol y de la organización.',
			);
		}

		try {
			const role = await roleService.getRoleById(roleId, organizationId);

			const permissions = role.permissions.map(rp => rp.permission);
			const skip = (pagination.data.page - 1) * pagination.data.pageSize;
			const paginatedPermissions = permissions.slice(skip, skip + pagination.data.pageSize);

			res.status(200).json({
				data: paginatedPermissions,
				meta: {
					page: pagination.data.page,
					pageSize: pagination.data.pageSize,
					total: permissions.length,
					totalPages: Math.ceil(permissions.length / pagination.data.pageSize),
				},
			});
		} catch (error) {
			const err = error as Error;

			if (err.message === 'Role not found') {
				throw new NotFoundError('El rol solicitado no existe.');
			}

			throw err;
		}
	})
	.patch(access('roles.manage'), async (req, res): Promise<void> => {
		const { roleId, organizationId } = req.query;

		if (!organizationId || typeof organizationId !== 'string' || typeof roleId !== 'string') {
			throw new ValidationError(
				'Faltan datos requeridos: identificador del rol y de la organización.',
			);
		}

		const parsed = updateRolePermissionsSchema.safeParse(req.body);
		throwValidationError(parsed);

		try {
			const role = await roleService.getRoleById(roleId, organizationId);

			if (!role) {
				throw new NotFoundError('El rol solicitado no existe.');
			}

			if (parsed.data.permissionIds.length > 0) {
				await permissionService.validatePermissionIds(parsed.data.permissionIds);
			}

			await rolePermissionDb.assignPermissionsToRole(roleId, parsed.data.permissionIds);

			const updated = await roleService.getRoleById(roleId, organizationId);

			res.status(200).json({ data: updated });
		} catch (error) {
			const err = error as Error;

			if (err.message === 'Role not found') {
				throw new NotFoundError('El rol solicitado no existe.');
			}

			throw err;
		}
	});

export default handler.handler(routerOptions);
