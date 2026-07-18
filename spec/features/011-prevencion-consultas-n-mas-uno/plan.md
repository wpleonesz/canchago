# 012 · Prevención de Consultas N+1 — Plan

_Cómo se implementará lo descrito en `spec.md`. Esta entrega crea únicamente documentación._

## Enfoque

Establecer primero un baseline de sentencias SQL y llamadas Prisma por solicitud, separado entre autenticación y dominio. Después corregir el único patrón lineal confirmado y los casos de sobreconsulta relacionados, sin convertir la solución en carga indiscriminada de relaciones.

Las optimizaciones vivirán en `database/`; los servicios coordinan reglas y transacciones, y las API Routes conservan validación, autorización y respuesta. Se reutilizan capacidades presentes de Prisma (`select`, `include`, `_count`, `in`, `createMany`, `$transaction`) y el helper de paginación. No se agrega infraestructura ni dependencia.

## Implementación futura

1. **Baseline de consultas** — Añadir en tests un contador soportado por la instancia única de `database/client.ts`. Etiquetar o delimitar la fase de `auth` y la llamada del dominio para obtener `Q_auth` y `Q_domain`. Medir tamaños 1, 20 y 100 con la feature de caché Redis deshabilitada o en bypass si se implementa primero.

2. **Inventario automatizable** — Revisar `pages/api/`, `services/` y `database/` buscando `await` dentro de bucles, `map(async)`, resoluciones de relación por ID y serializers que accedan a datos no proyectados. Registrar cada excepción intencional y presupuesto en su test de módulo.

3. **`validations/users/index.ts`** — Conservar la validación UUID de `roleIds` y definir un máximo explícito compatible con el límite probado. Decidir y documentar si IDs duplicados producen 422 o se normalizan antes de escribir; no ocultarlos accidentalmente.

4. **`database/users/index.ts`** — Crear una operación de agregado por lote para roles que:
   - compruebe el usuario una vez;
   - consulte roles mediante `findMany({ where: { id: { in: roleIds } } })` con el alcance aprobado;
   - compare IDs solicitados y encontrados;
   - inserte relaciones con `createMany` dentro de una transacción;
   - devuelva o permita recargar la proyección mínima documentada.

   No reutilizar `assignRolesToUser()` si ello reemplaza roles existentes, porque `POST /users/{userId}/roles` actualmente agrega.

5. **`services/users/index.ts`** — Exponer una operación de negocio `addRolesToUser` que coordine validación de integridad, conflicto/duplicado y respuesta. Dejar de reexportar la escritura unitaria desde `database/` para este flujo.

6. **`pages/api/users/[userId]/roles/index.ts`** — Sustituir el bucle de inserciones por una sola llamada al servicio. Mantener `auth`, `access('users.manage')`, schemas Zod, 201 y forma `{ data: roles }`.

7. **`database/users/index.ts` y `services/users/index.ts`** — Revisar `selectUserFields` frente a cada DTO. Mantener `profile` y `userRoles.role` donde se usan; crear una proyección específica para roles del usuario si evita columnas no utilizadas sin duplicar lógica compleja.

8. **`database/roles-permisos/role.db.ts`** — Mantener `_count.permissions` en listados. Para detalle, reemplazar `include` amplio por `select` de campos registrados en `RoleDetailSchema` si la medición confirma columnas sobrantes.

9. **`database/roles-permisos/permission.db.ts`** — Implementar consulta paginada de permisos por `roleId` con `skip`, `take`, orden estable, `permission` selectivo y `count` filtrado. No cargar toda la relación para luego aplicar `.slice()`.

10. **`services/roles-permisos/permission.service.ts`** — Exponer el subrecurso paginado y retornar datos/meta del dominio sin conocer HTTP.

11. **`pages/api/roles/[roleId]/permisos/index.ts`** — Usar el servicio paginado en GET, conservar validación, organización, permiso `roles.read`, metadata y errores 404/422. Antes de optimizar PATCH, mover el acceso directo a `rolePermissionDb` detrás del servicio conforme a la constitución.

12. **`database/users.getSessionUser()`** — Medir sentencias, filas y plan de la relación anidada `UserRole → RolePermission`. Mantener un número constante. Si la estrategia de join multiplica filas, preferir dos cargas agrupadas por IDs o selección separada acotada; no realizar una consulta por rol.

13. **Organizaciones y sedes** — Mantener sus listados en `findMany + count`, sin `include` de relaciones ausentes en los DTO. Añadir tests de presupuesto para prevenir regresiones futuras.

14. **Consistencia** — Mantener escrituras masivas dentro de `$transaction`. Si colección y conteo requieren snapshot consistente por contrato, usar una transacción de lectura compatible; documentar la decisión por endpoint.

15. **Observabilidad** — Agregar métricas/logs de conteo en el cliente central o contexto de request sin crear otro PrismaClient. El modo detallado queda limitado a tests/desarrollo o muestreo seguro; producción nunca registra parámetros sensibles.

