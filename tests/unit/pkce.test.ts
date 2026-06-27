import { describe, expect, it } from 'vitest';

import { generateChallenge, generateNonce, generateState, generateVerifier } from '../../lib/pkce';

describe('pkce helpers', () => {
	it('generates url-safe opaque values', () => {
		const verifier = generateVerifier();
		const state = generateState();
		const nonce = generateNonce();

		expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(nonce).toMatch(/^[A-Za-z0-9_-]+$/);
	});

	it('derives the expected S256 challenge', () => {
		expect(generateChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
			'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
		);
	});
});
