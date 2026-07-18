# 013 · Carga Diferida mediante Strategy

**Estado:** propuesta

## Qué hace

Incorpora selección explícita y segura del nivel de detalle en lecturas que ya presentan variantes reales. Mediante el patrón Strategy, el servicio elige una proyección básica o detallada antes de consultar PostgreSQL, de modo que las relaciones opcionales solo se recuperen cuando el contrato y los permisos las requieran.

La carga diferida no significa conservar objetos Prisma para resolver relaciones más tarde. Cada estrategia ejecuta una consulta completa y acotada dentro del ciclo del servicio, construye un DTO plano y termina antes de responder. No hay proxies, getters asíncronos ni acceso a base de datos durante la serialización.

## Por qué

El proyecto ya tiene niveles de detalle implícitos, pero no un contrato común:

- `GET /api/users` omite roles en el DTO, aunque `database/users.getAll()` usa una proyección compartida que sí carga `userRoles.role`.
- `GET /api/users/{userId}` devuelve roles.
- `GET /api/roles` devuelve `_count.permissions`, no permisos completos.
- `GET /api/roles/{roleId}` carga `RolePermission.permission` completo.

Separar estrategias evita sobreconsulta, mantiene DTO predecibles y permite extender lecturas sin llenar servicios de condicionales o aceptar nombres dinámicos de includes/clases.

## Auditoría del código actual

| Endpoint/flujo | Datos obligatorios actuales | Datos opcionales o costosos confirmados | Decisión |
|---|---|---|---|
| `GET /api/users` | id, email, nombres, active, createdAt, updatedAt, meta | `userRoles.role` se carga pero el mapper no lo devuelve | Estrategia básica fija para el listado; no exponer expansión en colecciones inicialmente |
| `GET /api/users/{userId}` | Mismos campos base | `roles` se devuelve actualmente y es opcional en `UserResponseSchema` | `basic` omite roles; `detailed` los incluye; default `detailed` para compatibilidad |
| Respuestas POST/PATCH de usuarios | Usuario creado/actualizado con roles | Los roles forman parte del resultado actual | Mantener estrategia detallada fija; no aceptar selector en escrituras |
| `GET /api/users/{userId}/roles` | Roles y meta | Solo necesita relación M:N, no el resto del DTO de usuario | Usar repositorio específico de subrecurso; no componer detalle completo del usuario |
| `GET /api/roles` | Campos base del rol, `_count.permissions`, meta | Permisos completos no son necesarios | Estrategia básica de listado fija, ya alineada con la consulta actual |
| `GET /api/roles/{roleId}` | Campos base | Array `permissions` completo, exigido hoy por `RoleDetailSchema` | `basic` omite relación; `detailed` la incluye; default `detailed` |
| Respuestas POST/PATCH de roles | Rol resultante con permisos | Permisos completos se devuelven actualmente | Mantener estrategia detallada fija |
| `GET /api/roles/{roleId}/permisos` | Permisos paginados | No necesita cargar/serializar todo el rol | Consulta específica del subrecurso; coordinar con feature N+1 |
| Organizaciones y sedes | DTO planos con columnas escalares | No hay relaciones, estadísticas ni archivos en los contratos | No crear estrategias; conservar consultas actuales |
| `GET /api/auth/session` | Usuario, roles y permisos efectivos | Todo el bloque es necesario para sesión/autorización | No aplicar selector controlado por cliente |
| Permisos globales | DTO plano paginado | No hay bloques opcionales | No aplicar Strategy |

No existen archivos, adjuntos, estadísticas, reportes ni cálculos costosos en los endpoints actuales. Tampoco existen DTO o serializers como capas independientes: algunos DTO se forman en servicios y las proyecciones viven en `database/`. La feature no inventa estrategias para componentes ausentes.

## Contrato HTTP compatible

Se propone únicamente para los detalles confirmados:

```text
GET /api/users/{userId}?detailLevel=basic|detailed
GET /api/roles/{roleId}?organizationId=<uuid>&detailLevel=basic|detailed
```