16. **OpenAPI** — Verificar `documentation/schemas/users.ts`, `roles-permisos.ts` y `organizaciones-sedes.ts`. Las optimizaciones no cambian schemas. Corregir documentación únicamente si se descubre una deriva preexistente y con alcance explícito, no como efecto colateral.

17. **Pruebas** — Añadir unitarios de proyección/ensamblaje, integración con contador SQL y rendimiento con datasets controlados de 1, 20 y 100 elementos.

## Pseudoflujos

### Detección

```text
para cada endpoint candidato:
  ejecutar con 1 elemento → registrar Q_auth, Q_domain, filas y tiempo DB
  ejecutar con 20 elementos → registrar las mismas métricas
  ejecutar con 100 elementos → registrar las mismas métricas
  si Q_domain crece con N → N+1 confirmado
  si Q es constante pero filas/memoria crecen desproporcionadamente → sobreconsulta/producto cartesiano
  guardar presupuesto como aserción de test
```

### Carga agrupada de relaciones

```text
parents = database.listPage(filters)
parentIds = parents.map(id)
relations = database.listRelations({ parentId in parentIds })
relationsByParent = groupBy Map
dto = parents.map(parent => combine(parent, relationsByParent.get(parent.id) ?? []))
```

La reconstrucción debe ser O(n + r), preservar el orden de padres y relaciones definido por contrato y representar padres sin hijos.

### Asignación de roles corregida

```text
service.addRolesToUser(userId, roleIds)
  normalizar/validar lote
  transaction:
    validar usuario
    roles = findMany id in roleIds + alcance
    comprobar faltantes/duplicados
    createMany UserRole
  recargar proyección de roles una vez
```

## Presupuestos y gates

- Cada prueba de integración declara un presupuesto de llamadas Prisma y sentencias SQL por módulo.
- Para 1, 20 y 100 elementos, la diferencia de `Q_domain` debe ser cero.
- Listado simple: máximo 2 llamadas Prisma; con relación agrupada: máximo 3.
- Detalle: máximo 2; subrecurso paginado: máximo 3.
- Agregado de roles: máximo 4, independientemente del tamaño del lote.
- Un presupuesto no se eleva por conveniencia. Requiere explicación del cambio de Prisma/contrato, plan de consulta y evidencia de que sigue siendo constante.
- El gate de rendimiento compara p95 y tiempo DB contra baseline con tolerancia definida en el entorno de CI; el conteo de consultas es el gate determinista principal.

## Decisiones

- **Medir SQL y llamadas lógicas** — Un `include` puede traducirse en distinta cantidad fija de SQL. Ambas métricas evitan falsos positivos y detectan regresiones reales.
- **Separar autenticación y dominio** — `sessionService.resolve()` agrega consultas fijas a toda ruta protegida. Separarlo permite atribuir correctamente el costo.
- **Proyección antes que include amplio** — El DTO define los campos necesarios; evitar columnas/relaciones sobrantes reduce transferencia y productos cartesianos.
- **Lote antes que DataLoader** — Los casos actuales pueden agruparse directamente en repositorios Prisma. DataLoader solo se evaluará para resoluciones request-scoped realmente independientes.
- **Paginación en base de datos** — Un subrecurso creciente no debe materializarse completo y cortarse en memoria.
- **Conteo constante, no necesariamente una sola consulta** — Dos o tres consultas agrupadas suelen ser más seguras que un join de varias colecciones con duplicación de filas.
- **Sin cambio de contrato** — La mejora es interna; permisos, errores y OpenAPI se conservan.

## Riesgos

- **Falso positivo por estrategia de Prisma** — Un `include` puede emitir varias consultas constantes. Mitigación: comparar la pendiente entre tamaños y registrar versión/configuración.
- **Producto cartesiano** — Un join de varias relaciones M:N puede multiplicar filas. Mitigación: una sola colección no acotada por consulta o cargas agrupadas separadas.
- **Orden alterado** — Agrupar en `Map` puede perder el orden contractual. Mitigación: ordenar en DB y reconstruir siguiendo el orden de padres.
- **Duplicados o faltantes** — `createMany` puede ocultarlos si se usa `skipDuplicates`. Mitigación: política explícita y validación previa.
- **Carrera entre validación y escritura** — Un rol puede cambiar entre ambas. Mitigación: transacción y constraints; traducir el error Prisma a error controlado.
- **Instrumentación costosa o sensible** — Logging SQL puede degradar rendimiento/exponer datos. Mitigación: contador central, campos redactados y modo limitado.
- **Tests inestables de tiempo** — CI comparte recursos. Mitigación: usar conteo como gate duro y latencia como comparación con tolerancia/baseline.
- **Deuda previa** — Alcance de roles, permisos inconsistentes y build están registrados en 010. Mitigación: no mezclarlos; declarar prerequisitos para las pruebas afectadas.
