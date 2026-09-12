/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { z } from 'zod';
import { registry } from '@/documentation/registry';

const WeekdayDiscount = z.object({
	weekday: z.number().int().min(0).max(6),
	discountPercent: z.string(),
});
const Resource = z.object({
	id: z.string().uuid(),
	name: z.string(),
	description: z.string().nullable(),
	status: z.enum(['ACTIVE', 'INACTIVE']),
	weekdayDiscounts: z.array(WeekdayDiscount),
	venue: z.object({
		id: z.string().uuid(),
		name: z.string(),
		organization: z.object({ id: z.string().uuid(), name: z.string() }),
	}),
});
const Slot = z.object({
	id: z.string().uuid(),
	resourceId: z.string().uuid(),
	startsAt: z.date(),
	endsAt: z.date(),
	status: z.enum(['DRAFT', 'PUBLISHED', 'WITHDRAWN']),
	effectiveHourlyPrice: z.string(),
});
const UpdateWeekdayDiscountsBody = z.object({ discounts: z.array(WeekdayDiscount) });
const Booking = z.object({
	id: z.string().uuid(),
	userId: z.string().uuid(),
	resourceId: z.string().uuid(),
	availabilitySlotId: z.string().uuid(),
	status: z.enum(['CONFIRMED', 'CANCELLED']),
});
const ErrorResponse = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
registry.register('ReservableResource', Resource);
registry.register('AvailabilitySlot', Slot);
registry.register('Booking', Booking);
registry.register('WeekdayDiscount', WeekdayDiscount);
registry.register('UpdateWeekdayDiscountsBody', UpdateWeekdayDiscountsBody);
const errors = {
	400: {
		description: 'Solicitud inválida',
		content: { 'application/json': { schema: ErrorResponse } },
	},
	401: {
		description: 'No autenticado',
		content: { 'application/json': { schema: ErrorResponse } },
	},
	403: { description: 'No autorizado', content: { 'application/json': { schema: ErrorResponse } } },
	409: {
		description: 'Conflicto de disponibilidad',
		content: { 'application/json': { schema: ErrorResponse } },
	},
};
registry.registerPath({
	method: 'get',
	path: '/resources',
	tags: ['Agendamiento'],
	security: [{ cookieAuth: [] }],
	responses: { 200: { description: 'Canchas habilitadas' }, ...errors },
});
registry.registerPath({
	method: 'get',
	path: '/resources/{resourceId}',
	tags: ['Agendamiento'],
	security: [{ cookieAuth: [] }],
	request: { params: z.object({ resourceId: z.string().uuid() }) },
	responses: { 200: { description: 'Detalle de cancha' }, ...errors },
});
registry.registerPath({
	method: 'get',
	path: '/resources/{resourceId}/availability',
	tags: ['Agendamiento'],
	security: [{ cookieAuth: [] }],
	responses: { 200: { description: 'Franjas libres' }, ...errors },
});
registry.registerPath({
	method: 'post',
	path: '/resources/{resourceId}/availability',
	tags: ['Agendamiento'],
	security: [{ cookieAuth: [] }],
	responses: { 201: { description: 'Franja creada' }, ...errors },
});
registry.registerPath({
	method: 'patch',
	path: '/resources/{resourceId}/availability/batch',
	tags: ['Agendamiento'],
	security: [{ cookieAuth: [] }],
	responses: { 200: { description: 'Jornada abierta o cerrada atómicamente' }, ...errors },
});
registry.registerPath({
	method: 'patch',
	path: '/resources/{resourceId}/availability/{slotId}',
	tags: ['Agendamiento'],
	security: [{ cookieAuth: [] }],
	responses: { 200: { description: 'Franja actualizada, publicada o retirada' }, ...errors },
});
registry.registerPath({
	method: 'post',
	path: '/resources/{resourceId}/availability/batch',
	tags: ['Agendamiento'],
	security: [{ cookieAuth: [] }],
	responses: { 201: { description: 'Programación mensual creada atómicamente' }, ...errors },
});
registry.registerPath({
	method: 'post',
	path: '/organizaciones/{organizationId}/sedes/{sedeId}/resources',
	tags: ['Agendamiento'],
	security: [{ cookieAuth: [] }],
	responses: { 201: { description: 'Cancha creada' }, ...errors },
});
registry.registerPath({
	method: 'put',
	path: '/resources/{resourceId}/weekday-discounts',
	tags: ['Agendamiento'],
	security: [{ cookieAuth: [] }],
	description:
		'Reemplaza el conjunto completo de descuentos por día de la semana de una cancha (feature 025). Requiere permiso `resources.manage` y el mismo alcance que `PATCH /resources/{resourceId}`. Enviar `discounts: []` quita todos los descuentos existentes.',
	request: {
		params: z.object({ resourceId: z.string().uuid() }),
		body: { content: { 'application/json': { schema: UpdateWeekdayDiscountsBody } } },
	},
	responses: { 200: { description: 'Descuentos actualizados' }, ...errors },
});
registry.registerPath({
	method: 'get',
	path: '/bookings',
	tags: ['Agendamiento'],
	security: [{ cookieAuth: [] }],
	responses: { 200: { description: 'Reservas propias' }, ...errors },
});
registry.registerPath({
	method: 'post',
	path: '/bookings',
	tags: ['Agendamiento'],
	security: [{ cookieAuth: [] }],
	responses: { 201: { description: 'Reserva confirmada' }, ...errors },
});
registry.registerPath({
	method: 'delete',
	path: '/bookings/{bookingId}',
	tags: ['Agendamiento'],
	security: [{ cookieAuth: [] }],
	responses: { 204: { description: 'Reserva cancelada' }, ...errors },
});
