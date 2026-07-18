# 012 · Prevención de Consultas N+1

**Estado:** propuesta

## Qué hace

Define una estrategia técnica verificable para detectar, prevenir y corregir consultas N+1 en endpoints que recuperan colecciones, relaciones, agregaciones o datos anidados. La optimización debe mantener los contratos HTTP, DTO, paginación, filtros, ordenamiento, permisos, aislamiento multi-tenant y errores existentes.

La feature no presupone que toda relación cargada mediante Prisma sea un N+1. Distingue entre:

- Una cantidad constante de consultas, independiente del tamaño de la colección.
- Varias consultas agrupadas que Prisma puede usar para resolver un `include`, pero cuyo número permanece acotado.
- Un N+1 real, donde el número de operaciones crece linealmente porque una consulta se ejecuta por cada elemento.
- Sobreconsulta, donde una única operación trae relaciones o columnas innecesarias y puede ser tan costosa como el problema que intenta evitar.

## Por qué

Los listados tienen `pageSize` de hasta 100 y el dominio contiene relaciones 1:1, 1:N y M:N entre usuarios, perfiles, organizaciones, sedes, roles y permisos. Un acceso por elemento puede convertir una solicitud en decenas o cientos de operaciones a PostgreSQL, aumentar la latencia y agotar el pool de conexiones.

El código actual ya usa correctamente `select`, `include`, `_count`, `createMany` y consultas agrupadas en varios puntos. Sin una política y pruebas de conteo, una modificación futura de DTO o serializer puede reintroducir accesos por elemento sin que los tests funcionales lo detecten.

## Auditoría del código actual

El conteo se expresa primero como llamadas lógicas Prisma del dominio. El SQL real debe medirse porque Prisma puede resolver relaciones mediante una o varias sentencias según versión, configuración y estrategia de carga. El costo fijo del middleware `auth` se registra por separado para no atribuirlo al endpoint.

| Caso real | Flujo actual | Operaciones estimadas del dominio | Riesgo | Decisión |
|---|---|---:|---|---|
| `POST /api/users/{userId}/roles` | `getById(userId)` → bucle `for roleId` → `addRoleToUser()` por elemento → `getById(userId)` | `N + 2` | Alto y comprobado; además ejecuta las escrituras secuencialmente | Corregir con validación agrupada y escritura por lote/transacción, conservando semántica de agregar |
| `GET /api/users` | `findMany` con `profile` y `userRoles.role` seleccionados + `count`; DTO mapea en memoria | 2, constante | Bajo; riesgo futuro si el DTO pide permisos u otra relación fuera del `select` | Conservar proyección selectiva y añadir prueba de crecimiento |
| `GET /api/users/{userId}` y `GET /api/users/{userId}/roles` | Un `findUnique` con perfil y roles; serializer usa relaciones ya cargadas | 1 llamada lógica, constante | Bajo; la ruta de roles carga más campos de usuario de los necesarios | Proyección específica para roles si la medición demuestra beneficio; no añadir permisos sin contrato |
| Snapshot de acceso de toda ruta protegida | `findUnique User` con `UserRole → Role → RolePermission → Permission`; deduplicación con `Map` en memoria | 1 llamada lógica, número SQL acotado | Medio por profundidad y frecuencia, pero no es N+1 en el código actual | Mantener carga anticipada selectiva y medir SQL/filas; evitar unir colecciones múltiples que generen producto cartesiano |
| `GET /api/roles` | `findMany` con `_count.permissions` + `count` total | 2, constante | Bajo | Conservar `_count`; no cargar permisos completos para un listado que solo muestra cantidad |
| `GET /api/roles/{roleId}` | `findFirst` con `RolePermission.permission` | 1 llamada lógica, constante | Bajo | Conservar carga anidada para detalle; seleccionar solo campos documentados |
| `GET /api/roles/{roleId}/permisos` | Carga el detalle completo del rol con permisos y pagina el array en memoria | 1 llamada lógica, constante | No es N+1, pero tiene riesgo de memoria y falsa paginación si el rol acumula muchos permisos | Consultar `RolePermission` paginado con `count` y `permission` selectivo; evitar cargar toda la relación |
| `GET /api/permisos` | `findMany` paginado + `count` | 2, constante | Bajo | Conservar consultas agrupadas |
| `GET /api/organizaciones` | `findMany` proyectado + `count` | 2, constante | Bajo | Conservar; no incluir sedes porque el DTO no las devuelve |
| `GET /api/organizaciones/{organizationId}/sedes` | `findMany` proyectado por organización + `count` | 2, constante | Bajo | Conservar filtro tenant y proyección |
| Crear/actualizar usuario con `roleIds` | Usuario → transacción `deleteMany` + `createMany` → recarga con roles | Cantidad constante respecto a N | Bajo; patrón de lote ya existente | Reutilizar el patrón cuando la semántica sea reemplazar roles |
| Asignar permisos a rol | Transacción `deleteMany` + `createMany` | Cantidad constante respecto a N | Bajo; patrón de lote ya existente | Conservar y probar atomicidad |

