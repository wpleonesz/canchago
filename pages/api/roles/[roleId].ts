import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

import { auth } from '@/middleware/auth';
import { access } from '@/middleware/access';
import { routerOptions } from '@/lib/api/router-config';
import { roleService } from '@/services/roles-permisos/role.service';
import { permissionService } from '@/services/roles-permisos/permission.service';
import { updateRoleInputSchema } from '@/validations/roles-permisos/role.validation';
import { throwValidationError } from '@/lib/errors/throw-validation-error';
import { NotFoundError, ConflictError, ValidationError } from '@/errors';

const handler = createRouter<NextApiRequest, NextApiResponse>();

handler
	.use(auth)
	.get(access('roles.read'), async (req, res): Promise<void> => {
		const { roleId, organizationId } = req.query;

		if (!organizationId || typeof organizationId !== 'string' || typeof roleId !== 'string') {
			throw new ValidationError(
				'Faltan datos requeridos: identificador del rol y de la organización.',
			);
		}

		try {
			const role = await roleService.getRoleById(roleId, organizationId);
			res.status(200).json({ data: role });
		} catch (error) {
			if ((error as Error).message === 'Role not found') {
				throw new NotFoundError('El rol solicitado no existe.');
			}
			throw error;
		}
	})
	.patch(access('roles.manage'), async (req, res): Promise<void> => {
		const { roleId, organizationId } = req.query;

		if (!organizationId || typeof organizationId !== 'string' || typeof roleId !== 'string') {
			throw new ValidationError(
				'Faltan datos requeridos: identificador del rol y de la organización.',
			);
		}

		const parsed = updateRoleInputSchema.safeParse(req.body);
		throwValidationError(parsed);

		if (parsed.data.permissionIds && parsed.data.permissionIds.length > 0) {
			await permissionService.validatePermissionIds(parsed.data.permissionIds);
		}

		try {
			const role = await roleService.updateRole(roleId, organizationId, parsed.data);
			res.status(200).json({ data: role });
		} catch (error) {
			const err = error as Error;

			if (err.message === 'Role not found') {
				throw new NotFoundError('El rol solicitado no existe.');
			}

			if (err.message.includes('already exists')) {
				throw new ConflictError(err.message);
			}

			throw err;
		}
	})
	.delete(access('roles.manage'), async (req, res): Promise<void> => {
		const { roleId, organizationId } = req.query;

		if (!organizationId || typeof organizationId !== 'string' || typeof roleId !== 'string') {
			throw new ValidationError(
				'Faltan datos requeridos: identificador del rol y de la organización.',
			);
		}

		try {
			await roleService.deleteRole(roleId, organizationId);
			res.status(204).end();
		} catch (error) {
			const err = error as Error;

			if (err.message === 'Role not found') {
				throw new NotFoundError('El rol solicitado no existe.');
			}

			throw err;
		}
	});

export default handler.handler(routerOptions);
