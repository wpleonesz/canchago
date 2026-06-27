export class AuthenticationError extends Error {
	public readonly statusCode = 401;

	constructor(message = 'Authentication required') {
		super(message);
		this.name = 'AuthenticationError';
	}
}

export class AuthorizationError extends Error {
	public readonly statusCode = 403;

	constructor(message = 'Insufficient permissions') {
		super(message);
		this.name = 'AuthorizationError';
	}
}

export class ValidationError extends Error {
	public readonly statusCode = 400;

	constructor(message: string) {
		super(message);
		this.name = 'ValidationError';
	}
}