- `detailLevel` es opcional y enum cerrado validado con Zod.
- El valor predeterminado es `detailed` porque ambos endpoints hoy devuelven relaciones; omitir el parámetro conserva exactamente el contrato actual.
- `basic` es una ampliación opt-in que devuelve únicamente campos base.
- Valores desconocidos, arrays o combinaciones inválidas producen `422 VALIDATION_ERROR` con el formato vigente.
- No se admiten `fields`, `include` o nombres de relaciones arbitrarios.
- Los listados permanecen básicos y los subrecursos siguen siendo la forma recomendada de paginar relaciones grandes.

### DTO de usuario

`UserBasic`:

```text
id, email, firstName, lastName, active, createdAt, updatedAt
```

`UserDetailed`:

```text
UserBasic + roles[{ id, code, name }]
```

### DTO de rol

`RoleBasicDetail`:

```text
id, organizationId, name, description, code, isSystem, createdAt, updatedAt
```

`RoleDetailed`:

```text
RoleBasicDetail + permissions[
  { roleId, permissionId, granted, permission{ id, module, action, code, description, createdAt } }
]
```

Los listados conservan sus DTO actuales: usuario básico paginado y rol básico con `_count.permissions`. `_count` es una proyección de colección, no parte necesaria de `RoleBasicDetail`.

## Contrato Strategy

Interfaz conceptual de servicio:

```ts
type DetailLevel = 'basic' | 'detailed';

type DetailContext = {
  actorUserId: string;
  organizationId?: string;
  permissionCodes: ReadonlySet<string>;
};

interface DetailStrategy<TParams, TResult> {
  readonly key: DetailLevel;
  authorize(context: DetailContext, params: TParams): void;
  load(params: TParams, context: DetailContext): Promise<TResult>;
}
```

Es un contrato de diseño; la implementación mantendrá funciones flecha y tipos TypeScript estrictos según la constitución. La estrategia no recibe `NextApiRequest`, `NextApiResponse`, nombres de modelos, objetos Prisma o callbacks enviados por el cliente.

Cada módulo mantiene un registry inmutable y exhaustivo:

```text
userDetailStrategies = {
  basic: userBasicStrategy,
  detailed: userDetailedStrategy,
}

roleDetailStrategies = {
  basic: roleBasicStrategy,
  detailed: roleDetailedStrategy,
}
```

El selector solo indexa el registry con el enum ya validado. No usa reflexión, `eval`, import dinámico, rutas de archivo o contenedor por nombre externo.

## Estrategias concretas

### Usuario básico

- Requiere el mismo `users.read` actual.
- Consulta `User` y `UserProfile` 1:1 mediante `select` exacto.
- No carga `UserRole`, `RolePermission`, sesiones o cuentas OAuth.
- Devuelve `NotFoundError` si el usuario no existe según las reglas actuales.

### Usuario detallado

- Requiere `users.read`; no concede información adicional a la ya expuesta actualmente.
- Consulta campos básicos más `UserRole.role` con selección `id`, `code`, `name`.
- Conserva tenant/alcance cuando la deuda de `organizationId` y `UserRole` sea corregida; hasta entonces no amplía visibilidad.
- No carga permisos de cada rol, sesiones ni cuentas OAuth.

### Rol básico

- Requiere `roles.read` y `organizationId`.
- Filtra `id`, organización y `deletedAt: null`.
- Selecciona únicamente campos base.
- No carga `RolePermission` ni usuarios asignados.

### Rol detallado

- Requiere `roles.read` y el mismo tenant.
- Añade `RolePermission` y `Permission` con los campos registrados en OpenAPI.
- No añade usuarios, organización completa, menús u otras relaciones no solicitadas.
- Si el volumen de permisos crece por encima del límite aceptable, el cliente debe usar el subrecurso paginado; no se agregan páginas anidadas implícitas.

No se definen `statistics`, `files`, `relations` genérica o `full` porque no existen bloques confirmados que las justifiquen. Cada estrategia futura requiere una spec que identifique fuente, DTO, permiso, costo, límites e invalidación/cache.

## Selección y autorización

