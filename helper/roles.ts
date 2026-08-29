const ROLE_NAME_SPACES = /\s+/gu;
const ROLE_CODE_MARKS = /\p{M}+/gu;
const ROLE_CODE_SEPARATORS = /[\s_]+/gu;
const ROLE_CODE_INVALID = /[^\p{L}\p{N}-]+/gu;
const ROLE_CODE_DUPLICATE_HYPHENS = /-+/gu;

export const normalizeRoleName = (name: string): string =>
	name.trim().replace(ROLE_NAME_SPACES, ' ');

export const normalizeRoleIdentity = (name: string): string =>
	normalizeRoleName(name).toLocaleLowerCase('es');

export const createRoleCode = (name: string): string =>
	normalizeRoleName(name)
		.normalize('NFD')
		.replace(ROLE_CODE_MARKS, '')
		.toLocaleLowerCase('es')
		.replace(ROLE_CODE_SEPARATORS, '-')
		.replace(ROLE_CODE_INVALID, '-')
		.replace(ROLE_CODE_DUPLICATE_HYPHENS, '-')
		.replace(/^-|-$/gu, '')
		.slice(0, 100);
