# 013 · Carga Diferida mediante Strategy — Plan

_Cómo se implementará lo descrito en `spec.md`. Esta entrega crea únicamente documentación._

## Enfoque

Formalizar las proyecciones básica y detallada que ya existen implícitamente. La API valida un enum cerrado, el servicio selecciona una estrategia tipada y la estrategia llama una operación de repositorio específica que devuelve un DTO plano. El valor por defecto de los detalles es `detailed` para no romper consumidores.

No se usa lazy loading del ORM ni un builder genérico de `include`. No se agrega dependencia: Strategy se implementa con tipos, funciones/objetos y records exhaustivos de TypeScript.

## Implementación futura

1. **Baseline** — Capturar contratos JSON, queries, filas, tamaño y p95 de listados/detalles de usuarios y roles antes del cambio. Separar costo de auth y ejecutar con caché en bypass si existe.

2. **`validations/users/index.ts`** — Crear `detailLevelSchema = z.enum(['basic', 'detailed']).default('detailed')` y un schema de params/query de detalle que combine `userId` y selector. Rechazar arrays y valores desconocidos con el transformador vigente.

3. **`validations/roles-permisos/role.validation.ts`** — Crear schema para `roleId`, `organizationId` y el mismo enum/default. Centralizar la validación hoy manual de query sin ampliar valores permitidos.

4. **Tipos DTO** — Inferir `UserBasic`, `UserDetailed`, `RoleBasicDetail` y `RoleDetailed` desde schemas Zod compartibles o tipos de retorno explícitos. No duplicar formas divergentes entre service y OpenAPI.

5. **`database/users/index.ts`** — Separar proyecciones:
   - `selectUserBasicFields`: User + Profile, sin UserRole.
   - `selectUserDetailedFields`: base + `userRoles.role` limitado a id/code/name.
   - `getAll()` usa basic; `record().getBasic()` y `getDetailed()` resuelven detalles.
   - Escrituras mantienen la proyección detallada requerida por su contrato.

6. **`services/users/detail-strategies/`** — Crear contrato común, `userBasicStrategy`, `userDetailedStrategy` y registry exhaustivo. Cada estrategia autoriza contexto, llama database y mapea DTO; no recibe HTTP ni Prisma.

7. **`services/users/index.ts`** — `getById(userId, detailLevel, accessContext)` selecciona estrategia. Mantener una operación interna detallada explícita para escrituras/subrecursos donde el cliente no elige.

8. **`pages/api/users/[userId].ts`** — En GET validar path/query, pasar selector/contexto al servicio y conservar `{ data }`, status y middlewares. PATCH/DELETE no aceptan selector.

9. **`pages/api/users/index.ts`** — Mantener listado básico sin parámetro de detalle. Verificar que el repositorio ya no carga roles omitidos.

10. **`pages/api/users/[userId]/roles/index.ts`** — Usar servicio/repositorio específico de roles en vez de obtener el usuario detallado completo. Coordinar paginación y N+1 con la feature correspondiente.

11. **`database/roles-permisos/role.db.ts`** — Separar `getRoleBasicById` y `getRoleDetailedById`, ambos filtrados por organizationId/deletedAt. Basic selecciona escalares; detailed añade RolePermission/Permission con selección exacta.

12. **`services/roles-permisos/detail-strategies/`** — Contrato común de módulo, estrategias basic/detailed y registry. La estrategia no consulta `prisma` directamente; toda query permanece en database.

13. **`services/roles-permisos/role.service.ts`** — Seleccionar estrategia en lectura. Mantener detailed fijo en create/update mientras esos contratos incluyan permisos. Como corrección arquitectónica previa, mover las consultas Prisma directas actuales del servicio a database sin mezclar reglas no relacionadas.

14. **`pages/api/roles/[roleId].ts`** — GET valida selector y conserva organizationId/roles.read. PATCH/DELETE ignoran/rechazan detailLevel según schema de método, para no alterar escrituras.

15. **Subrecurso permisos** — Consultar permisos paginados directamente y no reutilizar RoleDetailed. Esta tarea depende de la feature N+1, pero el Strategy no debe perpetuar la carga completa.

16. **Autorización** — Construir `DetailContext` desde `req.user`/tenant ya autenticados y transformarlo a tipo de dominio. El selector nunca aumenta permisos. Tests cruzados validan 403/404.

