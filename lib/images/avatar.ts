import sharp from 'sharp';

import { PayloadTooLargeError, UnsupportedMediaTypeError } from '@/errors';
import type { UpdateOwnAvatarBody } from '@/validations/users';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const MAX_INPUT_PIXELS = 16 * 1024 * 1024;
const OUTPUT_SIZE = 1024;

const MIME_BY_FORMAT = {
	jpeg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp',
} as const;

export const normalizeAvatar = async (
	body: UpdateOwnAvatarBody,
): Promise<{ data: Buffer; mimeType: 'image/webp' }> => {
	const input = Buffer.from(body.imageBase64, 'base64');

	if (input.byteLength > MAX_AVATAR_BYTES) {
		throw new PayloadTooLargeError('La fotografía no puede superar 2 MiB.');
	}

	try {
		const image = sharp(input, {
			failOn: 'warning',
			limitInputPixels: MAX_INPUT_PIXELS,
		});
		const metadata = await image.metadata();
		const detectedMime = metadata.format
			? MIME_BY_FORMAT[metadata.format as keyof typeof MIME_BY_FORMAT]
			: undefined;

		if (!detectedMime || detectedMime !== body.mimeType) {
			throw new UnsupportedMediaTypeError(
				'El contenido real de la fotografía no coincide con el formato declarado.',
			);
		}

		const data = await image
			.rotate()
			.resize({
				width: OUTPUT_SIZE,
				height: OUTPUT_SIZE,
				fit: 'inside',
				withoutEnlargement: true,
			})
			.webp({ quality: 82 })
			.toBuffer();

		return { data, mimeType: 'image/webp' };
	} catch (error) {
		if (error instanceof UnsupportedMediaTypeError || error instanceof PayloadTooLargeError) {
			throw error;
		}

		throw new UnsupportedMediaTypeError('La fotografía está dañada o no es una imagen válida.');
	}
};
