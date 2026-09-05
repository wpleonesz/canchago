import { join } from 'node:path';

import { prisma } from '@/database/client';

import { diffPermissionCatalog, extractRequiredPermissionCodes } from './permission-audit';

// El catalogo debe reflejar EXACTAMENTE los codigos que exigen los middlewares
// access(...) en pages/api/. Si un codigo aqui no coincide con el que la ruta
// verifica, el permiso "existe" en la base pero nunca se concede -> 403 eterno.
// El modulo de usuarios usa el codigo en ingles (users) porque asi lo enforcan
// las rutas de pages/api/users/*.
const PERMISSIONS = [
	{ module: 'users', action: 'read', description: 'Leer usuarios' },
	{ module: 'users', action: 'create', description: 'Crear usuarios' },
	{ module: 'users', action: 'update', description: 'Actualizar usuarios' },
	{ module: 'users', action: 'delete', description: 'Eliminar usuarios' },
	{ module: 'users', action: 'manage', description: 'Gestionar roles de usuarios' },
	{ module: 'organizaciones', action: 'read', description: 'Leer organizaciones' },
	{ module: 'organizaciones', action: 'manage', description: 'Gestionar organizaciones' },
	{ module: 'sedes', action: 'read', description: 'Leer sedes' },
	{ module: 'sedes', action: 'manage', description: 'Gestionar sedes' },
	{ module: 'roles', action: 'read', description: 'Leer roles' },
	{ module: 'roles', action: 'manage', description: 'Gestionar roles' },
	{ module: 'permisos', action: 'read', description: 'Leer permisos' },
	{ module: 'menus', action: 'read', description: 'Leer menús' },
];

/**
 * Catálogo de menús (feature 021). Refleja EXACTAMENTE la navegación real y ya
 * existente en `canchago-ionic/src/features/admin/navigation/admin-navigation.ts`:
 * cada grupo de `ADMIN_NAVIGATION` es un menú padre (sin `route`, es solo un
 * encabezado) y cada ítem es un menú hijo con su `route` y el permiso real que
 * ya lo protege en `pages/api/`. No se inventan secciones que ningún cliente use hoy.
 */
const MENU_GROUPS = [
	{ code: 'users-access', name: 'Usuarios y acceso' },
	{ code: 'structure', name: 'Estructura' },
];

type MenuItemSeed = {
	code: string;
	name: string;
	route: string;
	parentCode: string;
	permissionCodes: string[];
};

const MENU_ITEMS: MenuItemSeed[] = [
	{
		code: 'users',
		name: 'Usuarios',
		route: '/admin/users',
		parentCode: 'users-access',
		permissionCodes: ['users.read'],
	},
	{
		code: 'roles',
		name: 'Roles',
		route: '/admin/roles',
		parentCode: 'users-access',
		permissionCodes: ['roles.read'],
	},
	{
		code: 'permissions',
		name: 'Permisos',
		route: '/admin/permissions',
		parentCode: 'users-access',
		permissionCodes: ['permisos.read'],
	},
	{
		code: 'organizations',
		name: 'Organizaciones',
		route: '/admin/organizations',
		parentCode: 'structure',
		permissionCodes: ['organizaciones.read'],
	},
];

const PAGES_API_DIR = join(process.cwd(), 'pages', 'api');

/**
 * Audita el catálogo de permisos contra el código real: crea de forma aditiva
 * los códigos que `access(...)` exige y que faltan en la tabla, y reporta (sin
 * borrar nunca) los códigos sembrados que ningún `access(...)` exige hoy — pueden
 * estar ya asignados a un rol real y borrarlos en cascada perdería esa asignación
 * sin que nadie lo haya decidido.
 */
