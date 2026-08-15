import { z } from 'zod';
import { VALIDATION_MESSAGES } from '../schemas';

export const mobileLoginSchema = z.object({
	username: z.string().min(1, VALIDATION_MESSAGES.REQUIRED),
	password: z.string().min(1, VALIDATION_MESSAGES.REQUIRED),
});

export type MobileLoginBody = z.infer<typeof mobileLoginSchema>;
