# Canchago — API backend

Canchago es el backend REST de una plataforma SaaS multiempresa para gestionar organizaciones, sedes, usuarios, roles y permisos de espacios deportivos. El cliente oficial está en [`canchago-ionic`](../canchago-ionic/README.md).

> Estado actual: la API implementa identidad, autenticación y RBAC. El dominio de recursos reservables y reservas todavía no existe. La fuente funcional es [`spec/`](spec/README.md).

## Arquitectura

```text
canchago-ionic / cliente HTTP
           │ REST / JSON
           ▼
Next.js 16 (Pages Router, pages/api)
           │ next-connect + auth/acceso
           ▼
services/ → database/ → Prisma 7 → PostgreSQL
                  │
                  └── Keycloak 26 (OAuth 2.0 / OIDC)
```

Es un monolito modular exclusivamente de API. Las rutas coordinan middlewares y servicios; las reglas viven en `services/`; las consultas se encapsulan en `database/`; Prisma usa una única instancia en `database/client.ts`. OpenAPI se sirve en `/api/docs`.

Stack verificado: Node.js ≥22, Next.js 16.2.9, TypeScript, `next-connect`, Prisma 7.8, PostgreSQL, Zod 4, Keycloak 26, Pino y Vitest. El manifiesto también incluye BullMQ, Redis/ioredis y herramientas de correo/reportes, pero actualmente no hay workers ni configuración Redis/SMTP ejecutable; no son requisitos para levantar la API existente.

## Requisitos previos

- Git.
- Node.js 22 o posterior, límite declarado en `package.json`.
- Corepack y Yarn. El proyecto usa `yarn.lock` y Yarn Berry con enlace `node-modules`; no use npm ni pnpm.
- PostgreSQL accesible mediante una URL. El repositorio no fija versión ni lo instala con Docker.
- Docker con Docker Compose v2 para Keycloak.

Compruebe las instalaciones:

```bash
git --version
node --version       # v22 o superior
corepack --version
yarn --version
psql --version       # si usa PostgreSQL desde terminal
docker --version
docker compose version
```

Si `yarn` no existe, ejecute `corepack enable` y vuelva a abrir la terminal. Docker Desktop sirve en macOS/Windows; en Linux puede usarse Docker Engine con Compose. PostgreSQL puede ser local o remoto si el usuario puede crear tablas y ejecutar migraciones.

## Instalación inicial

### 1. Obtener el repositorio

```bash
git clone <URL-DEL-REPOSITORIO-CANCHAGO>
cd canchago
```

Si ya recibió la carpeta, entre en ella. Los comandos siguientes se ejecutan desde `canchago/`.

### 2. Instalar dependencias

```bash
yarn install
yarn generate
yarn typecheck
```

`install` restaura el lockfile; `generate` crea Prisma Client desde `prisma/schema.prisma`; `typecheck` comprueba la instalación TypeScript.

### 3. Crear PostgreSQL

`docker-compose.yml` solo contiene Keycloak. Cree una base, usuario y contraseña de desarrollo mediante `psql`, pgAdmin o el servicio institucional. Si su usuario local tiene permiso:

```bash
createdb canchago
psql 'postgresql://USUARIO:CONTRASENA@localhost:5432/canchago?schema=public' -c 'select 1;'
```

No cree otra base si ya existe ni aplique estos pasos sobre producción. Solicite una URL aislada si trabaja con un servidor compartido.

### 4. Configurar `.env`

```bash
cp .env.example .env
```

`.env` está ignorado por Git. Ajuste:

- `DATABASE_URL`: conexión PostgreSQL.
- `SESSION_SECRET`: valor aleatorio de 32 caracteres como mínimo.
- URL `OAUTH_*`: la plantilla corresponde a Keycloak local en `localhost:8081`.
- `OAUTH_CLIENT_SECRET`: el valor de plantilla es solo del realm didáctico; cámbielo fuera del laboratorio.

`lib/config/env.ts` exige base de datos, `APP_BASE_URL`, proveedor, URLs/clientes OAuth, `OAUTH_MOBILE_CLIENT_ID` y secreto de sesión. Revocación, JWKS, logout, clave pública, rotación del secreto y dominio de cookie son opcionales. Los scopes y tiempos tienen valores predeterminados.

Mantenga `BYPASS_AUTH=false` y `BYPASS_ACCESS_CONTROL=false` para probar seguridad real. Solo operan fuera de producción y no reemplazan Keycloak.

### 5. Iniciar Keycloak

```bash
docker compose up -d
docker compose ps
curl -I http://localhost:8081/realms/canchago
```

Compose inicia Keycloak 26, publica el puerto 8081 e importa `keycloak/realm-canchago.json`. Espere el estado saludable. El realm contiene clientes y cuentas didácticas: `futbolista`, `gestor` y `administrador`, con contraseña pública de laboratorio `canchago123`. Nunca reutilice esas credenciales ni despliegue el realm sin cambiarlas.

Keycloak importa el JSON al crear el contenedor, no en cada inicio. Si modifica el realm y trabaja en un laboratorio desechable:

```bash
docker compose down
docker compose up -d
```

### 6. Migrar y sembrar

```bash
yarn migrate-dev
yarn seed
yarn seed-dev
```

- `migrate-dev` aplica migraciones existentes en desarrollo y puede crear una si cambió el schema.
- `seed` crea el catálogo de permisos.
- `seed-dev` crea los roles Futbolista, Administrador y Gestor de Cancha, una organización demo si hace falta, y concede permisos al Administrador.

