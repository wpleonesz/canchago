# 009 · Sesiones Persistentes en Servidor

## Qué

Sacar los tokens OAuth de la cookie y persistirlos en el servidor, en la tabla `UserSession` que ya existe en el schema y que hoy no usa nadie. La cookie pasa a llevar únicamente un identificador de sesión.

## Por qué

Al probar el login desde un navegador real (feature 008), **el login falla**: la cookie de sesión pesa **5.336 bytes** y el límite que imponen todos los navegadores es de **4.096**. Chrome la descarta **en silencio** — sin error ni aviso — así que el callback funciona, el usuario se sincroniza, y el navegador aterriza en `/api/auth/session` sin cookie y recibe un `401`.

No se detectó antes porque `curl` no aplica ese límite: el flujo pasaba en la terminal y fallaba en el navegador.

Medición del contenido de la cookie:

| Contenido | Bytes (JSON en claro) |
|---|---|
| Usuario (id, email, roles, permisos) | 457 |
| `accessToken` | 1.341 |
| `idToken` | 1.153 |
| `refreshToken` | 599 |
| **Total, ya cifrado, que viaja al navegador** | **5.254** |

Los tres tokens son el **83 %** del peso.

### Por qué no basta con quitar el `idToken`

Quitarlo baja la cookie a 3.718 bytes: pasa, pero deja sólo **378 bytes de margen**. El bloque del usuario crece con cada rol y permiso concedido (~60 bytes por permiso), así que al otorgar el catálogo de permisos a un rol la cookie **vuelve a superar el límite** y el login se rompe otra vez. Es un parche que estalla justo cuando se empiece a usar la autorización.

Con los tokens en el servidor, la cookie queda en **1.073 bytes**, con margen de sobra.

## Qué más arregla

Al persistir la sesión, se resuelven dos defectos abiertos de la feature 008:

1. **El logout no invalidaba nada.** La cookie sellada era un token autocontenido: quien copiara su valor lo seguía usando hasta 8 h después del logout. Ahora el logout marca la sesión como revocada y el middleware la rechaza.
2. **Los roles nuevos exigían volver a iniciar sesión.** El usuario se leía de la cookie, congelado en el instante del login. Ahora se carga de la base de datos en cada petición, así que un rol o permiso concedido surte efecto de inmediato.

## Alcance

### Dentro

- Rediseño del modelo `UserSession` y su migración.
- Capa `database/sessions/` y servicio `services/auth/`.
- Cookie reducida a `{ sessionId, createdAt }`.
- `middleware/auth` resuelve la sesión contra la base de datos.
- `callback`, `logout` y `refresh` adaptados.

### Fuera

- No se toca el flujo OAuth ni PKCE (`lib/oauth/`).
- No se corrigen los códigos de permiso inconsistentes (`users.read` vs `usuarios.read`): eso sigue pendiente.

## Decisiones

- **Los tokens se guardan cifrados**, no en claro: se sellan con `@hapi/iron` (el mismo mecanismo y secreto que ya usa la cookie) y se persisten como un único blob. Un volcado de la base de datos no expone los tokens.
- **La tabla `user_sessions` está vacía** (0 filas), así que se puede rediseñar sin migración de datos.
- **El usuario se carga desde la base en cada petición.** Cuesta una consulta extra, y a cambio la autorización deja de estar congelada en la cookie. Es el intercambio clásico entre sesiones sin estado y sesiones con estado, y conviene que quede explícito.

## Criterios de aceptación

1. La cookie de sesión mide **menos de 4.096 bytes** y el login completo funciona **en Chrome**, no sólo con `curl`.
2. `GET /api/auth/session` devuelve el usuario con sus roles y permisos.
3. Tras `yarn asignar-rol`, el rol aparece en `/api/auth/session` **sin necesidad de cerrar sesión y volver a entrar**.
4. Tras `POST /api/auth/logout`, reenviar a mano el valor viejo de la cookie devuelve **401**, no 200.
5. Una sesión expirada (`expiresAt` en el pasado) devuelve **401**.
6. `POST /api/auth/refresh` renueva los tokens en la base sin cambiar el identificador de sesión.
