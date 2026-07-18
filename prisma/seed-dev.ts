import { prisma } from '@/database/client';

/**
 * Roles base del dominio.
 *
 * `organizationId` aqui define de quien es la DEFINICION del rol:
 *  - null  -> rol global de plataforma, disponible para cualquier tenant.
 *  - uuid  -> rol que pertenece a una organizacion concreta.
 *
 * El ALCANCE con el que se le asigna a un usuario es otra cosa distinta,
 * y vive en UserRole.organizationId / UserRole.venueId (ver prisma/asignar-rol.ts).
 */
type RoleSeed = {
	name: string;
	description: string;
	global: boolean;
};

const ROLES: RoleSeed[] = [
	{
		name: 'Futbolista',
		description: 'Reserva canchas. No pertenece a una organizacion: puede jugar en cualquiera.',
		global: true,
	},
	{
		name: 'Administrador',
		description: 'Administra la plataforma completa. No esta ligado a una organizacion.',
		global: true,
	},
	{
		name: 'Gestor de Cancha',
		description: 'Gestiona las canchas y reservas de la organizacion a la que pertenece.',
		global: false,
	},
];

const toCode = (name: string): string => name.toLowerCase().replace(/\s+/gu, '-');

const resolveOrganization = async () => {
	const preferred = await prisma.organization.findFirst({
		where: { name: 'Cancha 2', deletedAt: null },
	});

	if (preferred) {
		return preferred;
	}

	const anyOrganization = await prisma.organization.findFirst({
		where: { deletedAt: null },
		orderBy: { createdAt: 'asc' },
	});

	if (anyOrganization) {
		return anyOrganization;
	}

	return prisma.organization.create({
		data: { name: 'Canchago Demo', status: 'ACTIVE' },
	});
};

const main = async (): Promise<void> => {
	console.log('🌱 Sembrando roles base...\n');

	const organization = await resolveOrganization();
	console.log(`🏢 Organizacion para roles de tenant: ${organization.name} (${organization.id})\n`);

	for (const role of ROLES) {
		const organizationId = role.global ? null : organization.id;

		// Busqueda explicita en vez de upsert: la restriccion @@unique([organizationId, name])
		// NO protege a los roles globales, porque PostgreSQL trata cada NULL como distinto
		// y permitiria insertar "Futbolista" global tantas veces como se ejecute la semilla.
		const existing = await prisma.role.findFirst({
			where: { organizationId, name: role.name, deletedAt: null },
		});

		if (existing) {
			console.log(`⏭️  Ya existe: ${role.name} (${existing.id})`);
			continue;
		}

		const created = await prisma.role.create({
			data: {
				organizationId,
				name: role.name,
				code: toCode(role.name),
				description: role.description,
				isSystem: true,
			},
		});

		const scope = organizationId ? `organizacion ${organization.name}` : 'global';
		console.log(`✅ Creado: ${role.name} [${scope}] (${created.id})`);
	}

	console.log('\n✅ Roles base listos.');

	await grantAllPermissionsToAdmin();
};

/**
 * El rol Administrador administra la plataforma completa, asi que recibe TODOS
 * los permisos del catalogo (los crea `yarn seed`). Sin este paso los roles
 * nacen sin permisos y cualquier endpoint protegido responde 403.
 */
const grantAllPermissionsToAdmin = async (): Promise<void> => {
	const admin = await prisma.role.findFirst({
		where: { code: 'administrador', deletedAt: null },
	});

	if (!admin) {
		console.log('⏭️  No existe el rol Administrador; nada que otorgar.');
		return;
	}

	const permissions = await prisma.permission.findMany({ select: { id: true, code: true } });

	if (permissions.length === 0) {
		console.log('⚠️  El catalogo de permisos esta vacio. Corre `yarn seed` primero.');
		return;
	}

	for (const permission of permissions) {
		await prisma.rolePermission.upsert({
			where: { roleId_permissionId: { roleId: admin.id, permissionId: permission.id } },
			create: { roleId: admin.id, permissionId: permission.id },
			update: { granted: true },
		});
	}

	console.log(`🔑 Administrador ahora tiene ${permissions.length} permisos.`);
};

main()
	.catch((error: unknown) => {
		console.error('❌ Error en seed-dev:', error instanceof Error ? error.message : error);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
