import { prisma } from '@/database/client';

const PERMISSIONS = [
	{ module: 'usuarios', action: 'read', description: 'Leer usuarios' },
	{ module: 'usuarios', action: 'write', description: 'Crear/actualizar usuarios' },
	{ module: 'usuarios', action: 'delete', description: 'Eliminar usuarios' },
	{ module: 'organizaciones', action: 'read', description: 'Leer organizaciones' },
	{ module: 'organizaciones', action: 'manage', description: 'Gestionar organizaciones' },
	{ module: 'sedes', action: 'read', description: 'Leer sedes' },
	{ module: 'sedes', action: 'manage', description: 'Gestionar sedes' },
	{ module: 'roles', action: 'read', description: 'Leer roles' },
	{ module: 'roles', action: 'manage', description: 'Gestionar roles' },
	{ module: 'permisos', action: 'read', description: 'Leer permisos' },
];

async function main() {
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

	console.log('✅ Seed completado');
}

main()
	.catch(e => {
		console.error('❌ Error en seed:', e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
