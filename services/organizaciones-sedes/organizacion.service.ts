import { organizacionDb } from '@/database/organizaciones-sedes';
import type {
	CreateOrganizationBody,
	OrganizationQueryParams,
	UpdateOrganizationBody,
} from '@/validations/organizaciones-sedes';

export const getAll = async (filters: OrganizationQueryParams) => organizacionDb.getAll(filters);

export const getById = async (organizationId: string) =>
	organizacionDb.record(organizationId).getUnique();

export const create = async (data: CreateOrganizationBody) => organizacionDb.create(data);

export const update = async (organizationId: string, data: UpdateOrganizationBody) =>
	organizacionDb.record(organizationId).update(data);

export const remove = async (organizationId: string) =>
	organizacionDb.record(organizationId).remove();
