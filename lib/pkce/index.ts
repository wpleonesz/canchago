import { createHash, randomBytes } from 'crypto';

const base64UrlEncode = (buffer: Buffer): string =>
	buffer.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');

export const generateVerifier = (): string => base64UrlEncode(randomBytes(64));

export const generateChallenge = (verifier: string): string =>
	base64UrlEncode(createHash('sha256').update(verifier).digest());

export const generateState = (): string => base64UrlEncode(randomBytes(32));

export const generateNonce = (): string => base64UrlEncode(randomBytes(32));
