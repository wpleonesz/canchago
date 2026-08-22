import { AppError } from './app-error';

export class TooManyRequestsError extends AppError {
	public constructor(message = 'Demasiados intentos. Intenta de nuevo más tarde.') {
		super(message, 429, 'TOO_MANY_REQUESTS');
	}
}
