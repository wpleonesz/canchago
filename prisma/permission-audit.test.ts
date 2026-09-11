import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { diffPermissionCatalog, extractRequiredPermissionCodes } from './permission-audit';

const PAGES_API_DIR = join(process.cwd(), 'pages', 'api');

describe('extractRequiredPermissionCodes (feature 021)', () => {
	it('extrae exactamente los códigos access(...) reales de pages/api/** sin llamadas no reconocidas', () => {
		const { requiredCodes, unrecognizedCalls } = extractRequiredPermissionCodes(PAGES_API_DIR);

		expect(unrecognizedCalls).toEqual([]);
		expect([...requiredCodes].sort()).toEqual(
			[
				'availability.manage',
				'availability.read',
				'bookings.cancel.own',
				'bookings.create',
				'bookings.read.own',
				'menus.read',
				'organizaciones.manage',
				'organizaciones.read',
				'permisos.read',
				'resources.manage',
				'resources.read',
				'roles.manage',
				'roles.read',
				'users.create',
				'users.delete',
				'users.manage',
				'users.read',
				'users.update',
			].sort(),
		);
	});
});

describe('diffPermissionCatalog', () => {
	it('detecta un código faltante inyectado en la prueba (caracterización de la auditoría)', () => {
		const { missingCodes } = diffPermissionCatalog(
			new Set(['users.read', 'synthetic.missing']),
			new Set(['users.read']),
		);

		expect(missingCodes).toEqual(['synthetic.missing']);
	});

	it('detecta sedes.read/sedes.manage como huérfanos frente al conjunto real exigido por el código', () => {
		const { requiredCodes } = extractRequiredPermissionCodes(PAGES_API_DIR);
		const seededCatalogCodes = new Set([...requiredCodes, 'sedes.read', 'sedes.manage']);

		const { orphanCodes, missingCodes } = diffPermissionCatalog(requiredCodes, seededCatalogCodes);

		expect(orphanCodes.sort()).toEqual(['sedes.manage', 'sedes.read']);
		expect(missingCodes).toEqual([]);
	});

	it('no reporta nada cuando el catálogo coincide exactamente con lo exigido', () => {
		const { missingCodes, orphanCodes } = diffPermissionCatalog(new Set(['a.b']), new Set(['a.b']));

		expect(missingCodes).toEqual([]);
		expect(orphanCodes).toEqual([]);
	});

	it('nunca borra: solo reporta huérfanos, la decisión de eliminarlos queda fuera de esta función', () => {
		const { orphanCodes } = diffPermissionCatalog(new Set([]), new Set(['legacy.orphan']));

		expect(orphanCodes).toEqual(['legacy.orphan']);
	});
});
