import { AppError } from './app-error';

export class BusinessRuleError extends AppError {
	public constructor(message: string) {
		super(message, 422, 'BUSINESS_RULE_ERROR');
	}
}
