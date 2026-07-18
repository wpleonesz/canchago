import { AppError } from './app-error';

export class NotFoundError extends AppError {
	public constructor(message = 'El recurso solicitado no existe.') {
		super(message, 404, 'NOT_FOUND');
	}
}