```text
request
  → auth
  → access('users.read' | 'roles.read')
  → Zod(path + query + detailLevel default detailed)
  → service.getById(params, detailLevel, accessContext)
  → registry[detailLevel]
  → strategy.authorize(context, params)
  → strategy.load(params, context)
  → DTO plano
  → response 200
```

La autorización HTTP se ejecuta antes del selector. La estrategia vuelve a comprobar tenant/alcance de datos cuando corresponda, pero no reemplaza `access()`. Si en el futuro un bloque requiere un permiso adicional, el registry declara ese requisito y la selección devuelve 403; nunca degrada silenciosamente a una estrategia menor porque ocultaría un error de autorización del cliente.

La estrategia por defecto no depende del rol por nombre ni de configuración enviada por el cliente. En endpoints internos, el servicio puede escoger una estrategia fija por caso de uso, pero el contexto nunca eleva el detalle por encima de los permisos efectivos.

## Composición de bloques opcionales

Hoy `basic` y `detailed` son alternativas completas; no se combinan múltiples bloques arbitrarios. Si aparecen estadísticas, archivos u otras relaciones confirmadas:

- Se preferirá un `expand` de enum cerrado solo si los bloques son independientes; máximo inicial de 2 expansiones y profundidad 1.
- La estrategia base se ejecuta una vez.
- Relaciones para colecciones se cargan por lotes usando IDs de la página, nunca una consulta por elemento.
- Consultas independientes pueden usar `Promise.all` solo si la suma de concurrencia, pool y consistencia lo permite.
- Bloques que requieran el mismo snapshot transaccional se resuelven dentro de una única transacción de lectura compatible, sin ejecutar accesos después de cerrarla.
- Un composer ensambla DTO en memoria sin volver a llamar la misma estrategia o serializar modelos Prisma.
- Combinaciones incompatibles o que excedan límites producen 422; bloques no autorizados producen 403.

No se introducirá `expand` hasta que una feature concreta defina por lo menos dos bloques reales. `detailLevel` evita esa complejidad en el alcance actual.

## Consultas y límites

- Las proyecciones se definen en `database/users/` y `database/roles-permisos/`, no en API Routes.
- Cada estrategia produce un número constante de consultas respecto al número de relaciones.
- Presupuesto lógico inicial: detalle básico ≤ 1 llamada Prisma; detalle detallado ≤ 2, y preferentemente 1 con `select` anidado seguro.
- El costo fijo de autenticación se mide aparte, de acuerdo con la feature N+1.
- No se permite consulta dentro de loops, resolver cada rol/permiso individualmente ni cargar relación completa para luego descartarla.
- Profundidad máxima actual: 1 bloque de detalle. Usuario → roles; rol → permisos. No se expande rol → permisos dentro del usuario.
- Los listados mantienen `pageSize <= 100` y no permiten `detailed` para toda la colección en esta primera versión.
- Los arrays anidados no superan límites del dominio; relaciones crecientes usan subrecursos paginados.
- No hay acceso a DB durante `JSON.stringify`, después de retornar del servicio o después del cierre de `$transaction`.
- Los DTO son objetos planos construidos explícitamente; nunca se retorna un modelo Prisma completo por propagación (`...record`) sin lista de campos.

## Consistencia, caché y colas

- Una estrategia lee datos vigentes en la misma solicitud; no conserva closures con clientes transaccionales.
- Si una lectura necesita snapshot común, todas sus consultas se ejecutan y materializan dentro de la transacción.
- Si la feature de caché se implementa, `detailLevel` forma parte de la clave y cada estrategia tiene namespace/schema propio. Basic y detailed nunca comparten entrada.
- Las estrategias de consulta no publican jobs BullMQ. Estadísticas realmente pesadas deberán ser precomputadas o solicitarse mediante la feature asíncrona, no bloquear un `detailLevel=full` inexistente.

## Errores

| Condición | Respuesta |
|---|---|
| `detailLevel` ausente | Usa `detailed` y conserva comportamiento actual |
| `detailLevel` desconocido, array o formato inválido | 422 `VALIDATION_ERROR` |
| Usuario no autenticado | 401 vigente |
| Sin permiso base | 403 vigente |
| Estrategia/bloque conocido pero no permitido | 403, sin fallback silencioso |
| Recurso inexistente, borrado o fuera del tenant | 404 para no filtrar existencia |
| Estrategia no registrada por error interno | Log estructurado y 500 genérico; nunca cargar dinámicamente |

