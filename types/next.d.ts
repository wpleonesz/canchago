import type { SessionPayload, SessionUser } from '@/lib/session';

declare module 'next' {
	interface NextApiRequest {
		user?: SessionUser;
		session?: SessionPayload;
	}
}
