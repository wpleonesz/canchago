# Práctica guiada en clase — Autenticación y Autorización desde Swagger

> Para los alumnos. Todo se hace desde **http://localhost:3000/api/docs**, sin escribir código y sin `curl`.
> Verificado contra la API real.

## Antes de empezar (lo hace el docente)

```bash
docker compose up -d      # Keycloak (el Identity Provider)
yarn seed && yarn seed-dev
yarn dev
```

Abrir **http://localhost:3000/api/docs**.

Credenciales de práctica: usuario `futbolista`, contraseña `canchago123`.

---

## Paso 1 · Leer el candado antes de tocar nada

Recorran la lista de endpoints y fíjense en el icono **🔒**.

- `GET /auth/login` y `GET /auth/callback` → **sin candado**: son públicos. Tienen que serlo, porque son la puerta de entrada: exigir sesión para poder iniciar sesión sería absurdo.
- Todos los demás (`/users`, `/roles`, `/organizaciones`…) → **con candado**: exigen sesión.

**Pregunta para la clase:** ¿por qué `/auth/logout` tiene candado? Porque para cerrar una sesión hay que tener una.

---

## Paso 2 · Chocar contra el 401

Sin haber iniciado sesión:

**`GET /auth/session`** → botón **Try it out** → **Execute**

```
401 Unauthorized
{ "error": { "code": "UNAUTHORIZED", "message": "Missing session cookie" } }
```

> **401 = "no sé quién eres".** Lo produce el middleware `auth`.

---

## Paso 3 · La trampa: "Execute" en el login NO funciona

Vayan a **`GET /auth/login`** y pulsen **Execute**.

Verán: **`TypeError: Failed to fetch`**.

**No está roto.** Es la lección más importante del día:

- "Execute" hace una llamada **AJAX** (`fetch`).
- El login responde `302` hacia Keycloak, que vive en **otro origen** (`localhost:8081`).
- El navegador **bloquea esa llamada AJAX por CORS**.
- Y aunque no la bloqueara, **una pantalla de login no se puede pintar dentro de un `fetch`**: el usuario necesita *ver* dónde escribe su contraseña.

> **Conclusión:** el login OAuth exige una **navegación completa del navegador**, nunca un AJAX. Por eso, cuando entran a cualquier web con "Iniciar sesión con Google", la ventana **entera** se va a Google y luego vuelve.

---

## Paso 4 · Iniciar sesión de verdad

Abrir en una **pestaña nueva**:

```
http://localhost:3000/api/auth/login
```

Con **DevTools → Network** abierto y la casilla *Preserve log* activada. Autenticarse como `futbolista` / `canchago123`.

### Qué observar en Network (esto es la clase entera en tres capturas)

1. **La petición a `/api/auth/login`** responde `302`. Miren la cabecera `Location`: contiene `code_challenge=…` y **`code_challenge_method=S256`**. Eso es **PKCE**.

2. **La pantalla de Keycloak.** La contraseña se escribe **aquí**, en el Identity Provider. Canchago **nunca la ve**. No existe ningún endpoint en esta API que reciba una contraseña — pueden buscarlo en la lista de Swagger.

3. **La vuelta a `/api/auth/callback?code=…&state=…`**. Canchago recibe un **código de un solo uso**, no la contraseña. Y responde con:

```
Set-Cookie: canchago_session=Fe26.2**…; HttpOnly; Secure; SameSite=Lax; Path=/
```

| Atributo | Para qué sirve |
|---|---|
| `HttpOnly` | **JavaScript no puede leer la cookie.** Defensa contra XSS. |
| `Secure` | Sólo viaja por HTTPS (los navegadores hacen excepción con `localhost`). |
| `SameSite=Lax` | No se envía desde sitios de terceros. Defensa contra CSRF. |
| `Fe26.2**…` | La sesión va **cifrada** dentro de la propia cookie. |

**Intenten leerla desde la consola del navegador:**

```js
document.cookie   // la cookie de sesión NO aparece
```

Eso es `HttpOnly` funcionando.

---

## Paso 5 · Ver la sesión (200)

Volver a la pestaña de Swagger. **`GET /auth/session`** → **Execute**.

Ahora responde `200`:

```json
{
  "data": {
    "id": "c5e6374e-…",
    "email": "futbolista@canchago.local",
    "name": "Mateo Vera",
    "roles": [],
    "permissions": []
  }
}
```

**Nadie configuró ninguna cabecera.** El navegador envió la cookie solo.

### La pregunta clave

> Este usuario **no existía** en la base de datos de Canchago hace un minuto. ¿Quién lo creó?

Lo creó el `callback` en el primer login, sincronizándolo desde el Identity Provider. Se puede comprobar con `yarn prisma-studio` → tabla `users`.

### La segunda pregunta clave

> `"roles": []` y `"permissions": []`. ¿Este usuario puede hacer algo?

**No.** Está **autenticado** pero no está **autorizado**. Son dos cosas distintas, y el siguiente paso lo demuestra.

---

## Paso 6 · Chocar contra el 403

En Swagger, **`GET /roles`** → **Try it out** → en `organizationId` pegar:

```
636a6008-f2eb-46f3-8c71-ab116e05c2a9
```

→ **Execute**:

```
403 Forbidden
{ "error": { "code": "FORBIDDEN", "message": "Missing permissions: roles.read" } }
```

### La diapositiva que resume todo

