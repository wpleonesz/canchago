# 016 · Registro Público de Usuarios

**Estado:** propuesta

## Qué hace

Añade el **único** punto de entrada donde alguien sin sesión puede crear su propia cuenta en Canchago — hoy no existe ninguno: el proveedor OAuth (Keycloak) tiene `registrationAllowed: false` y la única forma de crear un usuario es que un administrador lo haga por back-office (feature `003`) o que alguien inicie sesión por primera vez con una cuenta YA creada en Keycloak (`findOrSyncByOAuth`, feature `002`).

El registro público:

1. **`POST /api/auth/register`** (nuevo, sin autenticación previa). Recibe `email`, `password`, `firstName`, `lastName`, y `accountType: 'futbolista' | 'gestor-de-cancha'`.
2. Crea la identidad real en **Keycloak** (no en un password local de Canchago) usando la API de administración de Keycloak — la contraseña nunca se guarda en la base de Canchago (`User.passwordHash` sigue sin usarse, igual que hoy).
3. Crea el `User`/`UserProfile`/`AuthAccount` en Canchago, igual que ya hace `findOrSyncByOAuth`, pero de forma síncrona en el mismo request (no en el primer login posterior).
4. Según `accountType`:
   - **`futbolista`** — se le asigna de inmediato el rol global `Futbolista`. Puede iniciar sesión y usar la app de inmediato, sin ningún paso adicional.
   - **`gestor-de-cancha`** — el body incluye además los datos de una `Organization` nueva y al menos una `Venue`. Se crean ambas en estado **`PENDING_APPROVAL`** (nuevo valor de `status`, ver más abajo) y se registra una **solicitud de acceso** (`OrganizationAccessRequest`, nuevo modelo) vinculando al usuario con esa organización. **No se le asigna ningún rol todavía** — el usuario puede iniciar sesión pero no tiene ningún permiso hasta que un Administrador apruebe la solicitud.
5. **`GET /api/organizaciones/access-requests`** (nuevo, `organizaciones.manage`) — lista paginada de solicitudes pendientes, para que un Administrador las revise.
6. **`POST /api/organizaciones/access-requests/{requestId}/approve`** (nuevo, `organizaciones.manage`) — aprueba: pone la `Organization` y sus `Venue` en `status: 'ACTIVE'`, crea el `UserRole` (`Gestor de Cancha`, con el alcance de esa organización) para el usuario solicitante, y marca la solicitud como `APPROVED`.
7. **`POST /api/organizaciones/access-requests/{requestId}/reject`** (nuevo, `organizaciones.manage`) — marca la solicitud como `REJECTED` (deja la organización/sedes en `PENDING_APPROVAL`, soft-eliminables después por un admin si se decide no seguir).

## Por qué

Canchago será una aplicación pública descargable — cualquier deportista o dueño de cancha debe poder crear su propia cuenta sin depender de que un administrador se la cree manualmente. Hoy eso es imposible: la única vía de creación de cuentas es back-office (`003`) o un primer login contra una cuenta que ya existe en Keycloak (que nadie externo puede crear, porque `registrationAllowed: false`).

El caso "Gestor de Cancha" es distinto del caso "Futbolista" porque implica **crear una organización real dentro de la plataforma multi-tenant** — sin control, cualquiera podría reclamar administrar un negocio ajeno con solo escribir su nombre. De ahí la aprobación manual: se decidió explícitamente (con el usuario, en esta conversación) que el registro de gestor **nunca** otorga acceso real hasta que un Administrador lo revise.

## Contrato de API nuevo

### `POST /api/auth/register`

Sin autenticación. Body:
```ts
{
  email: string;              // único en Keycloak y en Canchago
  password: string;           // política de contraseña de Keycloak (longitud mínima del realm)
  firstName: string;
  lastName: string;
  accountType: 'futbolista' | 'gestor-de-cancha';
  // Solo si accountType === 'gestor-de-cancha':
  organization?: { name: string; legalName?: string; taxIdentification?: string; email?: string; phone?: string; domain?: string };
  venue?: { name: string; address?: string; phone?: string; email?: string };
}
```

