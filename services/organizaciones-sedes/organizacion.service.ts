import { organizacionDb } from '@/database/organizaciones-sedes';
import type {
	CreateOrganizationBody,
	OrganizationQueryParams,
	UpdateOrganizationBody,
} from '@/validations/organizaciones-sedes';
import type { SessionUser } from '@/lib/session';
import { isAdministrator } from '@/services/users/role-guard';

export const getAll = async (filters: OrganizationQueryParams, actingUser: SessionUser) =>
	organizacionDb.getAll(filters, {
		userId: actingUser.id,
		isAdministrator: isAdministrator(actingUser),
	});

export const getById = async (organizationId: string) =>
	organizacionDb.record(organizationId).getUnique();

export const create = async (data: CreateOrganizationBody) => organizacionDb.create(data);

export const update = async (organizationId: string, data: UpdateOrganizationBody) =>
	organizacionDb.record(organizationId).update(data);

export const remove = async (organizationId: string) =>
	organizacionDb.record(organizationId).remove();
