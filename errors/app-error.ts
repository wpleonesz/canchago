export interface ErrorDetail {
	field?: string;
	message: string;
	type?: string;
	constraint?: string;
	received?: unknown;
}

export class AppError extends Error {
	public readonly statusCode: number;
	public readonly code: string;
	public readonly details?: ErrorDetail[];

	public constructor(message: string, statusCode: number, code: string, details?: ErrorDetail[]) {
		super(message);
		this.name = new.target.name;
		this.statusCode = statusCode;
		this.code = code;
		this.details = details;
	}
}