Respuestas:
- `201` — `futbolista`: `{ data: { id, email, firstName, lastName, accountType: 'futbolista' } }`. `gestor-de-cancha`: `{ data: { id, email, firstName, lastName, accountType: 'gestor-de-cancha', accessRequestId, organizationStatus: 'PENDING_APPROVAL' } }`.
- `400` — `organization`/`venue` faltantes cuando `accountType === 'gestor-de-cancha'`, o campos con formato inválido.
- `409` — email ya existe en Keycloak o en Canchago.
- `422` — la contraseña no cumple la política del realm de Keycloak (longitud mínima; Keycloak la valida al crear el usuario, el error se traduce a un mensaje genérico, nunca el texto crudo de Keycloak).
- `429` — límite de intentos de registro excedido (ver "Rate limiting" abajo).
- `500` — fallo al crear en Keycloak o en Canchago (ver "Consistencia" abajo).

### `GET /api/organizaciones/access-requests`

Requiere `organizaciones.manage`. Query: `page`, `pageSize`, `status?` (`PENDING`|`APPROVED`|`REJECTED`, default `PENDING`). Responde `{ data: OrganizationAccessRequest[], meta }`, cada elemento con la organización, la(s) sede(s) creadas y los datos del usuario solicitante (id, email, nombre — nunca contraseña ni tokens).

### `POST /api/organizaciones/access-requests/{requestId}/approve`

Requiere `organizaciones.manage`. Sin body. `200 { data: { organizationId, status: 'ACTIVE' } }`. `404` si no existe. `409` si ya fue revisada (aprobada o rechazada).

### `POST /api/organizaciones/access-requests/{requestId}/reject`

Requiere `organizaciones.manage`. Body opcional `{ reason?: string }`. `200 { data: { requestId, status: 'REJECTED' } }`. Mismos `404`/`409` que approve.

## Criterios de aceptación

**Registro — Futbolista**
- Un registro válido con `accountType: 'futbolista'` crea exactamente un usuario en Keycloak y exactamente un `User`/`UserProfile`/`AuthAccount` en Canchago, con el rol global `Futbolista` ya asignado.
- Ese usuario puede iniciar sesión inmediatamente después (web u OAuth móvil) sin ningún paso adicional, y `/api/auth/session` refleja el rol `Futbolista`.

**Registro — Gestor de Cancha**
- Un registro válido con `accountType: 'gestor-de-cancha'` crea el usuario (Keycloak + Canchago), la `Organization` y al menos una `Venue` en `status: 'PENDING_APPROVAL'`, y una fila en `OrganizationAccessRequest` con `status: 'PENDING'` — pero **ningún** `UserRole` para ese usuario.
- Ese usuario puede iniciar sesión (tiene cuenta real), pero `/api/auth/session` no le devuelve ningún rol ni permiso, y ningún endpoint protegido por permisos de organización le concede acceso.
- La organización en `PENDING_APPROVAL` no aparece en ningún listado ni funcionalidad pensada para organizaciones ya operativas más allá de la propia cola de solicitudes (`GET /api/organizaciones/access-requests`) — no se decide aquí si `GET /api/organizaciones` (uso admin existente) debe excluir las pendientes; se registra como decisión explícita en "Decisiones" de `plan.md`.

**Aprobación / rechazo**
- Aprobar una solicitud pendiente dentro de una transacción: pone `Organization.status` y el de sus `Venue` en `'ACTIVE'`, crea el `UserRole` (`Gestor de Cancha`, `organizationId` de esa organización) para el usuario solicitante, y marca la solicitud `APPROVED` — todo o nada.
- Tras la aprobación, el usuario solicitante ve el rol y los permisos de `Gestor de Cancha` en su próxima petición (sin relogin, gracias al mecanismo ya existente de la feature `009`).
- Rechazar una solicitud pendiente la marca `REJECTED`; la organización/sede permanecen en `PENDING_APPROVAL` (no se activan ni se borran automáticamente); no se crea ningún `UserRole`.
- Aprobar o rechazar una solicitud que ya fue revisada responde `409`, sin duplicar ni sobrescribir la revisión anterior.
- Solo un usuario con `organizaciones.manage` puede aprobar/rechazar/listar solicitudes; cualquier otro recibe `403`.

