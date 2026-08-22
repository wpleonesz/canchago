import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAssignableRoles = vi.fn();
const createWithRoles = vi.fn();
const recordGetUnique = vi.fn();

vi.mock('@/database/users', () => ({
	getAll: vi.fn(),
	getAssignableRoles: (...args: unknown[]) => getAssignableRoles(...args),
	createWithRoles: (...args: unknown[]) => createWithRoles(...args),
	record: () => ({ getUnique: (...args: unknown[]) => recordGetUnique(...args) }),
	updateWithRoles: vi.fn(),
	getRolesByUserId: vi.fn(),
	assignRolesToUser: vi.fn(),
	addRolesToUser: vi.fn(),
	addRoleToUser: vi.fn(),
	removeRoleFromUser: vi.fn(),
}));

vi.mock('./role-guard', () => ({
	assertCanAssignRoles: vi.fn(),
}));

import type { SessionUser } from '@/lib/session';

import { create } from './index';

const ORGANIZATION_ID = '123e4567-e89b-42d3-a456-426614174001';
const OTHER_ORGANIZATION_ID = '123e4567-e89b-42d3-a456-426614174002';
const ROLE_ID = '123e4567-e89b-42d3-a456-426614174003';

const ACTING_USER: SessionUser = {
	id: '123e4567-e89b-42d3-a456-426614174004',
	email: 'admin@example.com',
	name: 'Admin',
	roles: [],
	permissions: [{ id: 'permission-1', code: 'users.create' }],
};

const BODY = {
	email: 'new-user@example.com',
	firstName: 'New',
	lastName: 'User',
	organizationId: ORGANIZATION_ID,
	roleIds: [ROLE_ID],
};

const CREATED_USER = {
	id: '123e4567-e89b-42d3-a456-426614174005',
	email: BODY.email,
	status: 'ACTIVE',
	profile: { firstName: BODY.firstName, lastName: BODY.lastName },
	userRoles: [],
	createdAt: new Date('2026-08-21T00:00:00.000Z'),
	updatedAt: new Date('2026-08-21T00:00:00.000Z'),
};

describe('user service role assignment', () => {
	beforeEach(() => {
		getAssignableRoles.mockReset();
		createWithRoles.mockReset();
		recordGetUnique.mockReset();
	});

	it('creates the user and role assignments through the atomic data operation', async () => {
		getAssignableRoles.mockResolvedValue([
			{ id: ROLE_ID, organizationId: ORGANIZATION_ID, isSystem: false },
		]);
		createWithRoles.mockResolvedValue(CREATED_USER);

		await expect(create(BODY, ACTING_USER)).resolves.toMatchObject({
			email: BODY.email,
			roles: [],
		});
		expect(createWithRoles).toHaveBeenCalledOnce();
		expect(createWithRoles).toHaveBeenCalledWith(BODY);
	});

	it('rejects unknown roles with 422 before creating the user', async () => {
		getAssignableRoles.mockResolvedValue([]);

		await expect(create(BODY, ACTING_USER)).rejects.toMatchObject({
			statusCode: 422,
			code: 'BUSINESS_RULE_ERROR',
		});
		expect(createWithRoles).not.toHaveBeenCalled();
	});

	it('rejects a role from another organization with 422', async () => {
		getAssignableRoles.mockResolvedValue([
			{ id: ROLE_ID, organizationId: OTHER_ORGANIZATION_ID, isSystem: false },
		]);

		await expect(create(BODY, ACTING_USER)).rejects.toMatchObject({
			statusCode: 422,
			code: 'BUSINESS_RULE_ERROR',
		});
		expect(createWithRoles).not.toHaveBeenCalled();
	});
});