17. **Composición futura** — No implementar composer/expand ahora. Documentar el punto de extensión: registry de bloques, profundidad 1, máximo 2, batch por IDs y presupuesto de consultas.

18. **Observabilidad** — Añadir estrategia como dimensión de logs/métricas, con query count, filas, DB/strategy duration y response bytes; no registrar DTO/PII.

19. **`documentation/schemas/users.ts` y `roles-permisos.ts`** — Registrar schemas básicos/detallados y `detailLevel` en GET de detalle. Mantener default detailed, ejemplos y errores. Exportaciones existentes permanecen.

20. **Tests** — Unitarios de selector/registry/DTO, integración HTTP/DB/autorización/queries y rendimiento con relaciones 1/20/100.

## Pseudoflujos

### Selección segura

```text
parsed = detailQuerySchema.safeParse(req.query)
throwValidationError(parsed)

context = accessContextFromAuthenticatedRequest(req)
result = service.getById({ id, tenant }, parsed.data.detailLevel, context)

service:
  strategy = strategies[detailLevel] // enum validado
  strategy.authorize(context, params)
  return strategy.load(params, context)
```

### Estrategia básica

```text
authorize permiso base + tenant
record = database.getBasicById(id, tenant)
si no existe → NotFoundError
return mapBasicDto(record)
```

### Estrategia detallada

```text
authorize permiso base + requisitos adicionales declarados
record = database.getDetailedById(id, tenant)
si no existe → NotFoundError
return mapDetailedDto(record) // relación ya materializada
```

### Composición futura, no implementada ahora

```text
validar expand contra enum, max 2, depth 1
cargar base una vez
autorizar cada bloque
agrupar IDs y cargar relaciones por lote
ejecutar en paralelo solo bloques independientes y acotados
ensamblar DTO plano sin nuevas queries
```

## Presupuestos

| Estrategia | Llamadas Prisma de dominio | Profundidad | Relación materializada |
|---|---:|---:|---|
| User basic detail | ≤ 1 | 0/1:1 Profile | Ninguna colección |
| User detailed | ≤ 2, objetivo 1 | 1 | UserRole → Role mínimo |
| Role basic detail | ≤ 1 | 0 | Ninguna colección |
| Role detailed | ≤ 2, objetivo 1 | 1 | RolePermission → Permission |
| Listados básicos | 2 (data + count) | Sin colecciones opcionales | Ninguna no usada |

El presupuesto debe permanecer constante al variar relaciones 1, 20 y 100. También se comparan filas, memoria y bytes para detectar productos cartesianos/sobreconsulta aunque el conteo sea constante.

## Decisiones

- **`detailLevel` sobre `include/fields/expand`** — Solo existen dos variantes coherentes; un enum evita combinaciones arbitrarias y es más fácil de autorizar/documentar.
- **Default `detailed` en detalles** — Preserva el contrato actual. `basic` es opt-in compatible.
- **Listados siempre basic** — Evita amplificar relaciones por hasta 100 elementos y mantiene subrecursos paginados.
- **Strategy en servicios, proyección en database** — El selector es lógica de caso de uso; Prisma permanece encapsulado.
- **Registry estático** — Evita reflexión, imports dinámicos y acceso a nombres arbitrarios.
- **DTO plano y eager selectivo** — “Diferida” significa elegir antes de consultar, no cargar relaciones después.
- **Sin full/statistics/files** — No existen datos o servicios que los respalden.
- **Sin composición inicial** — Se documentan límites futuros, pero no se crea abstracción prematura.

## Riesgos

