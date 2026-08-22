import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { PayloadTooLargeError, UnsupportedMediaTypeError } from '@/errors';

import { normalizeAvatar } from './avatar';

describe('normalizeAvatar', () => {
	it('decodifica y normaliza una imagen real a WebP sin ampliarla', async () => {
		const png = await sharp({
			create: { width: 8, height: 6, channels: 3, background: '#1475e1' },
		})
			.png()
			.toBuffer();

		const result = await normalizeAvatar({
			imageBase64: png.toString('base64'),
			mimeType: 'image/png',
		});
		const metadata = await sharp(result.data).metadata();

		expect(result.mimeType).toBe('image/webp');
		expect(metadata).toMatchObject({ format: 'webp', width: 8, height: 6 });
	});

	it('rechaza contenido corrupto y discordancia entre MIME declarado y real', async () => {
		await expect(
			normalizeAvatar({
				imageBase64: Buffer.from('no-es-imagen').toString('base64'),
				mimeType: 'image/png',
			}),
		).rejects.toBeInstanceOf(UnsupportedMediaTypeError);

		const jpeg = await sharp({
			create: { width: 2, height: 2, channels: 3, background: '#fff' },
		})
			.jpeg()
			.toBuffer();
		await expect(
			normalizeAvatar({ imageBase64: jpeg.toString('base64'), mimeType: 'image/png' }),
		).rejects.toBeInstanceOf(UnsupportedMediaTypeError);
	});

	it('neutraliza contenido añadido a una imagen al volver a codificarla', async () => {
		const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#000' } })
			.png()
			.toBuffer();
		const marker = '<script>malicioso()</script>';
		const polyglot = Buffer.concat([png, Buffer.from(marker)]);
		const result = await normalizeAvatar({
			imageBase64: polyglot.toString('base64'),
			mimeType: 'image/png',
		});
		expect(result.data.includes(Buffer.from(marker))).toBe(false);
		expect((await sharp(result.data).metadata()).format).toBe('webp');
	});

	it('rechaza datos decodificados mayores a 2 MiB antes de procesarlos', async () => {
		const oversized = Buffer.alloc(2 * 1024 * 1024 + 1, 1);
		await expect(
			normalizeAvatar({ imageBase64: oversized.toString('base64'), mimeType: 'image/png' }),
		).rejects.toBeInstanceOf(PayloadTooLargeError);
	});
});
