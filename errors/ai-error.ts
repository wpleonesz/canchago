import { AppError } from './app-error';

export class AiProviderUnavailableError extends AppError {
	public constructor() {
		super('El asistente de IA no está disponible en este momento.', 503, 'AI_PROVIDER_UNAVAILABLE');
	}
}

export class AiModelUnavailableError extends AppError {
	public constructor() {
		super('El modelo de IA no está disponible en este momento.', 503, 'AI_MODEL_UNAVAILABLE');
	}
}

export class AiProviderTimeoutError extends AppError {
	public constructor() {
		super('El asistente de IA tardó demasiado en responder.', 504, 'AI_PROVIDER_TIMEOUT');
	}
}

export class AiInvalidResponseError extends AppError {
	public constructor() {
		super(
			'El asistente de IA devolvió una respuesta que no se puede utilizar.',
			502,
			'AI_INVALID_RESPONSE',
		);
	}
}
