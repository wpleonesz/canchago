import type { ZodError, ZodIssue } from 'zod';
import type { ErrorDetail } from '@/errors';

const getConstraintName = (issue: ZodIssue): string | undefined => {
	if (issue.code === 'too_small') return `min_${issue.minimum}`;
	if (issue.code === 'too_big') return `max_${issue.maximum}`;
	if (issue.code === 'invalid_type') return `type_${issue.expected}`;
	if (issue.code === 'invalid_value') return 'enum';
	return undefined;
};

export const formatZodError = (error: ZodError): ErrorDetail[] =>
	error.issues.map(issue => {
		const detail: ErrorDetail = {
			field: issue.path.join('.'),
			message: issue.message,
			type: issue.code,
			constraint: getConstraintName(issue),
		};

		// Only include received if it exists
		if ('received' in issue && issue.received !== undefined) {
			detail.received = issue.received;
		}

		return detail;
	});
