const NAME_SPACES = /\s+/gu;

export const normalizeOrganizationName = (name: string): string =>
	name.trim().replace(NAME_SPACES, ' ');

export const normalizeOrganizationIdentity = (name: string): string =>
	normalizeOrganizationName(name).toLocaleLowerCase('es');

export const normalizeVenueName = (name: string): string => name.trim().replace(NAME_SPACES, ' ');

export const normalizeVenueIdentity = (name: string): string =>
	normalizeVenueName(name).toLocaleLowerCase('es');
