import { z } from 'zod';

import {
	AiInvalidResponseError,
	AiModelUnavailableError,
	AiProviderTimeoutError,
	AiProviderUnavailableError,
	TooManyRequestsError,
} from '@/errors';
import { env } from '@/lib/config/env';
import { logger } from '@/lib/logger';

export interface AiCompletionRequest {
	systemInstruction: string;
	context: unknown;
}

export interface AiProvider {
	complete(request: AiCompletionRequest): Promise<string>;
}

const completionSchema = z.object({
	choices: z.array(z.object({ message: z.object({ content: z.string().min(1) }) })).min(1),
});

interface LmStudioConfig {
	baseUrl?: string;
	model?: string;
	timeoutMs: number;
}

export class LmStudioProvider implements AiProvider {
	public constructor(
		private readonly config: LmStudioConfig = {
			baseUrl: env.AI_LM_STUDIO_BASE_URL,
			model: env.AI_LM_STUDIO_MODEL,
			timeoutMs: env.AI_PROVIDER_TIMEOUT_MS,
		},
	) {}

	public async complete(request: AiCompletionRequest): Promise<string> {
		if (!this.config.baseUrl || !this.config.model) throw new AiProviderUnavailableError();
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
		try {
			const response = await fetch(new URL('/v1/chat/completions', this.config.baseUrl), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					model: this.config.model,
					temperature: 0.2,
					// Los modelos con razonamiento (p. ej. gpt-oss) gastan tokens pensando antes de responder.
					max_tokens: 1500,
					// 'json_object' no lo soportan todos los servidores compatibles con OpenAI — LM
					// Studio (probado 2026-09-12, openai/gpt-oss-20b) responde 400 "'response_format.type'
					// must be 'json_schema' or 'text'". 'text' sí es universal; la instrucción de sistema ya
					// exige JSON explícitamente y la respuesta se valida igual con Zod antes de usarse.
					response_format: { type: 'text' },
					messages: [
						{ role: 'system', content: request.systemInstruction },
						{ role: 'user', content: JSON.stringify({ data: request.context }) },
					],
				}),
				signal: controller.signal,
			});
			if (response.status === 429)
				throw new TooManyRequestsError('El asistente está ocupado. Intenta de nuevo más tarde.');
			if (!response.ok) {
				const errorBody = (await response.text().catch(() => '')).slice(0, 200);
				// Un 400 por parámetros rechazados no es un modelo ausente: distinguirlo evita diagnósticos falsos.
				logger.warn(
					{ provider: 'lm-studio', status: response.status, providerError: errorBody },
					'AI provider rejected the request',
				);
				if (response.status === 404 || (response.status === 400 && /model/i.test(errorBody)))
					throw new AiModelUnavailableError();
				throw new AiProviderUnavailableError();
			}
			const rawResponse = await response.text();
			if (rawResponse.length > 50_000) throw new AiInvalidResponseError();
			let responseBody: unknown;
			try {
				responseBody = JSON.parse(rawResponse);
			} catch {
				throw new AiInvalidResponseError();
			}
			const parsed = completionSchema.safeParse(responseBody);
			if (!parsed.success) throw new AiInvalidResponseError();
			return parsed.data.choices[0].message.content;
		} catch (error) {
			if (
				error instanceof AiModelUnavailableError ||
				error instanceof TooManyRequestsError ||
				error instanceof AiInvalidResponseError ||
				error instanceof AiProviderUnavailableError
			)
				throw error;
			if (error instanceof Error && error.name === 'AbortError') throw new AiProviderTimeoutError();
			throw new AiProviderUnavailableError();
		} finally {
			clearTimeout(timeout);
		}
	}
}

export const aiProvider: AiProvider = new LmStudioProvider();
