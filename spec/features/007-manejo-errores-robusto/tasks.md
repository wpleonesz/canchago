# 007 · Manejo Robusto de Errores — Tasks

_Checklist granular de tareas. Marca `[x]` al completar cada una._

## Fase 1: Estructura de Errores Mejorada

- [ ] Crear `errors/app-error.ts` con clase `AppError` que soporte `details: ErrorDetail[]`
- [ ] Crear interfaz `ErrorDetail` con campos `field`, `message`, `type`, `constraint`, `received`
- [ ] Crear `errors/validation-error.ts` extendiendo `AppError` para validaciones específicamente
- [ ] Actualizar `errors/auth.ts` para extender `AppError` (mantener compatibilidad)
- [ ] Actualizar `errors/not-found-error.ts` para extender `AppError`
- [ ] Verificar que `errors/conflict-error.ts` exista; si no, crearla extendiendo `AppError`
- [ ] Exportar todas las clases de error desde `errors/index.ts`

## Fase 2: Transformador de Zod

- [ ] Crear `lib/errors/zod-formatter.ts`
- [ ] Implementar `formatZodError(error: ZodError): ErrorDetail[]`
- [ ] Implementar `getConstraintName(issue: ZodIssue): string | undefined` para mapear constraints
- [ ] Escribir tests unitarios para `zod-formatter.test.ts`
  - [ ] Test: Zod error en email invalida devuelve `{ field: 'email', message: '...', type: 'invalid_type' }`
  - [ ] Test: Array anidado con campo faltante devuelve `{ field: 'items.0.name', message: '...' }`
  - [ ] Test: Error múltiples devuelve array con varios detalles

## Fase 3: Mensajes Localizados

- [ ] Crear `validations/schemas.ts` con objeto `VALIDATION_MESSAGES` con mensajes en español
- [ ] Incluir mensajes para: EMAIL, UUID, REQUIRED, MIN_LENGTH, MAX_LENGTH, ENUM, NUMBER, BOOLEAN, ARRAY
- [ ] Exportar desde `validations/index.ts`

## Fase 4: Actualizar Validaciones Existentes

- [ ] Actualizar `validations/users/index.ts`:
  - [ ] `createUserSchema` usa mensajes españoles para todos los validadores
  - [ ] `updateUserSchema` hereda de `createUserSchema.partial()`
  - [ ] `userQuerySchema` usa mensajes españoles
  - [ ] `userParamsSchema` usa mensajes españoles
- [ ] Verificar y actualizar otras validaciones en el proyecto (roles, organizations, etc.)

## Fase 5: Handler Global de Errores

- [ ] Actualizar `pages/api/_router.ts`:
  - [ ] Importar `formatZodError`, `ZodError`, `AppError`, logger (`pino`)
  - [ ] Implementar `handleError()` que:
    - [ ] Detecte `AppError` y serialice con `details` si existen
    - [ ] Capture `ZodError` directamente (fallback)
    - [ ] Registre en Pino con `requestId` y contexto
    - [ ] Nunca exponga stacktrace, SQL, Prisma al cliente
    - [ ] Devuelva `500` genérico para errores desconocidos
  - [ ] Assignar `routerOptions.onError = handleError`
- [ ] Tests: Verificar que `onError` produce respuestas con `details` para `ValidationError`

## Fase 6: Actualizar Endpoints Existentes

- [ ] En `pages/api/users/index.ts`:
  - [ ] Remover la lógica manual de `parsed.success` check
  - [ ] Reemplazar con llamada a `throwValidationError()` si falla (helper nuevo)
  - [ ] Validar que los errores lancen `ValidationError` con detalles
- [ ] Repetir para `pages/api/users/[userId].ts`
- [ ] Repetir para otros endpoints (roles, organizations, etc.)

## Fase 7: Helpers y Utilidades

- [ ] Crear `lib/errors/throw-validation-error.ts` con función:
  ```ts
  export const throwValidationError = (parseResult: SafeParseReturnType<...>) => {
    if (!parseResult.success) {
      throw new ValidationError(
        'Los datos enviados contienen errores de validación.',
        formatZodError(parseResult.error)
      );
    }
  };
  ```
- [ ] Documentar uso en README o en `spec/features/007/`

## Fase 8: Documentación OpenAPI

- [ ] Crear o actualizar `documentation/schemas/error-response.ts`:
  - [ ] Registrar esquema `ErrorResponse` con estructura `{ error: { code, message, details? } }`
  - [ ] Registrar esquema `ValidationErrorDetail` con estructura `ErrorDetail`
  - [ ] Usar `$ref` en endpoints que pueden fallar en validación
- [ ] Verificar que Swagger UI (`GET /api/docs`) muestre la estructura correcta

## Fase 9: Tests de Integración

- [ ] Crear `tests/integration/error-handling/validation.test.ts`:
  - [ ] Test: `POST /api/users` con email inválido devuelve `400` con `details` que incluye el campo fallido
  - [ ] Test: `POST /api/users` con múltiples campos inválidos devuelve array de detalles
  - [ ] Test: `POST /api/users` con payload válido devuelve `201` sin `details`
- [ ] Crear `tests/integration/error-handling/business-rules.test.ts`:
  - [ ] Test: `POST /api/users` con email duplicado devuelve `409` sin `details`
  - [ ] Test: `DELETE /api/users/:userId` con usuario inexistente devuelve `404` sin `details`
- [ ] Crear `tests/integration/error-handling/internal-errors.test.ts`:
  - [ ] Test: Error de base de datos no capturado devuelve `500` genérico sin stacktrace
  - [ ] Test: Validar que Pino registra el error completo internamente

## Fase 10: Verificación y Cleanup

- [ ] Ejecutar `yarn lint` y corregir estilos
- [ ] Ejecutar `yarn typecheck` y resolver tipos
- [ ] Ejecutar `yarn test` y verificar que todos los tests pasan
- [ ] Ejecutar `yarn build` y verificar que no hay errores
- [ ] Probar manualmente en dev:
  - [ ] `yarn dev` → prueba endpoint con payload inválido → verifica estructura de error
  - [ ] Verifica logs en Pino (no exponen detalles internos)
  - [ ] Verifica Swagger UI muestra el schema de error

## Fase 11: Actualización del Roadmap

- [ ] En `spec/constitution/roadmap.md`:
  - [ ] Mover **007 · Manejo Robusto de Errores** de "Siguiente 🔜" a "Hecho ✅"
  - [ ] Actualizar descripción de la feature en la sección completada
  - [ ] Si hay features en backlog que ahora sean candidatas a "Siguiente", promover la adecuada
