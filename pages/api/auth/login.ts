import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

import { ValidationError } from '@/errors/auth';
import { routerOptions } from '@/pages/api/_router';
import { env } from '@/lib/config/env';
import { buildCookieHeader, appendSetCookie } from '@/lib/http/cookies';
import { buildAuthorizationUrl } from '@/lib/oauth';
import { createTemporaryOAuthCookie } from '@/lib/session';
import { generateChallenge, generateNonce, generateState, generateVerifier } from '@/lib/pkce';

const router = createRouter<NextApiRequest, NextApiResponse>();

router.get(async (_req, res) => {
	const state = generateState();
	const codeVerifier = generateVerifier();
	const codeChallenge = generateChallenge(codeVerifier);
	const nonce = generateNonce();
	const temporaryCookie = await createTemporaryOAuthCookie(state, codeVerifier, nonce);

	res.setHeader(
		'Set-Cookie',
		appendSetCookie(
			res.getHeader('Set-Cookie') as string | string[] | undefined,
			buildCookieHeader(env.SESSION_TEMP_COOKIE_NAME, temporaryCookie, {
				maxAgeSeconds: env.SESSION_TEMP_COOKIE_MAX_AGE_SECONDS,
				path: env.SESSION_COOKIE_PATH,
				domain: env.SESSION_COOKIE_DOMAIN,
				httpOnly: true,
				secure: true,
				sameSite: 'Lax',
			}),
		),
	);

	res.redirect(302, buildAuthorizationUrl(state, codeChallenge, nonce));
});

export default router.handler(routerOptions);
