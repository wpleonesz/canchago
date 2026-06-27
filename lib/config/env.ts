import { z } from 'zod';

const envSchema = z.object({
	NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
	DATABASE_URL: z.string().url(),
	APP_BASE_URL: z.string().url(),
	OAUTH_PROVIDER_NAME: z.string().min(1),
	OAUTH_AUTHORIZATION_URL: z.string().url(),
	OAUTH_TOKEN_URL: z.string().url(),
	OAUTH_REVOCATION_URL: z.string().url().optional(),
	OAUTH_JWKS_URL: z.string().url().optional(),
	OAUTH_ISSUER: z.string().url(),
	OAUTH_CLIENT_ID: z.string().min(1),
	OAUTH_CLIENT_SECRET: z.string().min(1),
	OAUTH_REDIRECT_URI: z.string().url(),
	OAUTH_LOGOUT_URL: z.string().url().optional(),
	OAUTH_SCOPE: z.string().min(1).default('openid email profile offline_access'),
	OAUTH_PUBLIC_KEY_PEM: z.string().min(1).optional(),
	OAUTH_SUCCESS_REDIRECT_URL: z.string().url().default('/'),
	OAUTH_ERROR_REDIRECT_URL: z.string().url().optional(),
	SESSION_SECRET: z.string().min(32),
	SESSION_PREVIOUS_SECRET: z.string().min(32).optional(),
	SESSION_COOKIE_NAME: z.string().min(1).default('canchago_session'),
	SESSION_TEMP_COOKIE_NAME: z.string().min(1).default('canchago_oauth_state'),
	SESSION_COOKIE_DOMAIN: z.string().min(1).optional(),
	SESSION_COOKIE_PATH: z.string().default('/'),
	SESSION_COOKIE_MAX_AGE_SECONDS: z.coerce
		.number()
		.int()
		.positive()
		.default(60 * 60 * 8),
	SESSION_TEMP_COOKIE_MAX_AGE_SECONDS: z.coerce
		.number()
		.int()
		.positive()
		.default(60 * 10),
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;

export const getEnv = (): AppEnv => {
	if (!cachedEnv) {
		cachedEnv = envSchema.parse(process.env);
	}

	return cachedEnv;
};

export const env = getEnv();
