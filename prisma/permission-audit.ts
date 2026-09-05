import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ACCESS_CALL_PATTERN = /\baccess\(([^)]*)\)/gu;
const STRING_LITERAL_PATTERN = /^['"]([a-zA-Z0-9_.-]+)['"]$/u;

export type RequiredPermissionCodes = {
	requiredCodes: Set<string>;
	unrecognizedCalls: string[];
};

const collectApiFiles = (dir: string): string[] => {
	const entries = readdirSync(dir, { withFileTypes: true });

	return entries.flatMap(entry => {
		const fullPath = join(dir, entry.name);
		return entry.isDirectory()
			? collectApiFiles(fullPath)
			: entry.name.endsWith('.ts')
				? [fullPath]
				: [];
	});
};

/**
 * Escaneo estático (regex sobre texto, no un parser de TypeScript) de todas las
 * llamadas `access(...)` bajo `pagesApiDir`. Es deliberadamente simple: refuerza
 * el mecanismo manual existente en `prisma/seed.ts`, no lo reemplaza por una
 * herramienta nueva (feature 021).
 */
export const extractRequiredPermissionCodes = (pagesApiDir: string): RequiredPermissionCodes => {
	const requiredCodes = new Set<string>();
	const unrecognizedCalls: string[] = [];

	for (const filePath of collectApiFiles(pagesApiDir)) {
		const content = readFileSync(filePath, 'utf8');

		for (const match of content.matchAll(ACCESS_CALL_PATTERN)) {
			const rawArguments = match[1] ?? '';
			const args = rawArguments
				.split(',')
				.map(arg => arg.trim())
				.filter(Boolean);

			for (const arg of args) {
				const literalMatch = STRING_LITERAL_PATTERN.exec(arg);

				if (literalMatch) {
					requiredCodes.add(literalMatch[1]);
				} else {
					unrecognizedCalls.push(`${filePath}: access(${rawArguments})`);
				}
			}
		}
	}

	return { requiredCodes, unrecognizedCalls };
};

export type PermissionCatalogDiff = {
	missingCodes: string[];
	orphanCodes: string[];
};

/**
 * Compara los códigos que el código real exige (`requiredCodes`) contra los que
 * ya existen en el catálogo (`catalogCodes`). Puramente funcional: no toca la
 * base de datos, así que decidir qué hacer con cada lista (crear, solo reportar)
 * queda en quien la llama — aquí nunca se borra nada.
 */
export const diffPermissionCatalog = (
	requiredCodes: Set<string>,
	catalogCodes: Set<string>,
): PermissionCatalogDiff => ({
	missingCodes: [...requiredCodes].filter(code => !catalogCodes.has(code)),
	orphanCodes: [...catalogCodes].filter(code => !requiredCodes.has(code)),
});