- **Ruptura del contrato predeterminado (criticidad alta)** — Cambiar el default a `basic`, omitir arrays vacíos o alterar nulabilidad rompería consumidores aunque el status siga siendo 200. **Mitigación:** `detailed` permanece como default; guardar fixtures JSON y schemas OpenAPI del baseline; ejecutar comparación estructural de claves, tipos, nulabilidad, orden y errores. **Gate:** el selector omitido debe ser contractualmente idéntico antes de integrar.
- **Escalada de acceso o fuga cross-tenant (criticidad crítica)** — El registry podría seleccionar una proyección válida técnicamente pero no permitida para el actor o la organización. **Mitigación:** `auth`/`access` antes del servicio, `authorize()` por estrategia, contexto construido solo desde sesión validada y filtros `organizationId`/soft delete en database. **Gate:** matriz negativa por estrategia demuestra 403 sin permiso y 404 para tenant ajeno, sin ejecutar la consulta detallada no autorizada.
- **N+1 y sobreconsulta (criticidad alta)** — Añadir relaciones puede convertir una consulta constante en una por elemento o cargar columnas/filas que nunca se serializan. **Mitigación:** `select` exacto por DTO, batch por IDs, profundidad 1, relaciones crecientes mediante subrecursos y presupuestos de la feature N+1. **Gate:** mismo query count para 1/20/100 relaciones y reducción medible de filas/bytes en basic.
- **Consultas duplicadas y producto cartesiano (criticidad alta)** — Ejecutar base y detailed por separado puede recargar el mismo registro; unir varias M:N puede multiplicar filas y memoria. **Mitigación:** una estrategia posee la carga completa, el composer futuro reutiliza el resultado base y como máximo incorpora una colección no acotada por consulta; las demás se agrupan y ensamblan con `Map`. **Gate:** trazas no contienen consultas equivalentes repetidas y las filas crecen proporcionalmente.
- **Inconsistencia entre bloques paralelos (criticidad media/alta)** — `Promise.all` sobre lecturas relacionadas puede observar versiones distintas, y un closure puede conservar un cliente transaccional inválido. **Mitigación:** paralelizar solo bloques independientes; para snapshot común usar `$transaction`, materializar DTO dentro de ella y prohibir loaders diferidos. **Gate:** prueba concurrente no mezcla versiones y el contador confirma cero queries después del commit.
- **Explosión combinatoria de estrategias (criticidad media)** — Crear `BasicWithRoles`, `BasicWithStats`, `FullWithFiles`, etc. duplica lógica y vuelve imposible razonar sobre permisos/costos. **Mitigación:** solo `basic`/`detailed` en el alcance; futuras capacidades son bloques allowlisted componibles con máximo 2 y requieren spec propia. **Gate:** revisión rechaza toda estrategia sin consumidor, DTO, permiso, costo y presupuesto documentados.
- **Coordinación incompleta con N+1 (dependencia bloqueante parcial)** — `GET /roles/{roleId}/permisos` pagina hoy después de cargar la relación completa y los roles de usuario tienen deuda de consultas. **Mitigación:** Strategy no reutiliza detalles para subrecursos; la paginación/agrupación se resuelve en la feature N+1. **Gate:** esos subrecursos no se incluyen en composición hasta cumplir query budget y paginación DB.
- **Coordinación incompleta con caché (dependencia condicionada)** — Si se implementa caché, omitir `detailLevel`, tenant o fingerprint en la clave podría servir un DTO incorrecto o más privilegiado. **Mitigación:** claves/namespaces/schema por estrategia y autorización, con invalidación independiente. **Gate:** tests de aislamiento basic/detailed y cross-tenant antes de activar caché en estos endpoints.
- **Coordinación incompleta con colas (dependencia futura)** — Estadísticas o archivos pesados podrían introducirse como una estrategia `full` y bloquear HTTP. **Mitigación:** Strategy solo admite lecturas acotadas; procesos fuera del SLA usan BullMQ y devuelven un resultado persistido/autorizado. **Gate:** ningún bloque pesado entra al registry sin evaluación síncrona/asíncrona.
- **Deuda técnica previa (dependencia bloqueante)** — El filtro `organizationId` de usuarios no está aplicado, los códigos de permiso son inconsistentes y `role.service` consulta Prisma directamente. **Mitigación:** no ampliar visibilidad, resolver o aislar cada defecto y mover acceso de datos antes de integrar. **Gate:** tests multi-tenant/permisos verdes y fronteras de capas restauradas en los módulos afectados.

## Orden de dependencias

1. Resolver o aislar permisos, tenant y acceso Prisma directo que afecten los endpoints objetivo.
2. Aplicar presupuestos y subrecursos paginados definidos por la feature N+1.
3. Implementar Strategy y verificar compatibilidad/autorización sin caché.
4. Integrar claves de caché diferenciadas solo si esa feature está activa.
5. Mantener cálculos/archivos pesados fuera de Strategy y coordinarlos con BullMQ cuando existan.

Este orden evita que caché o composición oculten errores de autorización y rendimiento presentes en la fuente original.
