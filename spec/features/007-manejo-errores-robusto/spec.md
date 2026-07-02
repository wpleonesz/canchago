# 007 · Manejo Robusto de Errores con Detalles Zod

**Estado:** propuesta

## Qué hace

Mejora el sistema de manejo de errores en todos los endpoints para proporcionar mensajes detallados, comprensibles y accionables que ayuden al cliente a entender exactamente qué validación falló y por qué:

- Errores de validación de Zod: lista los campos específicos, el tipo esperado y la regla que falló.
- Errores de negocio: mensajes claros en español con contexto suficiente para que el usuario sepa qué corregir.
- Errores del sistema: logueo estructurado sin exponer detalles internos al cliente.
- Consistencia: todos los endpoints devuelven el mismo formato de error con `code`, `message` y `details` según corresponda.

Ejemplo de respuesta mejorada:

```json
{
	"error": {
		"code": "VALIDATION_ERROR",
		"message": "Los datos enviados contienen errores de validación.",
		"details": [
			{
				"field": "email",
				"message": "Formato de correo electrónico inválido",
				"received": "invalid-email",
				"type": "email"
			},
			{
				"field": "firstName",
				"message": "El campo es requerido",
				"type": "string"
			}
		]
	}
}
```

## Por qué

Actualmente, cuando una validación falla, el cliente solo recibe un mensaje genérico ("Los datos enviados no son válidos"). Sin detalles específicos del campo que falló, los clientes (webs, apps móviles, integradores) no pueden ofrecer UX adecuada (highlighting de campos, mensajes in-line en formularios). Esto es especialmente crítico para un backend SaaS que será consumido por múltiples frontends. Además, facilita el debugging durante desarrollo.

## Criterios de aceptación

### Errores de validación

- [ ] Todo error de validación de Zod devuelve `details` con un array de objetos, cada uno con `field`, `message`, `type` y opcionalmente `received` o `constraint`.
- [ ] El campo `message` es siempre el mensaje personalizado del validador Zod (ej: "Formato de correo electrónico inválido").
- [ ] Validadores comunes tienen mensajes predefinidos en español: email, uuid, minLength, maxLength, enum, number, etc.
- [ ] Errors del sistema (no de validación) **no** exponen `details` al cliente, solo `code` y `message` genéricos.
- [ ] Errores de negocio (BusinessRuleError, ConflictError) devuelven `message` claro en español indicando qué restricción se violó.
- [ ] Rate limit devuelve `429` con mensaje "Demasiadas solicitudes. Reintenta después de {segundos} segundos".
- [ ] Errores no capturados devuelven `500` con mensaje genérico sin exponer trazas Prisma, SQL ni tokens.

### Logging y auditoría

- [ ] Todo error (conocido o no) se registra en Pino con nivel apropiado (warn para validación, error para interno).
- [ ] Errores internos registran la trazabiliamente completa (stacktrace, requestId, contexto) **en logs internos**, pero nunca en la respuesta al cliente.
- [ ] Los logs no contienen tokens, cookies, contraseñas, códigos OAuth ni valores sensibles.

### Documentación

- [ ] El esquema OpenAPI documenta la estructura de error con el array `details` para endpoints que pueden fallar en validación.
- [ ] La documentación muestra un ejemplo de respuesta de error con los detalles.

### Compatibilidad

- [ ] No rompe endpoints existentes: solo añade/mejora el campo `details` en respuestas de error existentes.
- [ ] Los middlewares `auth` y `access` también mejoran sus mensajes de error siguiendo el mismo formato.

## Fuera de alcance

- Localización a idiomas distintos del español (eso es una feature posterior).
- Traducciones de mensajes de Zod: se usan los mensajes españoles configurados en el schema.
- Transformación automática de todos los errores antiguos; las nuevas features lo implementan desde el inicio.
- Retry automático o circuit breaker: esto es responsabilidad del cliente.
