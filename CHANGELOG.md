# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

## [v0.2.0] - 2026-11-15 - Backend POO Multi-Tenant Fase 1

### Added
- `backend/core/database.py`: Clase `SupabaseClientManager` (patrón Singleton) para conexión centralizada a Supabase desde `backend/.env`.
- `backend/core/security.py`: Clase `SecurityManager` con generación de hash de lealtad (`generar_hash_lealtad` SHA-256 truncado a 12 caracteres con prefijo `PET-`) y bitácora de auditoría (`registrar_auditoria`).
- `backend/repositories/base.py`: Repositorios base `OrganizationRepository` (aislamiento por `organizacion_id`) y `BranchRepository` (aislamiento estricto por `organizacion_id` y `sucursal_id`).
- `backend/schemas/operativo.py`: Esquemas Pydantic para login con PIN, clientes, mascotas, citas, caja, inventario, escaneo, personal, checkout de asistencias y configuración de agenda.
- `backend/services/disponibilidad.py`: Motor `AvailabilityEngine` para cálculo de horarios disponibles cruzando `agenda_plantilla_semanal`, `agenda_excepciones`, horario de comida de estilistas y traslape de `citas`.
- `backend/routers/auth.py`: Endpoints `/api/contexto-inicial`, `/api/sucursales/{sucursal_id}/usuarios` y `/api/auth/login-pin`.
- `backend/routers/operativo.py`: Endpoints operativos para `/api/dashboard`, `/api/clientes/buscar`, `/api/clientes`, `/api/mascotas`, `/api/disponibilidad`, `/api/citas`, `/api/inventario`, `/api/escanear`, `/api/caja`, `/api/agenda-config`, `/api/personal` y `/api/checkout`.
- `backend/main.py`: Aplicación FastAPI con CORS habilitado, montaje de routers y healthcheck `GET /api/health`.

## [v0.1.0] - 2026-11-15

### Added
- Estructura base del proyecto SaaS (`backend/` y `frontend/`).
- Configuración inicial de Git y `.gitignore`.
- Documentación inicial (`README.md` y `CHANGELOG.md`).
