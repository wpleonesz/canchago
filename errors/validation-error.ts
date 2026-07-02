import { AppError, type ErrorDetail } from './app-error';

export class ValidationError extends AppError {
	public constructor(message: string, details?: ErrorDetail[]) {
		super(message, 400, 'VALIDATION_ERROR', details);
	}
}
