import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Proxy (convención de archivo raíz desde Next.js 16 — antes se llamaba
 * `middleware.ts`; no confundir con `middleware/auth.ts` y `middleware/access.ts`, que son
 * next-connect y se importan explícitamente por ruta).
 *
 * Sin esto no había CORS en ningún endpoint (ver AGENTS.md/discovery original). Se necesitó al
 * agregar el login nativo con Bearer token (feature 014/003): el flujo web sigue siendo
 * same-origin (proxy de Vite) y no lo necesita, pero la app empaquetada llama al backend desde
 * un origen distinto (WebView local) y, sin `Authorization`/cookies de por medio, un CORS
 * abierto (`*`) es seguro — no hay credenciales de cookie que un origen ajeno pueda robar.
 */
const CORS_HEADERS: Record<string, string> = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Correlation-ID',
};

export const proxy = (request: NextRequest): NextResponse => {
	if (request.method === 'OPTIONS') {
		return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
	}

	const response = NextResponse.next();
	for (const [key, value] of Object.entries(CORS_HEADERS)) {
		response.headers.set(key, value);
	}
	return response;
};

export const config = {
	matcher: '/api/:path*',
};
