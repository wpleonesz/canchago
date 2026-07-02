import { AppError } from './app-error';

export class AuthenticationError extends AppError {
	public constructor(message = 'Authentication required') {
		super(message, 401, 'UNAUTHORIZED');
	}
}

export class AuthorizationError extends AppError {
	public constructor(message = 'Insufficient permissions') {
		super(message, 403, 'FORBIDDEN');
	}
}