const auditPermissionCatalog = async (): Promise<void> => {
	console.log('\n🔎 Auditando catálogo de permisos contra pages/api/**...');

	const { requiredCodes, unrecognizedCalls } = extractRequiredPermissionCodes(PAGES_API_DIR);
	const catalog = await prisma.permission.findMany({ select: { code: true } });
	const catalogCodes = new Set(catalog.map(permission => permission.code));

	const { missingCodes, orphanCodes } = diffPermissionCatalog(requiredCodes, catalogCodes);

	for (const code of missingCodes) {
		const [module, ...actionParts] = code.split('.');
		const action = actionParts.join('.') || code;

		await prisma.permission.create({
			data: { module, action, code, description: null },
		});
		console.log(`✅ Permiso faltante creado desde auditoría: ${code}`);
	}

	if (orphanCodes.length > 0) {
		console.log(
			`⚠️  Permisos huérfanos (en el catálogo pero sin access() que los exija): ${orphanCodes.join(', ')}`,
		);
		console.log('   No se eliminan automáticamente: requieren una decisión explícita del equipo.');
	}

	if (unrecognizedCalls.length > 0) {
		console.log('⚠️  Llamadas a access(...) no reconocidas como literal string (revisar a mano):');
		unrecognizedCalls.forEach(call => console.log(`   - ${call}`));
	}

	if (missingCodes.length === 0 && orphanCodes.length === 0 && unrecognizedCalls.length === 0) {
		console.log('✅ Catálogo de permisos sincronizado con el código real.');
	}
};

const seedMenus = async (): Promise<void> => {
	console.log('\n🌱 Sembrando catálogo de menús...');

	const groupIdByCode = new Map<string, string>();

	for (const group of MENU_GROUPS) {
		const existing = await prisma.menu.findUnique({ where: { code: group.code } });

		if (existing) {
			groupIdByCode.set(group.code, existing.id);
			console.log(`⏭️  Menú ya existe: ${group.code}`);
			continue;
		}

		const created = await prisma.menu.create({ data: { code: group.code, name: group.name } });
		groupIdByCode.set(group.code, created.id);
		console.log(`✅ Menú creado: ${group.code}`);
	}

	for (const item of MENU_ITEMS) {
		const parentId = groupIdByCode.get(item.parentCode);

		if (!parentId) {
			console.error(`❌ Grupo de menú "${item.parentCode}" no existe; se omite "${item.code}".`);
			continue;
		}

		let menu = await prisma.menu.findUnique({ where: { code: item.code } });

		if (!menu) {
			menu = await prisma.menu.create({
				data: { code: item.code, name: item.name, route: item.route, parentId },
			});
			console.log(`✅ Menú creado: ${item.code}`);
		} else {
			console.log(`⏭️  Menú ya existe: ${item.code}`);
		}

		for (const permissionCode of item.permissionCodes) {
			const permission = await prisma.permission.findUnique({ where: { code: permissionCode } });

			if (!permission) {
				console.error(
					`❌ Permiso "${permissionCode}" no existe; no se asocia al menú "${item.code}".`,
				);
				continue;
			}

			await prisma.menuPermission.upsert({
				where: { menuId_permissionId: { menuId: menu.id, permissionId: permission.id } },
				create: { menuId: menu.id, permissionId: permission.id },
				update: {},
			});
		}
	}

	console.log('✅ Catálogo de menús listo.');
};

const main = async (): Promise<void> => {
	console.log('🌱 Starting seed...');

	for (const perm of PERMISSIONS) {
		const code = `${perm.module}.${perm.action}`;
		const existing = await prisma.permission.findUnique({
			where: { code },
		});

		if (!existing) {
			await prisma.permission.create({
				data: {
					module: perm.module,
					action: perm.action,
					code,
					description: perm.description,
				},
			});
			console.log(`✅ Permiso creado: ${code}`);
		} else {
			console.log(`⏭️  Permiso ya existe: ${code}`);
		}
	}

	await auditPermissionCatalog();
	await seedMenus();

	console.log('✅ Seed completado');
};

main()
	.catch(e => {
		console.error('❌ Error en seed:', e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
