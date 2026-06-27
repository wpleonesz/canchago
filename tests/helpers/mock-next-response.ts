import type { NextApiResponse } from 'next';

type RecordedResponse = NextApiResponse & {
	statusCode?: number;
	body?: unknown;
	headers: Record<string, string | string[] | number | undefined>;
	redirectDestination?: string;
};

export const createMockResponse = (): RecordedResponse => {
	const response = {
		headers: {},
		statusCode: 200,
		setHeader(name: string, value: string | string[] | number | undefined) {
			this.headers[name] = value;
			return this;
		},
		getHeader(name: string) {
			return this.headers[name];
		},
		status(code: number) {
			this.statusCode = code;
			return this;
		},
		json(payload: unknown) {
			this.body = payload;
			return this;
		},
		end(payload?: unknown) {
			this.body = payload;
			return this;
		},
		redirect(statusOrUrl: number | string, url?: string) {
			if (typeof statusOrUrl === 'number') {
				this.statusCode = statusOrUrl;
				this.redirectDestination = url;
			} else {
				this.redirectDestination = statusOrUrl;
			}

			return this;
		},
	} as RecordedResponse;

	return response;
};
