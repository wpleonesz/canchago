# 017 · Perfil ampliado y autogestión

**Estado:** propuesta

## Qué hace

Permite que cualquier usuario autenticado consulte y complete su propio perfil con datos opcionales: número celular, fotografía y enlaces de Facebook, Instagram, LinkedIn, X/Twitter, GitHub, TikTok y un sitio adicional. Los usuarios existentes siguen funcionando con todos esos campos vacíos.

La fotografía puede cargarse, reemplazarse y eliminarse. El servidor acepta únicamente JPEG, PNG o WebP, valida el contenido real, lo decodifica y vuelve a codificar como WebP seguro antes de persistirlo. Cuando no existe fotografía, el cliente conserva el avatar actual de iniciales mediante un recurso predeterminado local.

La autogestión modifica exclusivamente el `UserProfile` del usuario resuelto por la sesión. No acepta IDs, email, username, estado, identificación, roles, permisos, credenciales ni atributos administrativos.

## Por qué

Actualmente `UserProfile` solo contiene nombres e identificación, el endpoint de perfil es exclusivamente administrativo y `ProfileSummary` representa al usuario mediante iniciales. No existe almacenamiento ni procesamiento seguro de imágenes. Esta feature completa el perfil sin mezclar identidad o RBAC y crea un contrato propio seguro para el usuario autenticado.

## Criterios de aceptación

- [ ] `UserProfile` incorpora columnas nullable para `phone`, fotografía WebP normalizada y las siete URLs; la migración conserva todos los registros existentes.
- [ ] `GET /api/profile` devuelve únicamente los datos de perfil del usuario autenticado y nunca secretos/RBAC.
- [ ] `PATCH /api/profile` actualiza parcialmente solo celular y URLs; `null` o cadena vacía normalizada elimina un valor opcional.
- [ ] El celular vacío es válido; si existe, usa formato internacional E.164 (`+` y 8–15 dígitos).
- [ ] Las redes admiten solo URL HTTPS; cada red valida su dominio oficial y `websiteUrl` admite cualquier host HTTPS válido.
- [ ] `PUT /api/profile/avatar` acepta como máximo 2 MiB de imagen codificada, rechaza claves extra y formatos distintos de JPEG/PNG/WebP.
- [ ] La imagen se valida por firma y decodificación real, se reescala a máximo 1024×1024, elimina metadatos y se recodifica a WebP antes de guardarse.
- [ ] `GET /api/profile/avatar` sirve exclusivamente bytes WebP con `Content-Type: image/webp`, `X-Content-Type-Options: nosniff` y cache privada condicionada por versión.
- [ ] `DELETE /api/profile/avatar` elimina fotografía y MIME de forma atómica; repetirlo es idempotente.
- [ ] Ningún endpoint recibe un `userId`: la propiedad del recurso proviene únicamente de `req.user.id`, evitando IDOR.
- [ ] Un usuario no puede modificar el perfil de otro manipulando URL o payload; la edición administrativa existente sigue limitada a nombres.
- [ ] Errores 400/401/413/415/422/500 son normalizados y no exponen bytes, rutas, stack traces ni detalles del decodificador.
- [ ] OpenAPI documenta todos los contratos y límites.

### Documentación (obligatorio)

- [ ] Los endpoints se registran en `documentation/schemas/users.ts` mediante `registry.registerPath()`.
- [ ] Los schemas de entrada y salida se registran en el mismo archivo.
- [ ] El módulo continúa exportado desde `documentation/schemas/index.ts`.
- [ ] Los endpoints y schemas son visibles y correctos en `GET /api/docs`.

## Fuera de alcance

- Perfil público o búsqueda por redes sociales.
- Más de un enlace por plataforma, etiquetas personalizadas o una red social dinámica.
- Editar email, username, identificación, contraseña, estado, roles o permisos.
- Permitir SVG, GIF animado, documentos o archivos ejecutables.
- Almacenamiento S3/CDN. La primera versión guarda el WebP normalizado en PostgreSQL para evitar rutas y archivos huérfanos; migrarlo a object storage será otra feature.