No existen controladores, DTO o serializers independientes adicionales: las API Routes actúan como handlers, los servicios construyen algunos DTO y las proyecciones viven en `database/`. No se documentan capas inexistentes.

## Caso N+1 confirmado

### Asignación múltiple de roles

Para `N` roles, el flujo actual del endpoint ejecuta aproximadamente:

```text
1 lectura del usuario con roles
N inserciones individuales UserRole
1 recarga del usuario con roles
= N + 2 llamadas Prisma de dominio
```

El middleware de autenticación añade su costo fijo de resolución de sesión y snapshot de acceso, pero no altera la pendiente. Con 1, 20 y 100 roles, el dominio realiza aproximadamente 3, 22 y 102 operaciones lógicas respectivamente.

La estrategia recomendada es:

1. Validar el usuario una vez.
2. Consultar todos los roles solicitados en una operación `findMany` con `id in (...)`, aplicando el alcance de organización cuando el contrato multi-tenant esté corregido.
3. Rechazar IDs inexistentes antes de escribir con el error controlado vigente.
4. Insertar las asignaciones con `createMany` dentro de una transacción.
5. Resolver duplicados según el contrato aprobado; no usar `skipDuplicates` para ocultar silenciosamente una violación no definida.
6. Recargar una sola vez la proyección exacta de respuesta.

El objetivo es un máximo de 4 operaciones lógicas de dominio, constante respecto a `N`: validar usuario, validar roles en lote, escribir lote y recargar. La corrección no debe reutilizar `assignRolesToUser()` sin revisar semántica, porque esa función reemplaza todas las asignaciones y el endpoint actual agrega roles.

## Estrategias por tipo de relación

### Uno a uno

- Usar `select` anidado cuando el DTO necesita la relación, como `User.profile`.
- Evitar una segunda consulta por cada padre.
- No cargar la relación si ningún campo aparece en el contrato de respuesta.
- Tratar relaciones opcionales como `null`/ausentes según el DTO actual, sin disparar carga diferida.

### Uno a muchos

- Para colecciones pequeñas y acotadas requeridas por un detalle, usar carga anticipada con `select` y límites explícitos cuando Prisma los soporte.
- Para relaciones potencialmente grandes, crear una consulta paginada del subrecurso; no cargar la colección completa y paginar después en memoria.
- Para conteos, usar `_count` o `count`, no cargar todos los hijos para ejecutar `.length`.
- No incluir simultáneamente varias colecciones de alta cardinalidad en un join si puede multiplicar filas.

### Muchos a muchos

- Consultar la tabla de unión con el lado relacionado mediante `select`/`include` controlado.
- Validar e insertar IDs mediante `in` y `createMany`, no con una consulta/escritura por ID.
- Deduplicar DTO solo cuando la relación lo requiera; no usar deduplicación para esconder duplicados persistidos incorrectamente.
- Mantener tenant y soft delete en la consulta raíz y relaciones aplicables.

### Agregaciones

- Usar `_count`, `count`, `groupBy` o agregaciones Prisma cuando el endpoint solo necesita totales.
- Ejecutar colección y total de paginación en un número constante de consultas; usar transacción solo si el contrato requiere un snapshot consistente entre ambas lecturas.
- Evitar una agregación por fila. Agrupar por los IDs de la página y reconstruir el resultado con un `Map` en memoria si una sola proyección no es suficiente.

## Selección de estrategia

El orden de preferencia es:

