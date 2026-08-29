import { describe, expect, it } from 'vitest';

import { createRoleCode, normalizeRoleIdentity, normalizeRoleName } from './roles';

describe('normalización de roles', () => {
	it('recorta y colapsa espacios sin cambiar la etiqueta visible', () => {
		expect(normalizeRoleName('  Gestor   de   Sede  ')).toBe('Gestor de Sede');
	});

	it('crea una identidad insensible a mayúsculas y espacios', () => {
		expect(normalizeRoleIdentity('  RECEPCIÓN   Principal ')).toBe('recepción principal');
	});

	it('genera un código estable y legible solo durante la creación', () => {
		expect(createRoleCode('Recepción Principal')).toBe('recepcion-principal');
	});
});
