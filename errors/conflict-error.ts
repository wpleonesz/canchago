import { AppError } from './app-error';

export class ConflictError extends AppError {
	public constructor(message = 'Resource already exists') {
		super(message, 409, 'CONFLICT');
	}
}