**Seguridad y validación**
- La contraseña nunca se registra en logs, nunca se guarda en la base de Canchago, y viaja solo hacia Keycloak (HTTPS en cualquier entorno real).
- El email se valida como único tanto en Keycloak como en Canchago antes de crear nada; un duplicado en cualquiera de los dos responde `409` sin crear una cuenta a medias.
- El endpoint de registro tiene un límite de tasa (rate limiting) por IP y por email, usando `rate-limiter-flexible` (dependencia ya instalada, hoy sin usar en ningún endpoint) — excederlo responde `429`.
- La asignación de roles durante el registro (`Futbolista` inmediato, `Gestor de Cancha` tras aprobación) se hace en la capa de base de datos directamente, **sin pasar por `assertCanAssignRoles`** (ese guardia — feature `015` — está diseñado para un actor HTTP autenticado asignando roles a otro usuario; el registro no tiene ese actor todavía). Se documenta explícitamente en `plan.md` por qué este bypass es seguro: los roles que puede obtener el propio flujo de registro están fijados en el código (nunca vienen del body de la petición), así que no hay ninguna superficie para que el cliente pida un rol arbitrario.
- Ningún endpoint nuevo expone `passwordHash`, tokens de Keycloak, ni el secreto del nuevo cliente de servicio.

**Consistencia ante fallos**
- Si la creación en Keycloak tiene éxito pero la transacción en Canchago falla, el backend intenta revertir (eliminar el usuario recién creado en Keycloak) antes de responder `500`; si esa reversión también falla, se registra en logs con toda la información necesaria para limpieza manual (sin loguear la contraseña).

### Documentación (obligatorio)

- [ ] `POST /api/auth/register` registrado en `documentation/schemas/auth.ts` (mismo archivo que el resto de endpoints de auth) vía `registry.registerPath()`, con ejemplos separados para `futbolista` y `gestor-de-cancha`.
- [ ] `GET /api/organizaciones/access-requests`, `POST .../approve`, `POST .../reject` registrados en `documentation/schemas/organizaciones-sedes.ts` (o un nuevo archivo `access-requests.ts` si el existente crece demasiado).
- [ ] Todos los schemas Zod nuevos registrados con `registry.registerComponent()`.
- [ ] Visibles y correctos en `GET /api/docs`.

## Fuera de alcance

- **Verificación de email** — no existe infraestructura de envío de correo en este proyecto hoy (`workers/email.worker.ts` está referenciado en `package.json` pero el archivo no existe; `nodemailer`/`handlebars` están instalados pero sin usar). Se crea el usuario en Keycloak con `emailVerified: false` mostrando el estado real, pero no se bloquea el login por esto — construir el envío de verificación es una feature aparte con su propia infraestructura.
- **CAPTCHA / protección anti-bot avanzada** — el rate limiting por IP/email es la única mitigación de esta feature. Un CAPTCHA (reCAPTCHA/hCaptcha) requiere una dependencia y credenciales nuevas; se deja como mejora futura recomendada, no como requisito de esta feature.
- **Registro vía la página nativa de Keycloak** (`registrationAllowed: true`) — se descartó explícitamente a favor de un formulario propio dentro de la app; el realm sigue con `registrationAllowed: false`.
- **CRUD completo de organizaciones/sedes** — esta feature solo crea una organización/sede en estado pendiente como efecto secundario del registro, y las activa al aprobar. El CRUD completo (editar, desactivar, gestionar múltiples sedes) sigue siendo la feature `004-gestion-organizaciones-sedes`, ya existente, sin cambios.
- **Notificaciones al Administrador** (email/push) cuando llega una solicitud nueva — sin infraestructura de notificaciones hoy; el admin debe consultar `GET /api/organizaciones/access-requests` activamente.
- **Reversión completa de una organización rechazada** (borrarla) — el rechazo solo cambia el estado de la solicitud; borrar la organización/sede pendiente, si se decide, es una acción manual posterior con el endpoint `DELETE` ya existente de `004`.
- **Cambiar el flujo de login/sesión existente** — el registro solo crea la cuenta; el login sigue siendo exactamente el mismo (OAuth web, ROPC móvil).
