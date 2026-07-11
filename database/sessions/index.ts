import { prisma } from '@/database/client';

type CreateSessionInput = {
	userId: string;
	sealedTokens: string;
	expiresAt: Date;
};

export const create = async (data: CreateSessionInput) =>
	prisma.userSession.create({
		data: {
			userId: data.userId,
			sealedTokens: data.sealedTokens,
			expiresAt: data.expiresAt,
		},
	});

/** Devuelve la sesión sólo si sigue viva: ni revocada ni expirada. */
export const findActive = async (sessionId: string) =>
	prisma.userSession.findFirst({
		where: {
			id: sessionId,
			revokedAt: null,
			expiresAt: { gt: new Date() },
		},
	});

export const updateTokens = async (sessionId: string, sealedTokens: string) =>
	prisma.userSession.update({
		where: { id: sessionId },
		data: { sealedTokens },
	});

export const revoke = async (sessionId: string) =>
	prisma.userSession.updateMany({
		where: { id: sessionId, revokedAt: null },
		data: { revokedAt: new Date() },
	});
