import { vi, describe, expect, it } from 'vitest';

vi.hoisted(() => {
	process.env.NODE_ENV = 'test';
	process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/canchago?schema=public';
});

import { assertKeepsAtLeastOneAdmin } from './role-guard';

const ADMIN_ROLE_ID = 'role-admin';

const buildTx = (options: {
	adminRoleExists?: boolean;
	targetIsAdmin?: boolean;
	remainingAdmins?: number;
}) => ({
	role: {
		findFirst: vi
			.fn()
			.mockResolvedValue(options.adminRoleExists === false ? null : { id: ADMIN_ROLE_ID }),
	},
	userRole: {
		count: vi
			.fn()
			.mockResolvedValueOnce(options.targetIsAdmin ? 1 : 0)
			.mockResolvedValueOnce(options.remainingAdmins ?? 0),
	},
});

describe('assertKeepsAtLeastOneAdmin', () => {
	it('does nothing when the admin role does not exist in this environment', async () => {
		const tx = buildTx({ adminRoleExists: false });

		await expect(assertKeepsAtLeastOneAdmin(tx as never, 'user-1')).resolves.toBeUndefined();
		expect(tx.userRole.count).not.toHaveBeenCalled();
	});

	it('does nothing when a role replacement keeps the admin role', async () => {
		const tx = buildTx({});

		await expect(
			assertKeepsAtLeastOneAdmin(tx as never, 'user-1', { newRoleIds: [ADMIN_ROLE_ID] }),
		).resolves.toBeUndefined();
		expect(tx.userRole.count).not.toHaveBeenCalled();
	});

	it('does nothing when removing a role other than the admin role', async () => {
		const tx = buildTx({});

		await expect(
			assertKeepsAtLeastOneAdmin(tx as never, 'user-1', { removingRoleId: 'role-other' }),
		).resolves.toBeUndefined();
		expect(tx.userRole.count).not.toHaveBeenCalled();
	});

	it('does nothing when the target user is not currently an administrator', async () => {
		const tx = buildTx({ targetIsAdmin: false });

		await expect(assertKeepsAtLeastOneAdmin(tx as never, 'user-1')).resolves.toBeUndefined();
	});

	it('rejects with 409 when the target is the only active administrator', async () => {
		const tx = buildTx({ targetIsAdmin: true, remainingAdmins: 0 });

		await expect(assertKeepsAtLeastOneAdmin(tx as never, 'user-1')).rejects.toMatchObject({
			statusCode: 409,
		});
	});

	it('allows the operation when other active administrators remain', async () => {
		const tx = buildTx({ targetIsAdmin: true, remainingAdmins: 1 });

		await expect(assertKeepsAtLeastOneAdmin(tx as never, 'user-1')).resolves.toBeUndefined();
	});

	it('rejects removing the admin role itself when it is the last one', async () => {
		const tx = buildTx({ targetIsAdmin: true, remainingAdmins: 0 });

		await expect(
			assertKeepsAtLeastOneAdmin(tx as never, 'user-1', { removingRoleId: ADMIN_ROLE_ID }),
		).rejects.toMatchObject({ statusCode: 409 });
	});
});
