# Misión

_Proveer una plataforma multiempresa robusta y altamente escalable para la gestión y agendamiento de espacios deportivos, diseñada desde su núcleo para ser agnóstica al tipo de recurso y expandible a cualquier modelo de negocio físico._

## Qué construimos

Construimos un sistema SaaS (Software as a Service) modular que automatiza la administración de complejos deportivos, resolviendo el problema de las reservas solapadas, el control de acceso complejo y la inflexibilidad de los sistemas tradicionales al crecer hacia nuevas disciplinas.

1. **Motor de Reservas Agnóstico** — Un núcleo que gestiona disponibilidad, bloqueos y reglas de tiempo basado en "recursos" genéricos, permitiendo reservar desde una cancha de fútbol sala hasta una piscina o un entrenador, sin alterar la estructura base.
2. **Arquitectura Multi-tenant y RBAC** — Un sistema de control de accesos basado en roles y menús dinámicos que permite a una sola instancia de software operar múltiples organizaciones (empresas) y sus respectivas sedes (venues) con total aislamiento y seguridad.
3. **Plataforma Base Extensible** — Una base de datos y API (documentada estrictamente bajo contratos OpenAPI) lista para acoplar módulos futuros como pagos en línea, facturación y gestión de torneos, sin romper el flujo principal.

## Para quién

- **Administradores y dueños de complejos deportivos:** Buscan centralizar sus operaciones, controlar múltiples sedes desde un solo lugar, evitar choques de horarios y gestionar los permisos de su personal (recepcionistas, gerentes) con precisión.

- **Deportistas y clientes finales:** Buscan una experiencia digital rápida y sin fricciones (vía web o móvil) para encontrar disponibilidad, reservar y pagar espacios deportivos en tiempo real.

- **Equipos de desarrollo e integración:** Se benefician de una API predecible y fuertemente tipada que permite a equipos de frontend y aplicaciones consumir servicios sin bloqueos ni ambigüedades.

## Principios

- **El Recurso sobre la Cancha (Abstracción por diseño)** — Nunca limitamos el código o la base de datos a "canchas" (`courts`). Todo elemento reservable es un `resource`. Esto garantiza que la plataforma escale a cualquier modelo de negocio (tenis, gimnasios, implementos) de forma nativa.

- **El Contrato es la Ley (Spec-Driven Development)** — Ningún endpoint se programa, ni ninguna validación de payload se escribe a mano, sin antes haber definido y aprobado el contrato. Esto asegura fiabilidad, pruebas automatizadas y aislamiento entre capas.

- **Modularidad Intransigente** — Los dominios de negocio (Autenticación, Reservas, Pagos, RRHH) viven en silos funcionales estrictos dentro del monolito. Si un módulo falla o necesita ser extraído a un microservicio en el futuro, el resto del ecosistema no colapsa.

- **Trazabilidad y Control Total** — Todo cambio de estado en una reserva, transacción o permiso queda registrado (auditoría, UUIDs, soft deletes). Nada desaparece de la base de datos, asegurando un historial limpio para la resolución de conflictos.

## Qué NO es

- NO es un simple formulario de contacto o un calendario estático para un solo establecimiento local.

- NO es (en su MVP) una red social para buscar jugadores, ni un gestor complejo de ligas y campeonatos (aunque la arquitectura deja la puerta abierta para integrarlo en fases posteriores).

- NO es un sistema de código acoplado donde las reglas de presentación (UI) dicten la lógica del negocio o la estructura interna de la base de datos.
