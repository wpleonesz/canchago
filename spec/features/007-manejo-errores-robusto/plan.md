# 007 · Manejo Robusto de Errores — Plan

_Cómo se implementa lo descrito en `spec.md`. Debe respetar la `constitution/`._

## Enfoque

Crear una capa centralizada de transformación de errores que convierta excepciones Zod, errores de aplicación y errores del sistema en respuestas HTTP consistentes y detalladas. Extender la clase base de errores para soportar detalles estructurados, mejorar el handler global de `next-connect` y proporcionar utilidades para limpiar/formatear errores de validación.

## Implementación

### 1. **`errors/app-error.ts`** — Clase base mejorada

Extender `AppError` con soporte para `details` estructurado:

```ts
export interface ErrorDetail {
	field?: string;
	message: string;
	type?: string;
	constraint?: string;
	received?: unknown;
}

export class AppError extends Error {
	public readonly statusCode: number;
	public readonly code: string;
	public readonly details?: ErrorDetail[];

	constructor(message: string, statusCode: number, code: string, details?: ErrorDetail[]) {
		super(message);
		this.name = new.target.name;
		this.statusCode = statusCode;
		this.code = code;
		this.details = details;
	}
}
```

### 2. **`errors/validation-error.ts`** — Específico para Zod

Nueva clase para validación con detalles Zod:

```ts
export class ValidationError extends AppError {
	constructor(message: string, details?: ErrorDetail[]) {
		super(message, 400, 'VALIDATION_ERROR', details);
	}
}
```

### 3. **`lib/errors/zod-formatter.ts`** — Transformador de Zod → ErrorDetail[]

Convertir `ZodError.issues` en un array de `ErrorDetail` consistente:

```ts
export const formatZodError = (error: ZodError): ErrorDetail[] => {
	return error.issues.map(issue => ({
		field: issue.path.join('.'),
		message: issue.message,
		type: issue.code, // 'invalid_type', 'too_small', 'invalid_enum_value', etc.
		constraint: getConstraintName(issue),
		received: issue.received,
	}));
};

const getConstraintName = (issue: ZodIssue): string | undefined => {
	if (issue.code === 'too_small') return `min_${issue.minimum}`;
	if (issue.code === 'too_big') return `max_${issue.maximum}`;
	if (issue.code === 'invalid_type') return `type_${issue.expected}`;
	if (issue.code === 'invalid_enum_value') return 'enum';
	return undefined;
};
```

### 4. **`pages/api/_router.ts`** — Handler global mejorado

Actualizar `routerOptions.onError` para:

- Detectar `AppError` y serializar el objeto completo con `details`.
- Capturar `ZodError` directamente (si llega sin ser atrapado en un endpoint).
- Registrar en Pino con contexto.
- Nunca exponer trazas Prisma ni SQL al cliente.

```ts
const handleError = (err: unknown, req: NextApiRequest, res: NextApiResponse) => {
	const requestId = req.headers['x-request-id'];

	if (err instanceof AppError) {
		logger.warn({ requestId, error: err.name, statusCode: err.statusCode }, err.message);

		res.status(err.statusCode).json({
			error: {
				code: err.code,
				message: err.message,
				...(err.details && { details: err.details }),
			},
		});
		return;
	}

	if (err instanceof ZodError) {
		const details = formatZodError(err);
		logger.warn({ requestId, fieldCount: details.length }, 'Validation failed');

		res.status(400).json({
			error: {
				code: 'VALIDATION_ERROR',
				message: 'Los datos enviados contienen errores de validación.',
				details,
			},
		});
		return;
	}

	// Error desconocido: loguear completo internamente, responder genérico al cliente
	logger.error({ requestId, stack: (err as Error)?.stack }, 'Unhandled error');

	res.status(500).json({
		error: {
			code: 'INTERNAL_ERROR',
			message: 'Error interno del servidor.',
		},
	});
};
```

### 5. **`validations/schemas.ts`** — Utilidades para mensajes localizados

Crear un archivo con mensajes de error predefinidos en español reutilizables en esquemas:

```ts
export const VALIDATION_MESSAGES = {
	EMAIL: 'Formato de correo electrónico inválido',
	UUID: 'Identificador único inválido (se esperaba UUID)',
	REQUIRED: 'El campo es requerido',
	MIN_LENGTH: (min: number) => `Mínimo ${min} caracteres`,
	MAX_LENGTH: (max: number) => `Máximo ${max} caracteres`,
	ENUM: 'Valor no permitido para este campo',
	NUMBER: 'Se esperaba un número',
	BOOLEAN: 'Se esperaba verdadero o falso',
	ARRAY: 'Se esperaba un array',
} as const;
```

### 6. **Actualizar validaciones existentes**

Aplicar los mensajes españoles a los schemas en `validations/users/`, `validations/roles/`, etc.:

```ts
export const createUserSchema = z.object({
	email: z.string().email(VALIDATION_MESSAGES.EMAIL),
	firstName: z
		.string()
		.min(1, VALIDATION_MESSAGES.REQUIRED)
		.max(100, VALIDATION_MESSAGES.MAX_LENGTH(100)),
	organizationId: z.string().uuid(VALIDATION_MESSAGES.UUID),
});
```

### 7. **Middleware de parseo mejorado** (si existe)

Si hay un middleware que parsea query/body/params, debe:

- Capturar `parsed.error` de `.safeParse()`
- Convertir a `ValidationError` con detalles Zod
- Lanzar el error para que el handler global lo procese

```ts
if (!parsed.success) {
	throw new ValidationError(
		'Los datos enviados contienen errores de validación.',
		formatZodError(parsed.error),
	);
}
```

### 8. **`errors/` — Mejorar clases existentes**

Todas las clases de error extienden `AppError` y pueden incluir `details`:

- `AuthenticationError` → 401 (sin `details`)
- `AuthorizationError` → 403 (sin `details`)
- `NotFoundError` → 404 (sin `details`)
- `ConflictError` → 409 (sin `details`)
- `BusinessRuleError` → 422 (sin `details`)

### 9. **Tests**

- Unitarios: `lib/errors/zod-formatter.test.ts` prueba conversión de `ZodError` a `ErrorDetail[]`.
- Integración: `tests/integration/error-handling/` prueba endpoints que lanzan `ValidationError`, `NotFoundError`, etc., y verifica la estructura de respuesta.

## Decisiones

- **Centralizar en handler global**: Todos los errores pasan por el mismo flujo en `routerOptions.onError`, evitando duplicación.
- **`details` solo para validación**: Los errores de negocio o sistema no incluyen `details` para no exponer lógica interna.
- **Mensajes en español**: Mejora UX para usuarios hispanohablantes; localización futura es una feature aparte.
- **Logging sin exposición**: El stacktrace completo va a Pino; el cliente solo ve `code` y `message`.

## Riesgos

- **Compatibilidad hacia atrás**: Los clientes actuales esperan la estructura anterior. **Mitigación:** el cambio es no-destructivo (solo se añade `details` si existen); clientes existentes seguirán funcionando aunque ignoren el campo.
- **Performance en errores frecuentes**: Formatear Zod errors en cada validación fallida agrega microsegundos. **Mitigación:** es aceptable; la validación falla raramente en producción.
- **Exposición accidental de datos**: Si un mensaje de error incluye valor recibido sensible. **Mitigación:** revisar que `received` nunca contenga tokens, passwords, etc.
