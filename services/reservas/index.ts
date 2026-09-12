import * as repository from '@/database/reservas';
import { AuthorizationError, ConflictError, NotFoundError } from '@/errors';
import type { SessionUser } from '@/lib/session';
import { isAdministrator } from '@/services/users/role-guard';
import type {
	AvailabilityQuery,
	CreateBookingBody,
	CreateMonthlyScheduleBody,
	CreateResourceBody,
	CreateSlotBody,
	ManagedBookingsQuery,
	UpdateResourceBody,
	UpdateSlotBody,
	UpdateScheduleDayBody,
	UpdateWeekdayDiscountsBody,
} from '@/validations/reservas';

export const listResources = repository.listResources;
export const getResource = async (id: string) => {
	const resource = await repository.getResource(id);
	if (!resource) throw new NotFoundError('La cancha solicitada no está disponible.');
	return resource;
};
export const createResource = async (
	organizationId: string,
	venueId: string,
	body: CreateResourceBody,
	user: SessionUser,
) => {
	if (
		!isAdministrator(user) &&
		!(await repository.actorCanManageVenue(user.id, organizationId, venueId))
	)
		throw new AuthorizationError();
	if (!(await repository.getVenue(organizationId, venueId)))
		throw new NotFoundError('La sede solicitada no está disponible.');
	return repository.createResource(venueId, body);
};
export const updateResource = async (
	resourceId: string,
	body: UpdateResourceBody,
	user: SessionUser,
) => {
	if (!isAdministrator(user) && !(await repository.actorCanManageResource(user.id, resourceId)))
		throw new AuthorizationError();
	await getResource(resourceId);
	const result = await repository.updateResource(resourceId, body);
	if (result.count === 0)
		throw new ConflictError('La cancha cambió; actualiza antes de reintentar.');
	return getResource(resourceId);
};
export const updateWeekdayDiscounts = async (
	resourceId: string,
	body: UpdateWeekdayDiscountsBody,
	user: SessionUser,
) => {
	if (!isAdministrator(user) && !(await repository.actorCanManageResource(user.id, resourceId)))
		throw new AuthorizationError();
	await getResource(resourceId);
	return repository.replaceWeekdayDiscounts(resourceId, body);
};
export const listAvailability = async (
	resourceId: string,
	query: AvailabilityQuery,
	user: SessionUser,
) => {
	const resource = await getResource(resourceId);
	if (
		query.includeAll &&
		!isAdministrator(user) &&
		!(await repository.actorCanManageResource(user.id, resourceId))
	)
		throw new AuthorizationError();
	const result = await repository.listAvailability(resourceId, query);
	return {
		...result,
		data: result.data.map(slot => ({
			...slot,
			effectiveHourlyPrice: repository.applyWeekdayDiscount(
				resource.hourlyPrice,
				slot.startsAt.getUTCDay(),
				resource.weekdayDiscounts,
			),
			isBooked: slot.bookings.length > 0,
			bookings: undefined,
		})),
	};
};
export const createSlot = async (resourceId: string, body: CreateSlotBody, user: SessionUser) => {
	if (!isAdministrator(user) && !(await repository.actorCanManageResource(user.id, resourceId)))
		throw new AuthorizationError();
	if (new Date(body.startsAt) <= new Date())
		throw new ConflictError('La franja debe comenzar en el futuro.');
	const slot = await repository.createSlot(resourceId, user.id, body);
	if (!slot) throw new ConflictError('La franja se solapa con otra disponibilidad de la cancha.');
	return slot;
};
export const createMonthlySchedule = async (
	resourceId: string,
	body: CreateMonthlyScheduleBody,
	user: SessionUser,
) => {
	if (!isAdministrator(user) && !(await repository.actorCanManageResource(user.id, resourceId)))
		throw new AuthorizationError();
	if (body.slots.some(slot => new Date(slot.startsAt) <= new Date()))
		throw new ConflictError('Todos los horarios deben comenzar en el futuro.');
	try {
		const result = await repository.createMonthlySchedule(resourceId, user.id, body);
		if (!result) throw new ConflictError('Uno o más horarios se solapan con la agenda existente.');
		return result;
	} catch (error) {
		if (error instanceof ConflictError) throw error;
		throw new ConflictError('No se pudo guardar el mes porque uno o más horarios ya existen.');
	}
};
export const updateScheduleDay = async (
	resourceId: string,
	body: UpdateScheduleDayBody,
	user: SessionUser,
) => {
	if (!isAdministrator(user) && !(await repository.actorCanManageResource(user.id, resourceId)))
		throw new AuthorizationError();
	try {
		const result = await repository.updateScheduleDay(resourceId, body);
		if (result.kind === 'not-found') throw new NotFoundError('Uno o más horarios no existen.');
		if (result.kind === 'stale')
			throw new ConflictError('La jornada cambió; actualiza antes de reintentar.');
		if (result.kind === 'past')
			throw new ConflictError('Los horarios pasados ya no pueden cambiarse.');
		if (result.kind === 'booked')
			throw new ConflictError('No puedes cerrar una jornada con reservas confirmadas.');
		return result.count;
	} catch (error) {
		if (error instanceof NotFoundError || error instanceof ConflictError) throw error;
		throw new ConflictError('No se pudo cambiar la jornada porque uno o más horarios se solapan.');
	}
};
export const updateSlot = async (
	resourceId: string,
	slotId: string,
	body: UpdateSlotBody,
	user: SessionUser,
) => {
	if (!isAdministrator(user) && !(await repository.actorCanManageResource(user.id, resourceId)))
		throw new AuthorizationError();
	const result = await repository.updateSlot(resourceId, slotId, body);
	if (result.kind === 'not-found') throw new NotFoundError('La franja solicitada no existe.');
	if (result.kind === 'stale')
		throw new ConflictError('La franja cambió; actualiza antes de reintentar.');
	if (result.kind === 'booked')
		throw new ConflictError('Una franja reservada no puede moverse ni retirarse.');
	if (result.kind === 'overlap')
		throw new ConflictError('La franja se solapa con otra disponibilidad de la cancha.');
	if (result.kind === 'past') throw new ConflictError('La franja debe comenzar en el futuro.');
	if (result.kind === 'invalid') throw new ConflictError('El intervalo de la franja no es válido.');
	return result.slot;
};
export const createBooking = async (body: CreateBookingBody, user: SessionUser) => {
	try {
		const result = await repository.createBooking(
			user.id,
			body.availabilitySlotId,
			body.idempotencyKey,
		);
		if (!result) throw new ConflictError('La franja ya no está disponible.');
		if (result.idempotencyConflict)
			throw new ConflictError('La clave de idempotencia ya fue usada para otra reserva.');
		return result;
	} catch (error) {
		if (error instanceof ConflictError) throw error;
		throw new ConflictError('La franja ya no está disponible.');
	}
};
export const listOwnBookings = repository.listOwnBookings;
export const cancelOwnBooking = async (bookingId: string, user: SessionUser) => {
	if (!(await repository.getOwnBooking(user.id, bookingId)))
		throw new NotFoundError('La reserva solicitada no existe.');
	const result = await repository.cancelOwnBooking(user.id, bookingId);
	if (result.count === 0) throw new ConflictError('La reserva ya no puede cancelarse.');
};
export const listManagedBookings = async (
	resourceId: string,
	query: ManagedBookingsQuery,
	user: SessionUser,
) => {
	if (!isAdministrator(user) && !(await repository.actorCanManageResource(user.id, resourceId)))
		throw new AuthorizationError();
	await getResource(resourceId);
	return repository.listManagedBookings(resourceId, query);
};