En despliegues use `yarn migrate-deploy`, que solo aplica migraciones versionadas. No sustituya migraciones por `prisma db push`.

```bash
yarn prisma migrate status
yarn prisma-studio
```

El segundo comando abre un explorador local; ciérrelo con `Ctrl+C`. Prisma no crea contraseñas: viven en Keycloak.

## Ejecutar y verificar

```bash
yarn dev
```

Next.js escucha por defecto en `http://localhost:3000`. Mantenga esa terminal abierta y compruebe desde otra:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/docs/spec
```

Debe responder `200`. Swagger UI está en `http://localhost:3000/api/docs`; un `401` en una ruta protegida sin sesión es correcto. Detenga Next.js con `Ctrl+C`. Use `docker compose stop`/`start` para detener/reanudar Keycloak sin recrearlo.

### Autenticación real

- Navegador: `GET /api/auth/login` usa Authorization Code + OIDC + PKCE y una cookie `HttpOnly` cifrada.
- Capacitor: `POST /api/auth/mobile/login` usa `canchago-mobile`, devuelve una sesión Bearer y el cliente la guarda en almacenamiento nativo seguro.

El flujo móvil usa Resource Owner Password Credentials por decisión explícita de su feature. Es una excepción del laboratorio que contradice una prohibición antigua aún presente en parte de la constitución; requiere revisión antes de producción.

## Backend y frontend juntos

Ubique ambos como carpetas hermanas:

```text
proyectos/
├── canchago/
└── canchago-ionic/
```

```bash
# Terminal 1, canchago/
docker compose up -d
yarn dev

# Terminal 2, canchago-ionic/
yarn dev
```

En navegador, Vite reenvía `/api` desde 5173 hacia 3000, conservando el flujo de cookie. Android/iOS usan URL absoluta y Bearer. Consulte el [README móvil](../canchago-ionic/README.md) para emuladores y dispositivos.

## Flujo diario

Después del setup: `docker compose up -d` y `yarn dev`. Tras cambiar Prisma, use `yarn migrate-dev` y `yarn generate`. Antes de integrar:

```bash
yarn lint
yarn typecheck
yarn test
yarn build
```

El proyecto es spec-driven: lea `spec/constitution/` y la feature antes de cambiar código. Cada endpoint nuevo debe registrarse también en OpenAPI.

## Estructura

| Ruta | Responsabilidad |
|---|---|
| `pages/api/` | Rutas REST y middlewares |
| `middleware/` | Autenticación y autorización |
| `services/` | Reglas de negocio |
| `database/` | Acceso mediante Prisma |
| `prisma/` | Schema, migraciones y seeds |
| `documentation/` | Registro OpenAPI |
| `keycloak/` | Realm local |
| `spec/` | Constitución y contratos |
| `tests/` | Pruebas unitarias e integración |

## Comandos

| Comando | Función |
|---|---|
| `yarn dev` | Next.js con recarga |
| `yarn build` / `yarn start` | Construir / servir producción |
| `yarn lint` / `yarn lint:fix` | Comprobar / corregir ESLint |
| `yarn format` / `yarn format:check` | Escribir / comprobar Prettier |
| `yarn typecheck` | Validar TypeScript |
| `yarn test` / `yarn test:watch` | Vitest una vez / observación |
| `yarn generate` | Generar Prisma Client |
| `yarn migrate-dev` / `yarn migrate-deploy` | Migrar desarrollo / despliegue |
| `yarn seed` / `yarn seed-dev` | Permisos / roles demo |
| `yarn asignar-rol --email <correo> --rol <codigo>` | Asignar un rol existente a un usuario sincronizado |
| `yarn prisma-studio` | Explorar la base |

Los scripts `worker:email`, `worker:notification` y `worker:report` están declarados, pero no existen sus archivos `workers/*.ts`; actualmente no son operativos.

## Solución de problemas

### Variables inválidas

Confirme que creó `.env`, que el secreto tiene ≥32 caracteres y que las URL incluyen protocolo. Compare nombres con `.env.example` sin editar la plantilla.

### Prisma `P1000`/`P1001`

PostgreSQL no está iniciado, no es accesible o `DATABASE_URL` es incorrecta. Pruebe la misma URL con `psql ... -c 'select 1;'`.

### Faltan tablas

Ejecute `yarn prisma migrate status`; use `yarn migrate-dev` en desarrollo o `yarn migrate-deploy` en despliegue.

### Login falla

Revise `docker compose ps` y el realm con `curl -I`. Las URL externas usan 8081; dentro del contenedor Keycloak usa 8080.

### Respuesta 403

La sesión existe pero falta permiso/alcance. Ejecute `yarn seed` y luego `yarn seed-dev`; no active bypass para ocultarlo.

### Puerto ocupado

Use `lsof -i :3000` o `lsof -i :8081` y detenga la instancia previa. Cambiar puertos exige actualizar URLs, redirecciones, realm, proxy y configuración móvil.

### Yarn incorrecto o nuevos lockfiles

Ejecute `corepack enable` y use solo Yarn. No mezcle npm/pnpm.

### El frontend no conecta

Pruebe primero `/api/docs/spec` directamente en 3000; luego revise proxy o URL absoluta según plataforma. No combine cookies con CORS comodín como atajo.

## Seguridad y límites

- Nunca versionar `.env`, tokens, claves ni credenciales reales.
- Las credenciales del realm son datos públicos de laboratorio.
- PostgreSQL se administra fuera de Compose.
- No hay almacenamiento de archivos, Redis, colas ni workers activos en el arranque actual.
- Para cambios de código prevalecen `AGENTS.md` y `spec/constitution/`.
