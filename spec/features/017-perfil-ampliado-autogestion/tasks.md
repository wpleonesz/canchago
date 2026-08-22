# 017 · Perfil ampliado y autogestión — Tareas

- [x] Resolver/aplicar de forma segura la migración pendiente sin modificar historial aplicado.
- [x] Extender `UserProfile` con columnas opcionales y crear migración aditiva.
- [x] Instalar `sharp` y encapsular transformación segura de imágenes.
- [x] Añadir schemas estrictos de perfil propio y avatar.
- [x] Extender database y service de usuarios sin aceptar objetos de payload directamente.
- [x] Implementar GET/PATCH `/api/profile` usando exclusivamente `req.user.id`.
- [x] Implementar GET/PUT/DELETE `/api/profile/avatar` con límites y headers seguros.
- [x] Añadir pruebas de E.164, URL/domino, vacíos, mass assignment e IDOR.
- [x] Añadir pruebas de MIME real, firma, decodificación, polyglot, límite y WebP resultante.
- [x] Probar migración con perfiles existentes y valores null.

## Documentación Swagger (obligatorio)

- [x] Registrar schemas y endpoints en `documentation/schemas/users.ts`.
- [x] Documentar seguridad, límites, headers y 400/401/409/413/415/422/500.
- [x] Mantener export desde `documentation/schemas/index.ts`.
- [ ] Verificar `GET /api/docs`.

## Cierre

- [x] Validar criterios de aceptación.
- [ ] `yarn lint && yarn typecheck && yarn test && yarn build`.
- [x] Actualizar roadmap backend.

## Mantenimiento (checklist recurrente)

- [ ] Revisar tamaño acumulado de avatares antes de elevar límites o migrar a object storage.
