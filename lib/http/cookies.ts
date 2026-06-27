type CookieOptions = {
	maxAgeSeconds?: number;
	expires?: Date;
	httpOnly?: boolean;
	secure?: boolean;
	sameSite?: 'Lax' | 'Strict' | 'None';
	path?: string;
	domain?: string;
};

const formatCookiePart = (key: string, value: string | boolean | number): string =>
	`${key}=${value}`;

export const buildCookieHeader = (
	name: string,
	value: string,
	options: CookieOptions = {},
): string => {
	const parts = [formatCookiePart(name, encodeURIComponent(value))];

	if (options.maxAgeSeconds !== undefined) {
		parts.push(formatCookiePart('Max-Age', options.maxAgeSeconds));
	}

	if (options.expires) {
		parts.push(formatCookiePart('Expires', options.expires.toUTCString()));
	}

	parts.push(formatCookiePart('Path', options.path ?? '/'));
	parts.push(formatCookiePart('HttpOnly', options.httpOnly ?? true));
	parts.push(formatCookiePart('Secure', options.secure ?? true));
	parts.push(formatCookiePart('SameSite', options.sameSite ?? 'Lax'));

	if (options.domain) {
		parts.push(formatCookiePart('Domain', options.domain));
	}

	return parts.join('; ');
};

export const buildExpiredCookieHeader = (
	name: string,
	options: Pick<CookieOptions, 'path' | 'domain'> = {},
): string =>
	buildCookieHeader(name, '', {
		...options,
		maxAgeSeconds: 0,
		expires: new Date(0),
	});

export const appendSetCookie = (
	current: string | string[] | undefined,
	cookie: string,
): string[] => {
	if (!current) {
		return [cookie];
	}

	if (Array.isArray(current)) {
		return [...current, cookie];
	}

	return [current, cookie];
};
