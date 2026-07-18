import { AppError } from './app-error';

export class AuthenticationError extends AppError {
	public constructor(message = 'Debes iniciar sesión para continuar.') {
		super(message, 401, 'UNAUTHORIZED');
	}
}

export class AuthorizationError extends AppError {
	public constructor(message = 'No tienes permiso para realizar esta acción.') {
		super(message, 403, 'FORBIDDEN');
	}
}
