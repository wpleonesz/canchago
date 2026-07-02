import type { ZodSafeParseResult } from 'zod';
import { ValidationError } from '@/errors';
import { formatZodError } from './zod-formatter';

function throwValidationError<T>(
	parseResult: ZodSafeParseResult<T>,
	message?: string,
): asserts parseResult is { success: true; data: T };
function throwValidationError<T>(
	parseResult: ZodSafeParseResult<T>,
	message: string,
): asserts parseResult is { success: true; data: T };
function throwValidationError<T>(
	parseResult: ZodSafeParseResult<T>,
	message = 'Los datos enviados contienen errores de validación.',
): void {
	if (!parseResult.success) {
		throw new ValidationError(message, formatZodError(parseResult.error));
	}
}

export { throwValidationError };
