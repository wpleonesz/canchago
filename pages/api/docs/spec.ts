import type { NextApiRequest, NextApiResponse } from 'next';
import type { OpenAPIObject } from 'openapi3-ts/oas30';

import { generateOpenApiSpec } from '@/documentation/openapi';

let cachedSpec: OpenAPIObject | null = null;

export default function handler(_req: NextApiRequest, res: NextApiResponse): void {
	if (!cachedSpec) {
		cachedSpec = generateOpenApiSpec();
	}

	res.setHeader('Content-Type', 'application/json');
	res.status(200).json(cachedSpec);
}
