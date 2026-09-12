# Integración educativa con LM Studio

## Arquitectura

La aplicación Ionic envía DTOs estructurados al backend de Canchago. Después de autenticar,
autorizar y validar, el backend consulta PostgreSQL, reduce el contexto y llama al proveedor.
Ionic nunca conoce la URL, el modelo ni las instrucciones internas de LM Studio.

```text
Ionic → POST /api/ai/* → auth + permisos + Zod → services/ai → database/ai
                                                    ↓
                                              lib/ai → LM Studio
```

## Preparación local

1. Inicia LM Studio y carga un modelo que admita el endpoint de chat compatible con OpenAI.
2. Copia desde LM Studio la URL real del servidor y el identificador exacto del modelo.
3. Define `AI_LM_STUDIO_BASE_URL`, `AI_LM_STUDIO_MODEL` y, opcionalmente,
   `AI_PROVIDER_TIMEOUT_MS` en el entorno privado de `canchago`.
4. Inicia el backend y luego `canchago-ionic`. La app solo necesita su `VITE_API_BASE_URL` normal.

No se documenta un puerto o modelo fijo porque pertenecen a cada instalación. `localhost` desde
un dispositivo/emulador apunta al propio dispositivo, no al equipo de desarrollo. Esto no afecta
al diseño: únicamente el backend necesita conectividad con LM Studio. Si viven en equipos
distintos, revisa la dirección de escucha, firewall y red confiable. No publiques LM Studio en
Internet.

## Qué observar

- Ionic usa `apiClient` y Bearer/cookie según plataforma.
- La API valida permisos y el DTO antes de consultar datos o IA.
- `database/ai` selecciona únicamente franjas reales libres o reservas propias.
- `services/ai` construye contexto mínimo e instrucciones no controladas por el usuario.
- `lib/ai` aplica timeout y traduce errores del proveedor.
- La salida externa se valida y sus IDs se comparan contra el conjunto autorizado.
- Ionic muestra estados de carga, vacío, éxito y error sin interpretar HTML.

## Pruebas

Las pruebas automatizadas inyectan un `AiProvider` falso y no requieren un modelo. La prueba
manual con LM Studio es complementaria: ejecuta ambos flujos, detén el servidor y descarga el
modelo para comprobar los errores 503/504 y la degradación aislada.