1. **Proyección `select` única** cuando el DTO necesita campos conocidos.
2. **Carga anticipada selectiva** para relaciones acotadas requeridas por el endpoint.
3. **`_count` o agregación** cuando solo se necesita un resumen.
4. **Consulta agrupada por IDs de la página** cuando un join produciría duplicación o Prisma no expresa la proyección de forma segura.
5. **Carga por lotes tipo DataLoader** únicamente cuando varias resoluciones independientes dentro de la misma solicitud no pueden consolidarse en el repositorio. Debe ser request-scoped, agrupar y ordenar resultados por ID, representar faltantes y no servir como caché global.

No se introduce DataLoader como dependencia ni abstracción por defecto: el repositorio actual puede resolver los casos encontrados con Prisma, `select`, `include`, `in`, `_count`, `createMany` y transacciones.

## Límites de amplitud

- `pageSize` máximo permanece en 100; ninguna optimización elimina paginación.
- Una consulta de listado no carga relaciones que el schema OpenAPI no devuelve.
- Como regla inicial, no cargar en una misma consulta más de una colección potencialmente no acotada. Si son necesarias varias, usar consultas agrupadas independientes y ensamblaje O(n) mediante `Map`.
- Toda consulta por lote usa exclusivamente IDs de la página o payload validado, nunca toda la tabla.
- Un array de IDs debe validarse, deduplicarse de forma explícita y limitarse al máximo admitido por el contrato antes de construir `in`/`createMany`.
- No paginar relaciones después de cargarlas completamente cuando puedan crecer. El caso actual de permisos de rol debe migrar a paginación en base de datos.
- Evitar `include: true` amplio. Preferir `select` con campos de DTO y relaciones mínimas.
- Medir filas transferidas y bytes además del número de consultas; una consulta constante con producto cartesiano no se considera optimizada.
- No usar SQL crudo para resolver estos casos. Si Prisma no permite una consulta segura, usar carga por lotes en la capa `database/`.

## Presupuesto de consultas

Se registran dos métricas:

- `Q_auth`: sentencias SQL del middleware de autenticación, constante para todas las rutas protegidas.
- `Q_domain(n)`: sentencias SQL atribuibles al endpoint/servicio después de auth.

La condición principal es que la pendiente sea cero: `Q_domain(100) - Q_domain(1) = 0` para lecturas y escrituras por lote optimizadas. Presupuestos lógicos máximos:

| Tipo de operación | Máximo de llamadas Prisma de dominio |
|---|---:|
| Listado paginado + total sin relaciones | 2 |
| Listado paginado + una relación/agrupación por lote | 3 |
| Detalle con relaciones requeridas | 2 |
| Subrecurso paginado + total | 3 |
| Asignación múltiple de roles corregida, incluida respuesta | 4 |

El presupuesto de sentencias SQL se fija en el test de baseline para la versión instalada de Prisma y debe permanecer constante entre tamaños 1, 20 y 100. Un cambio de versión puede modificar el número fijo de sentencias sin ser N+1; requiere actualizar el baseline con justificación, plan de consulta y métricas, no simplemente ampliar el umbral.

## Consistencia transaccional

- Las escrituras agrupadas que deben ser indivisibles usan `prisma.$transaction` en `database/`.
- Validación de IDs, inserción/reemplazo y lecturas necesarias para mantener invariantes se coordinan sin realizar escrituras por elemento.
- Si colección y `count` deben representar exactamente el mismo instante por requisito de negocio, se ejecutan en una transacción de lectura con el nivel compatible necesario; no se agrega transacción solo para reducir N+1.
- El DTO de respuesta posterior a una escritura se obtiene después del commit o dentro de la misma transacción cuando la consistencia lo exija y el repositorio lo soporte.
- Los errores de unicidad, integridad o negocio conservan sus códigos 409/422/404 y no exponen errores Prisma.

## Observabilidad y diagnóstico

En desarrollo, tests y diagnóstico controlado se contarán sentencias mediante eventos soportados por Prisma o instrumentación central en `database/client.ts`. Los logs Pino estructurados incluirán `requestId`, método, ruta normalizada, módulo, operación, `queryCount`, `queryDurationMs`, `dbDurationMs`, `rows` cuando sea seguro y `pageSize`; nunca SQL con parámetros sensibles, emails, tokens, cookies o credenciales.

