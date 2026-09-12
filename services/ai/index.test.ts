import { Prisma } from '@/generated/prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as repository from '@/database/ai';
import { AiInvalidResponseError } from '@/errors';
import type { AiProvider } from '@/lib/ai';
import { recommendSlots, summarizeUpcomingBookings } from './index';

vi.mock('@/database/ai', () => ({
	listAvailableCandidates: vi.fn(),
	listUpcomingOwnBookings: vi.fn(),
}));
vi.mock('@/lib/ai', () => ({ aiProvider: { complete: vi.fn() } }));

const slotId = '8c91a397-454d-4813-90ab-62f8b7854a82';
const resourceId = 'f92d75ca-e301-403e-9b34-b97d35db24f6';
const candidate = {
	id: slotId,
	startsAt: new Date('2030-01-02T18:00:00.000Z'),
	endsAt: new Date('2030-01-02T19:00:00.000Z'),
	resource: {
		id: resourceId,
		name: 'Cancha norte',
		description: null,
		address: 'Av. Principal',
		hourlyPrice: new Prisma.Decimal(25),
		currency: 'USD',
		venue: { name: 'Sede Norte', organization: { name: 'Organización Uno' } },
	},
};

const input = { from: '2030-01-02T00:00:00.000Z', to: '2030-01-03T00:00:00.000Z' };

describe('AI services', () => {
	beforeEach(() => vi.clearAllMocks());

	it('does not call the provider when no candidates exist', async () => {
		vi.mocked(repository.listAvailableCandidates).mockResolvedValue([]);
		const provider: AiProvider = { complete: vi.fn() };
		expect(await recommendSlots(input, provider)).toEqual({
			generated: false,
			explanation: '',
			recommendations: [],
		});
		expect(provider.complete).not.toHaveBeenCalled();
	});

	it('sends only the minimized candidate context and maps verified IDs', async () => {
		vi.mocked(repository.listAvailableCandidates).mockResolvedValue([candidate]);
		const provider: AiProvider = {
			complete: vi.fn().mockResolvedValue(
				JSON.stringify({
					explanation: ' Una opción disponible. ',
					recommendations: [{ availabilitySlotId: slotId, reason: ' Buen horario. ' }],
				}),
			),
		};
		const result = await recommendSlots(input, provider);
		expect(result.recommendations[0]).toMatchObject({
			availabilitySlotId: slotId,
			resourceId,
			reason: 'Buen horario.',
		});
		const request = vi.mocked(provider.complete).mock.calls[0][0];
		expect(JSON.stringify(request.context)).not.toMatch(
			/email|latitude|longitude|permissions|token/i,
		);
	});

	it('rejects references outside the authorized candidate set', async () => {
		vi.mocked(repository.listAvailableCandidates).mockResolvedValue([candidate]);
		const provider: AiProvider = {
			complete: vi.fn().mockResolvedValue(
				JSON.stringify({
					explanation: 'Opción',
					recommendations: [{ availabilitySlotId: crypto.randomUUID(), reason: 'Inventada' }],
				}),
			),
		};
		await expect(recommendSlots(input, provider)).rejects.toBeInstanceOf(AiInvalidResponseError);
	});

	it('queries and summarizes bookings using the authenticated user id', async () => {
		vi.mocked(repository.listUpcomingOwnBookings).mockResolvedValue([
			{
				id: 'booking-1',
				resource: { name: 'Cancha norte', venue: { name: 'Sede Norte' } },
				availabilitySlot: { startsAt: candidate.startsAt, endsAt: candidate.endsAt },
			},
		]);
		const provider: AiProvider = {
			complete: vi.fn().mockResolvedValue('{"summary":"Tienes una reserva."}'),
		};
		const result = await summarizeUpcomingBookings('current-user', { horizonDays: 7 }, provider);
		expect(repository.listUpcomingOwnBookings).toHaveBeenCalledWith('current-user', 7);
		expect(result).toEqual({ generated: true, summary: 'Tienes una reserva.', bookingsCount: 1 });
	});
});
