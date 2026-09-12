import { z } from 'zod';

const uuid = z.string().uuid('El identificador no es válido.');
const instant = z.iso.datetime({ offset: true });

export const paginationSchema = z.object({
	page: z.coerce.number().int().min(1).optional(),
	pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const resourceQuerySchema = paginationSchema.extend({
	includeInactive: z.enum(['true', 'false']).optional(),
});

export const resourceParamsSchema = z.object({ resourceId: uuid });
export const slotParamsSchema = resourceParamsSchema.extend({ slotId: uuid });
export const bookingParamsSchema = z.object({ bookingId: uuid });
export const resourceCollectionParamsSchema = z.object({ organizationId: uuid, sedeId: uuid });

const resourceBaseShape = z.object({
	name: z.string().trim().min(1).max(150),
	description: z.string().trim().max(1000).optional(),
	address: z.string().trim().min(5).max(300),
	latitude: z.coerce.number().min(-90).max(90).optional(),
	longitude: z.coerce.number().min(-180).max(180).optional(),
	hourlyPrice: z.coerce.number().min(0).max(999999.99),
	status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

const validateCoordinates = (value: { latitude?: number; longitude?: number }) =>
	(value.latitude === undefined) === (value.longitude === undefined);

export const createResourceSchema = resourceBaseShape.refine(validateCoordinates, {
	message: 'Latitud y longitud deben enviarse juntas.',
	path: ['longitude'],
});

export const updateResourceSchema = resourceBaseShape
	.partial()
	.extend({ expectedUpdatedAt: instant })
	.refine(validateCoordinates, {
		message: 'Latitud y longitud deben enviarse juntas.',
		path: ['longitude'],
	});

export const createSlotSchema = z
	.object({ startsAt: instant, endsAt: instant, publish: z.boolean().optional() })
	.refine(value => new Date(value.startsAt) < new Date(value.endsAt), {
		message: 'La hora de inicio debe ser anterior a la hora de fin.',
		path: ['endsAt'],
	});

const slotIntervalSchema = z
	.object({ startsAt: instant, endsAt: instant })
	.refine(value => new Date(value.startsAt) < new Date(value.endsAt), {
		message: 'La hora de inicio debe ser anterior a la hora de fin.',
		path: ['endsAt'],
	});

export const createMonthlyScheduleSchema = z.object({
	slots: z.array(slotIntervalSchema).min(1).max(500),
	publish: z.boolean().optional(),
});

export const updateScheduleDaySchema = z.object({
	slots: z
		.array(z.object({ id: uuid, expectedUpdatedAt: instant }))
		.min(1)
		.max(100),
	status: z.enum(['PUBLISHED', 'WITHDRAWN']),
});

export const updateSlotSchema = z
	.object({
		startsAt: instant.optional(),
		endsAt: instant.optional(),
		status: z.enum(['DRAFT', 'PUBLISHED', 'WITHDRAWN']).optional(),
		expectedUpdatedAt: instant,
	})
	.refine(
		value =>
			value.startsAt !== undefined || value.endsAt !== undefined || value.status !== undefined,
		{
			message: 'Debes enviar al menos un cambio.',
		},
	)
	.refine(
		value => !value.startsAt || !value.endsAt || new Date(value.startsAt) < new Date(value.endsAt),
		{ message: 'La hora de inicio debe ser anterior a la hora de fin.', path: ['endsAt'] },
	);

export const availabilityQuerySchema = paginationSchema
	.extend({
		from: instant,
		to: instant,
		includeAll: z.enum(['true']).optional(),
	})
	.refine(value => new Date(value.from) < new Date(value.to), {
		message: 'El inicio del rango debe ser anterior al fin.',
		path: ['to'],
	});

export const createBookingSchema = z.object({
	availabilitySlotId: uuid,
	idempotencyKey: z.string().trim().min(8).max(100),
});

export const managedBookingsQuerySchema = paginationSchema.extend({
	status: z.enum(['CONFIRMED', 'CANCELLED']).optional(),
});

export type CreateResourceBody = z.infer<typeof createResourceSchema>;
export type UpdateResourceBody = z.infer<typeof updateResourceSchema>;
export type ManagedBookingsQuery = z.infer<typeof managedBookingsQuerySchema>;
export type CreateSlotBody = z.infer<typeof createSlotSchema>;
export type CreateMonthlyScheduleBody = z.infer<typeof createMonthlyScheduleSchema>;
export type UpdateScheduleDayBody = z.infer<typeof updateScheduleDaySchema>;
export type UpdateSlotBody = z.infer<typeof updateSlotSchema>;
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
export type CreateBookingBody = z.infer<typeof createBookingSchema>;