Se alertará o registrará `warn` cuando una solicitud supere su presupuesto o cuando `queryCount` crezca con `pageSize`. El conteo detallado no debe habilitar logging de queries con datos en producción ni crear una segunda instancia de Prisma.

## Métricas comparativas esperadas

| Escenario | Antes | Objetivo |
|---|---:|---:|
| Asignar 1/20/100 roles | 3/22/102 operaciones lógicas de dominio | ≤ 4/4/4 |
| Listados existentes con 1/20/100 filas | 2/2/2 llamadas lógicas de dominio | Mantener 2/2/2 |
| Listado de roles con conteo de permisos | 2/2/2 | Mantener 2/2/2 y no cargar permisos completos |
| Permisos de un rol con 1/20/100 elementos | 1 llamada lógica, pero 1/20/100 objetos cargados antes de paginar | ≤ 3 consultas constantes y como máximo `pageSize` objetos materializados |

Además del conteo, las pruebas de rendimiento comparan p50/p95, tiempo acumulado de base, filas y memoria. Se espera que al pasar de 1 a 100 elementos la latencia aumente por volumen de datos, pero no por 100 viajes adicionales a PostgreSQL.

## Criterios de aceptación

- [ ] Existe un inventario reproducible de todas las rutas actuales con colecciones, relaciones, agregaciones o datos anidados, distinguiendo casos sanos, riesgos y N+1 confirmados.
- [ ] `POST /api/users/{userId}/roles` no ejecuta una escritura por `roleId`; su número de operaciones de dominio permanece en 4 o menos para 1, 20 y 100 IDs válidos.
- [ ] Los listados de usuarios, organizaciones, sedes, roles y permisos mantienen un número constante de consultas al variar `pageSize`.
- [ ] El listado de permisos de un rol pagina en PostgreSQL y no materializa la relación completa antes de aplicar página/límite.
- [ ] El snapshot de acceso carga únicamente usuario, perfil, roles y permisos necesarios, sin consultas por rol/permiso ni producto cartesiano no controlado.
- [ ] Todas las proyecciones coinciden con los DTO/OpenAPI existentes y no incorporan campos o relaciones no usados.
- [ ] Paginación, búsqueda, filtros, orden, tenant, soft delete, permisos y formato de respuesta permanecen sin cambios observables.
- [ ] Relaciones 1:1, 1:N y M:N siguen las reglas de carga y límites definidos en esta spec.
- [ ] Ninguna optimización usa Prisma desde API Routes o servicios, SQL crudo concatenado, una segunda instancia Prisma o una dependencia nueva.
- [ ] Las escrituras agrupadas conservan atomicidad y los errores existentes.
- [ ] Los tests fallan si `Q_domain(n)` crece linealmente al comparar tamaños 1, 20 y 100.
- [ ] Los presupuestos de consultas SQL se basan en medición de la versión instalada de Prisma y separan `Q_auth` de `Q_domain`.
- [ ] Logs diagnósticos reportan conteo y duración sin exponer SQL parametrizado ni datos sensibles.
- [ ] Las pruebas de rendimiento registran p50/p95, consultas, tiempo DB, filas/materialización y memoria antes/después.

### Documentación (obligatorio)

- [ ] Los schemas de respuesta existentes permanecen registrados en `documentation/schemas/users.ts`, `roles-permisos.ts` y `organizaciones-sedes.ts`.
- [ ] No se agregan campos internos de diagnóstico o rendimiento a los DTO de negocio.
- [ ] Los módulos siguen exportados desde `documentation/schemas/index.ts`.
- [ ] Los endpoints y schemas continúan visibles y correctos en `GET /api/docs` después de cualquier optimización futura.

## Fuera de alcance

- Implementar optimizaciones, instrumentación, migraciones o cambios de endpoint dentro de esta entrega documental.
- Crear endpoints, DTO, serializers, repositorios o modelos que no existan para justificar la feature.
- Cambiar contratos HTTP, paginación, permisos o nombres de rutas.
- Corregir el aislamiento `organizationId` de usuarios, el alcance de `UserRole` o la inconsistencia de permisos de la feature 010.
- Introducir DataLoader, SQL crudo, vistas materializadas, réplicas, caché Redis o índices sin evidencia separada.
- Optimizar operaciones que ya son constantes solo para reducir arbitrariamente una consulta fija.
