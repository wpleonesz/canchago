export class ConflictError extends Error {
	readonly statusCode = 409;

	constructor(message = 'Resource already exists') {
		super(message);
		this.name = 'ConflictError';
	}
}
