# 017 · Perfil ampliado y autogestión — Plan

## Enfoque

Extender `UserProfile` y el módulo `users` existente. El perfil textual usa JSON estricto y la fotografía un endpoint separado para mantener límites claros. Se incorpora `sharp` como única dependencia nueva porque validar solo extensión/MIME/firma no impide imágenes corruptas o polyglot; decodificar y recodificar elimina el contenido original y sus metadatos.

## Implementación

1. **Prisma** — Añadir a `UserProfile` las columnas nullable `phone varchar(16)`, `avatarData Bytes`, `avatarMimeType varchar(30)`, `avatarUpdatedAt timestamptz`, `facebookUrl`, `instagramUrl`, `linkedinUrl`, `xUrl`, `githubUrl`, `tiktokUrl`, `websiteUrl` (`varchar(500)`).
2. **Migración** — Crear una migración aditiva, nullable y sin defaults obligatorios. Antes, resolver/aplicar de forma segura la migración pendiente `20260821000000_add_user_roles_lookup_index`; no modificar migraciones aplicadas.
3. **Dependencia `sharp`** — Decodificar JPEG/PNG/WebP, limitar píxeles/dimensiones, autorrotar, eliminar metadata y producir WebP máximo 1024×1024.
4. **`validations/users/index.ts`** — Schemas estrictos para PATCH propio y PUT avatar; E.164, HTTPS, dominios permitidos, base64 y tamaño previo a decodificación.
5. **`database/users/index.ts`** — Select/update mínimo por `req.user.id`; compare-and-update con `profileUpdatedAt`; escritura/eliminación atómica de avatar.
6. **`services/users/index.ts`** — Normalizar vacíos a null, URLs con `URL`, procesar imagen, mapear DTO sin bytes y controlar conflictos.
7. **`pages/api/profile/index.ts`** — GET/PATCH autenticados, sin `access()` adicional porque todo usuario modifica solo su propio recurso.
8. **`pages/api/profile/avatar.ts`** — GET/PUT/DELETE autenticados; body limit 3 MiB, headers seguros, sin rutas de filesystem.
9. **Sesión** — No incluir bytes ni URLs sociales en `SessionUser`; opcionalmente añadir `avatarUpdatedAt` para invalidación, solo si evita una consulta duplicada sin agrandar materialmente la sesión.
10. **OpenAPI** — Extender `documentation/schemas/users.ts` con DTO, PATCH, avatar y respuestas 413/415/422.
11. **Pruebas** — Migración retrocompatible, schemas, dominios, mass assignment, IDOR, concurrencia, magic bytes, archivos corruptos/polyglot, transformación WebP, límites, eliminación y respuestas sin secretos.

## Decisiones

- **Bytes WebP en PostgreSQL** — No existe storage; evita path traversal, sobrescritura y huérfanos. Se acepta el costo de DB con límite de 2 MiB de entrada y salida reescalada.
- **Columnas fijas para redes** — El conjunto solicitado es cerrado y solo admite un enlace por plataforma; evita una tabla/CRUD paralelo innecesario.
- **Endpoint propio sin userId** — La sesión define la propiedad y elimina IDOR por diseño.
- **Avatar separado del PATCH textual** — Evita payloads grandes en operaciones normales y permite headers/caché correctos.

## Riesgos

- **Migración pendiente** — Prisma reporta `20260821000000_add_user_roles_lookup_index` sin aplicar; debe reconciliarse antes de generar la nueva migración.
- **Tamaño de base** — Mitigar con reescalado, WebP, límite y sin conservar original.
- **Bombas de imagen** — Configurar límites de píxeles y memoria en `sharp`; rechazar antes de persistir.
- **URLs maliciosas** — Solo HTTPS, dominios exactos/subdominios oficiales y apertura cliente con protección externa.
