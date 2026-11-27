import sys
from pathlib import Path

# Permitir ejecución tanto desde la raíz (uvicorn backend.main:app) como desde backend/ (uvicorn main:app)
_root_dir = Path(__file__).resolve().parent.parent
if str(_root_dir) not in sys.path:
    sys.path.insert(0, str(_root_dir))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from backend.routers import auth, operativo, superadmin

app = FastAPI(
    title="Pet Grooming SaaS API",
    description="Backend POO Multi-Tenant, Multi-Sucursal y Consola Super Admin para gestión de estéticas caninas",
    version="0.5.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def disable_static_cache(request: Request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


app.include_router(auth.router)
app.include_router(operativo.router)
app.include_router(superadmin.router)


@app.get("/api/health", tags=["Health"])
def healthcheck():
    """Endpoint de verificación de estado del servicio."""
    return {
        "status": "ok",
        "version": "0.5.0",
        "service": "pet-grooming-saas-backend",
    }


# Servir landing page comercial en /landing (manteniendo la carpeta landing/ independiente)
_landing_dir = _root_dir / "landing"
if _landing_dir.is_dir():
    app.mount("/landing", StaticFiles(directory=str(_landing_dir), html=True), name="landing")

# Servir carpeta frontend/ como archivos estáticos en la raíz / al final de las rutas /api/*
_frontend_dir = _root_dir / "frontend"
if _frontend_dir.is_dir():
    app.mount("/", StaticFiles(directory=str(_frontend_dir), html=True), name="frontend")

