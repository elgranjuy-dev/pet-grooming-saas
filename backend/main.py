import sys
from pathlib import Path

# Permitir ejecución tanto desde la raíz (uvicorn backend.main:app) como desde backend/ (uvicorn main:app)
_root_dir = Path(__file__).resolve().parent.parent
if str(_root_dir) not in sys.path:
    sys.path.insert(0, str(_root_dir))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from backend.routers import auth, operativo

app = FastAPI(
    title="Pet Grooming SaaS API",
    description="Backend POO Multi-Tenant y Multi-Sucursal para gestión de estéticas caninas",
    version="0.3.1",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(operativo.router)


@app.get("/api/health", tags=["Health"])
def healthcheck():
    """Endpoint de verificación de estado del servicio."""
    return {
        "status": "ok",
        "version": "0.3.1",
        "service": "pet-grooming-saas-backend",
    }


# Servir carpeta frontend/ como archivos estáticos en la raíz / al final de las rutas /api/*
_frontend_dir = _root_dir / "frontend"
if _frontend_dir.is_dir():
    app.mount("/", StaticFiles(directory=str(_frontend_dir), html=True), name="frontend")