## Observabilidad y métricas

Logs Pino estructurados incluyen `requestId`, módulo, endpoint, estrategia, bloques, tenant no sensible, query count, DB duration, strategy duration, filas/materialización y response size. No incluyen DTO completo, email, permisos completos, cookies, tokens ni parámetros sensibles.

Métricas:

- Selecciones por estrategia y combinaciones rechazadas.
- Latencia p50/p95/p99 por módulo/estrategia.
- Conteo/duración de consultas y filas materializadas.
- Tamaño de respuesta.
- 403/422 por selección.
- Cache hit/miss por estrategia si aplica.

El objetivo esperado es que `basic` materialice menos relaciones y bytes que `detailed`, sin aumentar consultas con el tamaño de relaciones ni degradar el p95 del comportamiento predeterminado.

## Riesgos y pendientes

| Riesgo o dependencia | Impacto verificable | Prevención y mitigación | Condición para cerrar |
|---|---|---|---|
| Compatibilidad del contrato predeterminado | Consumidores actuales podrían dejar de recibir `roles` o `permissions` al omitir `detailLevel` | Mantener `detailed` como default, capturar snapshots JSON/OpenAPI antes del cambio y comparar status, claves, nulabilidad y arrays | Tests contractuales demuestran equivalencia exacta con el comportamiento anterior cuando el selector se omite |
| Escalada de acceso por estrategia | Un usuario podría solicitar relaciones fuera de su permiso o tenant | Ejecutar `auth` y `access` antes del selector, usar un registry cerrado, autorizar dentro de la estrategia y filtrar por tenant/soft delete en database | Matriz de pruebas 401/403/404 cubre usuario, permiso y tenant cruzados para cada estrategia |
| N+1 y sobreconsulta | `detailed` podría ejecutar una consulta por relación o materializar datos que el DTO no usa | Proyecciones `select` exactas, carga por lote, profundidad 1, presupuestos constantes y subrecursos paginados para relaciones crecientes | `Q_domain(1) = Q_domain(20) = Q_domain(100)` y basic reduce filas/bytes frente a detailed |
| Consultas duplicadas y productos cartesianos | La estrategia base y los bloques podrían recargar el recurso o un join M:N multiplicar filas/memoria | Una estrategia es dueña de la carga completa; compartir resultado base, ensamblar con `Map` y separar colecciones no acotadas en consultas agrupadas | Instrumentación confirma ausencia de queries repetidas y crecimiento de filas proporcional, no multiplicativo |
| Inconsistencia entre bloques paralelos | Dos bloques opcionales podrían reflejar estados distintos o usar un cliente transaccional después del commit | Paralelizar solo lecturas independientes; usar una transacción de lectura cuando el contrato exija snapshot y materializar todo antes de cerrarla | Pruebas concurrentes verifican un snapshot coherente y cero consultas posteriores al cierre transaccional |
| Crecimiento excesivo de estrategias | Una clase por combinación produciría duplicación y mantenimiento exponencial | Limitar el alcance a `basic`/`detailed`; introducir bloques componibles solo con casos reales, registry exhaustivo, profundidad 1 y máximo 2 expansiones futuras | Toda estrategia nueva tiene spec, consumidor, DTO, permiso, presupuesto y evidencia de necesidad aprobados |
| Dependencia de la feature N+1 | Los subrecursos actuales de roles/permisos pueden cargar relaciones completas o paginar en memoria | No reutilizar `RoleDetailed` para subrecursos; coordinar repositorios paginados y tests de query count | Subrecursos paginan en PostgreSQL y cumplen presupuestos constantes antes de habilitar composición |
| Dependencia de caché | Una entrada basic podría servirse como detailed o ignorar autorización | Incluir módulo, estrategia, tenant y fingerprint de autorización en clave/schema; namespaces separados | Tests prueban aislamiento basic/detailed, usuario/tenant y correcta invalidación |
| Dependencia de colas | Un cálculo futuro pesado podría incorporarse erróneamente a `detailed` y bloquear HTTP | Strategy solo resuelve lecturas acotadas; estadísticas/reportes pesados usan trabajo asíncrono aprobado y resultado persistido | Ninguna estrategia supera su SLA o ejecuta generación pesada dentro de la solicitud |
| Deuda técnica previa | Permisos inconsistentes, filtro `organizationId` incompleto y Prisma directo en `role.service` pueden invalidar garantías | No ampliar visibilidad; resolver o aislar los prerequisitos y registrar baseline antes de implementar | Permisos/tenant funcionan en integración y todo acceso Prisma afectado reside en `database/` |

