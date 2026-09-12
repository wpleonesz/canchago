import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	AiInvalidResponseError,
	AiModelUnavailableError,
	AiProviderTimeoutError,
	AiProviderUnavailableError,
} from '@/errors';
import { LmStudioProvider } from './index';

vi.mock('@/lib/config/env', () => ({
	env: { AI_PROVIDER_TIMEOUT_MS: 1000 },
}));

const request = { systemInstruction: 'Sistema', context: { allowed: true } };
const provider = (timeoutMs = 1000) =>
	new LmStudioProvider({ baseUrl: 'http://127.0.0.1:1234', model: 'modelo-local', timeoutMs });

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe('LmStudioProvider', () => {
	it('sends an OpenAI-compatible request and returns message content', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ choices: [{ message: { content: '{"summary":"ok"}' } }] }), {
				status: 200,
			}),
		);
		vi.stubGlobal('fetch', fetchMock);

		await expect(provider().complete(request)).resolves.toBe('{"summary":"ok"}');
		const [, init] = fetchMock.mock.calls[0];
		expect(JSON.parse(String(init.body))).toMatchObject({ model: 'modelo-local' });
	});

	it('maps a missing model and connection failure', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 404 })));
		await expect(provider().complete(request)).rejects.toBeInstanceOf(AiModelUnavailableError);

		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('connection refused')));
		await expect(provider().complete(request)).rejects.toBeInstanceOf(AiProviderUnavailableError);
	});

	it('rejects malformed provider responses', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{not-json', { status: 200 })));
		await expect(provider().complete(request)).rejects.toBeInstanceOf(AiInvalidResponseError);
	});

	it('aborts requests at the configured timeout', async () => {
		vi.useFakeTimers();
		vi.stubGlobal(
			'fetch',
			vi.fn(
				(_url: URL, init: RequestInit) =>
					new Promise((_resolve, reject) => {
						init.signal?.addEventListener('abort', () =>
							reject(new DOMException('aborted', 'AbortError')),
						);
					}),
			),
		);
		const completion = provider(1000).complete(request);
		const expectation = expect(completion).rejects.toBeInstanceOf(AiProviderTimeoutError);
		await vi.advanceTimersByTimeAsync(1000);
		await expectation;
	});
});