| | Significa | Quién lo produce |
|---|---|---|
| **401** Unauthorized | *No sé quién eres.* | middleware `auth` |
| **403** Forbidden | *Sé perfectamente quién eres, pero no puedes.* | middleware `access` |

> Fíjense en la ironía del estándar HTTP: el que se llama "Unauthorized" (401) es en realidad el de **autenticación**. El de autorización es el 403. Es un error de nombre que arrastramos desde 1997.

---

## Paso 7 · Dar el rol, sin volver a entrar

El docente ejecuta:

```bash
yarn asignar-rol --email futbolista@canchago.local --rol futbolista
```

Vuelvan a Swagger y ejecuten **`GET /auth/session`** otra vez, **con la misma cookie y sin cerrar sesión**:

```json
"roles": [{ "code": "futbolista", "name": "Futbolista" }],
"permissions": []
```

El rol aparece **al instante**.

### ¿Por qué funciona sin re-login?

Porque la cookie **no lleva al usuario dentro**: sólo lleva un **identificador de sesión** (unos 430 bytes). El usuario, sus roles y sus permisos se leen **de la base de datos en cada petición**.

> **Pregunta para la clase:** ¿qué cuesta esto? Una consulta a la base en cada petición. Si el usuario viviera dentro de la cookie, no haría falta ninguna consulta… pero entonces el rol recién concedido **no aparecería hasta el siguiente login**. Es el intercambio entre sesiones **sin estado** y **con estado**. No hay almuerzo gratis.

> El rol **Futbolista** es **global**: un futbolista puede jugar en cualquier organización. El **Gestor de Cancha**, en cambio, va atado a la suya.

Tiene el rol, pero sigue sin permisos: `GET /roles` **sigue dando 403**. **Tener un rol no es tener un permiso.**

---

## Paso 8 · Cerrar sesión

**`POST /auth/logout`** → **Execute** → `204 No Content`.

En la respuesta, mirar la cabecera:

```
Set-Cookie: canchago_session=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT
```

Así se borra una cookie: se reescribe vacía y con fecha de expiración en el pasado (1 de enero de 1970, el inicio del tiempo Unix).

Ejecutar **`GET /auth/session`** de nuevo → **`401`**. Sesión cerrada.

---

## Paso 9 · Comprobar que el logout cierra de verdad

Este paso es el que separa una clase de autenticación de una clase de **seguridad**.

Cerrar sesión **no puede ser sólo borrar la cookie del navegador**. Si lo fuera, cualquiera que hubiese copiado ese valor seguiría entrando. Vamos a comprobar que aquí no pasa.

Repitan el ejercicio, pero **antes** de cerrar sesión copien el valor de la cookie (DevTools → Application → Cookies → `canchago_session`).

Cierren sesión (`POST /auth/logout` → `204`). Y ahora, desde una terminal, reenvíen a mano esa cookie:

```bash
curl -i http://localhost:3000/api/auth/session \
  -H "Cookie: canchago_session=<el-valor-que-copiaron>"
```

```
401 Unauthorized
{ "error": { "code": "UNAUTHORIZED", "message": "Session revoked or expired" } }
```

### Lo interesante es *por qué* falla

La cookie **sigue siendo criptográficamente válida**: el sello de `@hapi/iron` no ha caducado y el servidor puede descifrarla sin problema. Lo que ocurre es que, al descifrarla, encuentra un identificador de sesión que en la tabla `user_sessions` está **marcado como revocado**.

El logout hace tres cosas, y sólo la segunda cierra la puerta de verdad:

1. Revoca el refresh token en Keycloak.
2. **Marca la sesión como revocada en la base de datos.**
3. Borra la cookie del navegador.

### Para debatir

- ¿Qué habría pasado si la sesión viviera **entera dentro de la cookie**? *(Que el logout sería sólo cosmético: la cookie copiada seguiría valiendo hasta expirar. Es exactamente el fallo que tenía este backend antes de arreglarlo.)*
- ¿Qué cuesta poder revocar? *(Una consulta a la base en cada petición.)*
- ¿De qué sirve el `HttpOnly` si el atacante consiguió la cookie por otra vía (una extensión maliciosa, un equipo compartido, un backup)? *(De poco. Por eso hace falta poder revocar.)*
- Abran `yarn prisma-studio` → tabla `user_sessions`. Verán su sesión, con su `revoked_at` puesto.

---

## Anexo · Dos bugs reales que salieron montando esta práctica

Valen como lección, porque no son ejercicios inventados:

**1. El login funcionaba con `curl` y fallaba en Chrome.** La cookie llevaba dentro los tres tokens de Keycloak y pesaba **5.336 bytes**. El límite del navegador es **4.096**, y Chrome descarta la cookie **en silencio**: sin error, sin aviso, sin nada en la consola. `curl` no aplica ese límite, así que las pruebas por terminal pasaban. Se arregló sacando los tokens a la tabla `user_sessions`: la cookie bajó a **429 bytes**.

> **Moraleja:** que pase en `curl` no significa que funcione en un navegador.

**2. La documentación mentía.** Decía "para iniciar sesión, pulsa Execute". Imposible: el login es un `302` a otro origen y el navegador lo bloquea por CORS. Nadie lo había probado nunca desde el navegador.

---

## Resumen de una frase

**Autenticación** es la cookie que te dan al entrar. **Autorización** es lo que esa cookie te deja hacer. Y **cerrar sesión** significa que el servidor la olvide — no que el navegador la tire a la basura.
