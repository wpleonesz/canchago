import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

import { AuthenticationError } from '@/errors/auth';
import { routerOptions } from '@/lib/api/router-config';
import { throwValidationError } from '@/lib/errors/throw-validation-error';
import { auth } from '@/middleware/auth';
import { userService } from '@/services/users';
import { updateOwnAvatarSchema } from '@/validations/users';

const handler = createRouter<NextApiRequest, NextApiResponse>();

handler
	.use(auth)
	.get(async (req, res): Promise<void> => {
		if (!req.user) throw new AuthenticationError();

		const avatar = await userService.getOwnAvatar(req.user.id);
		const etag = `"${avatar.updatedAt?.getTime() ?? 0}"`;

		if (req.headers['if-none-match'] === etag) {
			res.status(304).end();
			return;
		}

		res.setHeader('Content-Type', avatar.mimeType);
		res.setHeader('Content-Length', avatar.data.byteLength);
		res.setHeader('Cache-Control', 'private, max-age=3600, must-revalidate');
		res.setHeader('ETag', etag);
		res.setHeader('X-Content-Type-Options', 'nosniff');
		res.status(200).send(Buffer.from(avatar.data));
	})
	.put(async (req, res): Promise<void> => {
		if (!req.user) throw new AuthenticationError();

		const parsed = updateOwnAvatarSchema.safeParse(req.body);
		throwValidationError(parsed);

		const result = await userService.updateOwnAvatar(req.user.id, parsed.data);
		res.status(200).json({ data: { avatarUpdatedAt: result.avatarUpdatedAt } });
	})
	.delete(async (req, res): Promise<void> => {
		if (!req.user) throw new AuthenticationError();

		await userService.removeOwnAvatar(req.user.id);
		res.status(204).end();
	});

export const config = {
	api: {
		bodyParser: {
			sizeLimit: '4mb',
		},
	},
};

export default handler.handler(routerOptions);
