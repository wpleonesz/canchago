import { z } from 'zod';

import { registry } from '@/documentation/registry';
import { ErrorResponseSchema } from '@/documentation/responses/common';

const RoleSchema = z.object({
	id: z.string().uuid(),
	code: z.string(),
	name: z.string(),
});

const PermissionSchema = z.object({
	id: z.string().uuid(),
	code: z.string(),
});

export const SessionResponseSchema = z.object({
	id: z.string().uuid(),
	email: z.string().email(),
	name: z.string(),
	roles: z.array(RoleSchema),
	permissions: z.array(PermissionSchema),
});

registry.register('SessionResponse', SessionResponseSchema);
registry.register('ErrorResponse', ErrorResponseSchema);
registry.registerComponent('securitySchemes', 'cookieAuth', {
	type: 'apiKey',
	in: 'cookie',
	name: 'canchago_session',
});

const errorResponses = {
	400: {
		description: 'Solicitud inválida',
		content: {
			'application/json': {
				schema: ErrorResponseSchema,
			},
		},
	},
	401: {
		description: 'No autenticado',
		content: {
			'application/json': {
				schema: ErrorResponseSchema,
			},
		},
	},
};

const loginDescription = `Inicia el flujo OAuth 2.0 Authorization Code + PKCE.

## ⚠️ Este endpoint NO se prueba con "Execute"

Si pulsas **Execute**, verás el error \`TypeError: Failed to fetch\`. **No es un fallo de la API.**

"Execute" hace una llamada AJAX (\`fetch\`). Este endpoint responde \`302\` hacia el Identity Provider, y el navegador **bloquea por CORS** esa llamada AJAX hacia otro origen. Aunque no la bloqueara, un login no se puede pintar dentro de un \`fetch\`: el usuario necesita **ver** la pantalla del proveedor para escribir su contraseña.

> **La lección:** el login OAuth exige una **navegación real del navegador**, no una petición AJAX. Ninguna SPA puede iniciar sesión con \`fetch\`; siempre redirige la ventana completa.

## Cómo probar de verdad

1. Abre en una **pestaña nueva**: <a href="/api/auth/login" target="_blank">http://localhost:3000/api/auth/login</a>
2. Autentícate en Keycloak (p. ej. \`futbolista\` / \`canchago123\`). **La contraseña se escribe en el IdP, nunca en Canchago.**
3. Al volver, la cookie de sesión ya está en el navegador.
4. Regresa a esta pestaña y prueba \`GET /auth/session\` con **Execute** — ahí sí funciona.

## Qué mirar en DevTools → Network

- La redirección lleva \`code_challenge_method=S256\`: eso es **PKCE**.
- La cookie \`canchago_oauth_state\` guarda \`state\`, \`nonce\` y \`code_verifier\` **cifrados**.
- La cookie final \`canchago_session\` sale con \`HttpOnly; Secure; SameSite=Lax\`. \`HttpOnly\` = **JavaScript no puede leerla**: ésa es la defensa contra XSS.`;

const callbackDescription = `Procesa el código OAuth devuelto por el proveedor y crea la sesión interna.

**Nunca lo llamas tú.** Es la URL de retorno a la que el Identity Provider redirige al navegador. Pulsar **Execute** aquí sólo dará \`401\`, porque no hay \`code\` ni \`state\` válidos.

## Qué hace, en orden

1. Compara el \`state\` recibido contra el que guardó cifrado en la cookie temporal → **defensa contra CSRF**.
2. Canjea el \`code\` por tokens, enviando el \`code_verifier\` → **eso es PKCE**: quien robe el \`code\` no puede canjearlo sin el verifier.
3. Verifica el ID token: **firma** (contra el JWKS del proveedor), **issuer**, **audience** y **nonce**.
4. Crea o sincroniza el usuario en Canchago (\`findOrSyncByOAuth\`), enlazándolo al IdP por \`authAccount(provider, sub)\`.
5. Sella la sesión en una cookie cifrada y redirige.

> **Ojo con el orden:** el usuario de Canchago lo crea **este** endpoint, en el primer login. Si creas el usuario antes con \`POST /users\` usando el mismo email, no tendrá \`authAccount\`, y este paso intentará crear otro usuario con ese email y fallará por unicidad.`;

