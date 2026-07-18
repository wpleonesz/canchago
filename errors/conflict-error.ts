import { AppError } from './app-error';

export class ConflictError extends AppError {
	public constructor(message = 'El recurso ya existe.') {
		super(message, 409, 'CONFLICT');
	}
}