Los pendientes anteriores son gates de implementación, no mejoras opcionales. La feature no puede marcarse como terminada si solo funciona la selección nominal pero falla compatibilidad, aislamiento o presupuesto de consultas.

## Criterios de aceptación

- [ ] El inventario identifica únicamente variantes existentes: usuario básico/detallado y rol básico/detallado; no crea estrategias para archivos o estadísticas inexistentes.
- [ ] `GET /api/users/{userId}` y `GET /api/roles/{roleId}` aceptan solo `detailLevel=basic|detailed` validado con Zod.
- [ ] Omitir `detailLevel` produce exactamente el DTO detallado actual y mantiene compatibilidad.
- [ ] `basic` no recupera ni serializa roles/permisos opcionales.
- [ ] `detailed` recupera solo las relaciones/campos documentados y autorizados.
- [ ] Los listados usan estrategia básica fija; `GET /api/users` deja de cargar roles que no devuelve.
- [ ] Los subrecursos de roles/permisos usan consultas específicas y paginadas en lugar de detalles completos.
- [ ] La selección usa registry/enum cerrado y nunca nombres arbitrarios de clases, archivos, servicios, modelos o includes.
- [ ] Auth, permisos y tenant se comprueban antes de entregar cualquier estrategia; un detalle no permitido devuelve 403 o 404 según contexto.
- [ ] Ninguna estrategia accede a Prisma desde API Routes/serializer, después de cerrar transacción o durante serialización.
- [ ] Basic y detailed devuelven DTO planos y no filtran relaciones Prisma accidentales.
- [ ] El número de consultas permanece constante para 1, 20 y 100 relaciones; no aparece N+1.
- [ ] La profundidad máxima es 1 y no se permiten combinaciones/expansiones arbitrarias.
- [ ] Métricas demuestran reducción de filas/tamaño/latencia en basic frente a detailed cuando hay relaciones.
- [ ] Errores 401/403/404/422/500 conservan el formato estandarizado.
- [ ] Todos los riesgos críticos de la tabla tienen prueba asociada y condición de cierre satisfecha.
- [ ] Las dependencias N+1, caché, colas y deuda técnica están resueltas o explícitamente aisladas sin debilitar el contrato de esta feature.

### Documentación (obligatorio)

- [ ] `UserBasic`, `UserDetailed`, `RoleBasicDetail` y `RoleDetailed` se registran con `registry.registerComponent()` en sus módulos existentes.
- [ ] Los paths de detalle documentan `detailLevel`, default, enum, ejemplos y respuestas compatibles mediante schemas explícitos.
- [ ] Listados, escrituras y subrecursos conservan sus schemas actuales sin anunciar expansiones inexistentes.
- [ ] Los módulos permanecen exportados desde `documentation/schemas/index.ts` y son correctos en `GET /api/docs`.

## Fuera de alcance

- Implementar estrategias, cambiar queries, endpoints, DTO o OpenAPI dentro de esta entrega documental.
- Añadir `fields`, `include`, `expand`, `full`, estadísticas, archivos o cálculos sin una feature y fuente reales.
- Permitir detalle en listados masivos o profundidad mayor a uno.
- Crear lazy loading de ORM, proxies o acceso a DB durante serialización.
- Resolver paginación de permisos, N+1, caché, colas o deuda de permisos; solo se coordinan sus contratos.
- Cambiar permisos, aislamiento multi-tenant o semántica de escrituras existentes.
