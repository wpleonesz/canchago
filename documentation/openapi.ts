import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import type { OpenAPIObject } from 'openapi3-ts/oas30';

import { registry } from './registry';

// Importa los módulos que registran rutas y schemas.
// Añade aquí cada módulo de documentación a medida que se creen.
import './schemas';

export const generateOpenApiSpec = (): OpenAPIObject => {
	const generator = new OpenApiGeneratorV3(registry.definitions);

	return generator.generateDocument({
		openapi: '3.0.3',
		info: {
			title: 'Canchago API',
			version: '1.0.0',
			description: 'Documentación de la API REST de Canchago.',
		},
		servers: [
			{
				url: '/api',
				description: 'Servidor principal',
			},
		],
	});
};
