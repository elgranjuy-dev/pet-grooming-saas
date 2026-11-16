from typing import Optional
from pydantic import BaseModel, Field


class SuperAdminLoginRequest(BaseModel):
    email: str
    password: str


class TenantOnboardingCreate(BaseModel):
    nombre: str = Field(..., min_length=2, description="Nombre comercial de la estética")
    plan: str = "Pro"  # Básico | Pro | Enterprise
    max_sucursales: Optional[int] = None
    max_usuarios: Optional[int] = None
    max_clientes: Optional[int] = None
    email_propietario: str
    password_propietario: str = "admin1234"
    nombre_sucursal_inicial: str = "Sucursal Matriz"
    direccion_sucursal: Optional[str] = "Ciudad Principal"
    telefono_sucursal: Optional[str] = ""
    nombre_dueno_inicial: str = "Administrador Principal"
    pin_dueno_inicial: str = "1234"


class TenantUpdate(BaseModel):
    nombre: Optional[str] = None
    plan: Optional[str] = None
    estado: Optional[str] = None  # Activa | Suspendida
    max_sucursales: Optional[int] = None
    max_usuarios: Optional[int] = None
    max_clientes: Optional[int] = None
    email_propietario: Optional[str] = None
    password_propietario: Optional[str] = None


class SucursalTenantCreate(BaseModel):
    nombre: str
    direccion: Optional[str] = ""
    telefono: Optional[str] = ""
    nombre_encargado: Optional[str] = "Encargado de Sucursal"
    pin_encargado: Optional[str] = "1234"
