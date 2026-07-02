import { sedeDb } from '@/database/organizaciones-sedes';
import type {
	CreateSedeBody,
	SedeQueryParams,
	UpdateSedeBody,
} from '@/validations/organizaciones-sedes';

export const getAll = async (organizationId: string, filters: SedeQueryParams) =>
	sedeDb.getAll(organizationId, filters);

export const getById = async (sedeId: string) => sedeDb.record(sedeId).getUnique();

export const create = async (organizationId: string, data: CreateSedeBody) =>
	sedeDb.create(organizationId, data);

export const update = async (sedeId: string, data: UpdateSedeBody) =>
	sedeDb.record(sedeId).update(data);

export const remove = async (sedeId: string) => sedeDb.record(sedeId).remove();