const sessionDescription = `Devuelve el usuario autenticado asociado a la cookie de sesión activa.

## Cómo probar desde esta documentación

1. **Sin haber iniciado sesión**, pulsa **Execute** → responde \`401\`: _"Missing session cookie"_.
2. Inicia sesión abriendo \`/api/auth/login\` en una pestaña nueva (ver ese endpoint).
3. Vuelve aquí y pulsa **Execute** otra vez → ahora responde \`200\`. No configuraste ninguna cabecera: el navegador envía la cookie solo.

## Lo que hay que hacer notar a los alumnos

Un usuario recién autenticado llega así:

\`\`\`json
{ "data": { "email": "futbolista@canchago.local", "roles": [], "permissions": [] } }
\`\`\`

**Está autenticado, pero no está autorizado a nada.** Ésa es la diferencia entre las dos palabras.

Los roles se asignan aparte (\`yarn asignar-rol\`) y **no aparecen aquí hasta que el usuario cierre sesión y vuelva a entrar**: la sesión se cifra dentro de la cookie en el momento del login, así que no se entera de cambios posteriores en la base de datos.`;

const refreshDescription = `Renueva el access token cuando está próximo a expirar.

**Comportamiento:**
- Si el token expira en menos de 5 minutos → renueva y devuelve \`204\` con cookie actualizada.
- Si el token sigue vigente → devuelve \`204\` sin cambios.

**Cómo probar desde esta documentación:**

1. Asegúrate de tener sesión activa.
2. Haz clic en **Execute** — la cookie se enviará automáticamente.`;

const logoutDescription = `Cierra la sesión: revoca el token en el Identity Provider y elimina la cookie.

## Cómo probar desde esta documentación

1. Con sesión activa, pulsa **Execute** → responde \`204 No Content\`.
2. Fíjate en la cabecera de respuesta: \`Set-Cookie: canchago_session=; Max-Age=0\` — así se borra una cookie.
3. Vuelve a \`GET /auth/session\` y pulsa **Execute** → ahora responde \`401\`. Ya no hay sesión.

## ⚠️ Advertencia honesta: esto NO invalida la sesión en el servidor

La cookie es un token **sellado y autocontenido** (\`@hapi/iron\`). El logout la borra **del navegador**, pero no la anula en el servidor: no existe una lista de sesiones revocadas.

Si alguien **copió el valor** de la cookie antes del logout y lo reenvía a mano:

\`\`\`bash
curl -i http://localhost:3000/api/auth/session -H "Cookie: canchago_session=<valor-viejo>"
\`\`\`

…la API **responde \`200\`** hasta que el token expire (8 h, \`SESSION_COOKIE_MAX_AGE_SECONDS\`).

> **Para discutir en clase:** las sesiones sin estado son cómodas pero difíciles de revocar. La solución sería persistir la sesión (la tabla \`UserSession\` ya existe en el schema, pero hoy no la usa nadie) o llevar una lista de revocación en Redis que el middleware \`auth\` consulte.`;

registry.registerPath({
	method: 'get',
	path: '/auth/login',
	tags: ['Auth'],
	security: [],
	description: loginDescription,
	responses: {
		302: {
			description: 'Redirección al proveedor OAuth',
		},
		...errorResponses,
	},
});

registry.registerPath({
	method: 'get',
	path: '/auth/callback',
	tags: ['Auth'],
	security: [],
	description: callbackDescription,
	responses: {
		302: {
			description: 'Redirección al cliente con sesión creada',
		},
		...errorResponses,
	},
});

registry.registerPath({
	method: 'get',
	path: '/auth/session',
	tags: ['Auth'],
	security: [{ cookieAuth: [] }],
	description: sessionDescription,
	responses: {
		200: {
			description: 'Sesión activa',
			content: {
				'application/json': {
					schema: z.object({
						data: SessionResponseSchema,
					}),
				},
			},
		},
		401: errorResponses[401],
	},
});

registry.registerPath({
	method: 'post',
	path: '/auth/refresh',
	tags: ['Auth'],
	security: [{ cookieAuth: [] }],
	description: refreshDescription,
	responses: {
		204: {
			description: 'Sesión renovada',
		},
		401: errorResponses[401],
		400: errorResponses[400],
	},
});

registry.registerPath({
	method: 'post',
	path: '/auth/logout',
	tags: ['Auth'],
	security: [{ cookieAuth: [] }],
	description: logoutDescription,
	responses: {
		204: {
			description: 'Sesión eliminada',
		},
		401: errorResponses[401],
	},
});
