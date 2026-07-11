import { prisma } from '@/database/client';

/**
 * Asigna un rol a un usuario respetando el ALCANCE de la asignacion.
 *
 *   yarn asignar-rol --email futbolista@canchago.local --rol futbolista
 *   yarn asignar-rol --email gestor@canchago.local     --rol gestor-de-cancha
 *   yarn asignar-rol --email gestor@canchago.local     --rol gestor-de-cancha --sede <venueId>
 *
 * Se usa este script y no POST /api/users/:userId/roles porque ese endpoint
 * crea el UserRole sin organizationId ni venueId: no sabe expresar el alcance.
 *
 * El usuario debe existir ya en Canchago, y solo existe despues de su PRIMER LOGIN
 * (lo crea el callback via findOrSyncByOAuth). Ese es el orden correcto.
 */
type Args = {
	email: string;
	rol: string;
	organizacion?: string;
	sede?: string;
};

const parseArgs = (argv: string[]): Args => {
	const values = new Map<string, string>();

	for (let index = 0; index < argv.length; index += 1) {
		const token = argv[index];

		if (!token.startsWith('--')) {
			continue;
		}

		const next = argv[index + 1];

		if (!next || next.startsWith('--')) {
			throw new Error(`Falta el valor para ${token}`);
		}

		values.set(token.slice(2), next);
		index += 1;
	}

	const email = values.get('email');
	const rol = values.get('rol');

	if (!email || !rol) {
		throw new Error(
			'Uso: yarn asignar-rol --email <email> --rol <codigo-del-rol> [--organizacion <uuid>] [--sede <uuid>]',
		);
	}

	return {
		email,
		rol,
		organizacion: values.get('organizacion'),
		sede: values.get('sede'),
	};
};

const main = async (): Promise<void> => {
	const args = parseArgs(process.argv.slice(2));

	const user = await prisma.user.findUnique({ where: { email: args.email } });

	if (!user) {
		throw new Error(
			`No existe el usuario ${args.email} en Canchago. Debe iniciar sesion al menos una vez: el callback lo crea automaticamente.`,
		);
	}

	const role = await prisma.role.findFirst({
		where: { code: args.rol, deletedAt: null },
	});

	if (!role) {
		const disponibles = await prisma.role.findMany({
			where: { deletedAt: null },
			select: { code: true },
		});

		throw new Error(
			`No existe el rol '${args.rol}'. Disponibles: ${disponibles.map(r => r.code).join(', ') || '(ninguno, corre yarn seed-dev)'}`,
		);
	}

	// Alcance de la asignacion:
	//  - Rol global (Futbolista, Administrador) -> sin organizacion: vale en toda la plataforma.
	//  - Rol de tenant (Gestor de Cancha)       -> la organizacion dueña del rol, salvo que se indique otra.
	const organizationId = args.organizacion ?? role.organizationId;
	const venueId = args.sede ?? null;

	if (venueId) {
		if (!organizationId) {
			throw new Error('No se puede asignar una sede sin una organizacion.');
		}

		const venue = await prisma.venue.findFirst({
			where: { id: venueId, organizationId, deletedAt: null },
		});

		if (!venue) {
			throw new Error(
				`La sede ${venueId} no existe o no pertenece a la organizacion ${organizationId}.`,
			);
		}
	}

	const existing = await prisma.userRole.findFirst({
		where: { userId: user.id, roleId: role.id, organizationId, venueId },
	});

	if (existing) {
		console.log(
			`⏭️  ${args.email} ya tiene el rol '${role.name}' con ese mismo alcance. Nada que hacer.`,
		);
		return;
	}

	await prisma.userRole.create({
		data: { userId: user.id, roleId: role.id, organizationId, venueId },
	});

	const alcance = organizationId
		? `organizacion ${organizationId}${venueId ? ` · sede ${venueId}` : ''}`
		: 'global (toda la plataforma)';

	console.log(`✅ Rol '${role.name}' asignado a ${args.email}`);
	console.log(`   Alcance: ${alcance}`);
	console.log(
		'\n⚠️  La sesion se cifra en la cookie al iniciar sesion: cierra sesion y vuelve a entrar para que el rol aparezca en /api/auth/session.',
	);
};

main()
	.catch((error: unknown) => {
		console.error('❌', error instanceof Error ? error.message : error);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
