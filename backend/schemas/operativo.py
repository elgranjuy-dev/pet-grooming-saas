from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ContextoOperativoMixin(BaseModel):
    """Campos opcionales de contexto multi-tenant y auditoría en cuerpo de peticiones."""
    organizacion_id: Optional[str] = None
    sucursal_id: Optional[str] = None
    usuario_actual: Optional[str] = "Sistema"
    rol_actual: Optional[str] = "Operativo"


class PinLoginRequest(BaseModel):
    organizacion_id: str
    sucursal_id: str
    usuario_id: str
    pin: str = Field(..., min_length=1)


class TenantLoginRequest(BaseModel):
    usuario: str = Field(..., min_length=2)
    password: str = Field(..., min_length=1)
    subdominio: Optional[str] = None
    organizacion_id: Optional[str] = None
    sucursal_id: Optional[str] = None


class ClienteCreate(ContextoOperativoMixin):
    nombre: str
    telefono: str
    email: Optional[str] = ""
    notas: Optional[str] = ""


class MascotaCreate(ContextoOperativoMixin):
    cliente_id: str
    nombre: str
    raza: str
    peso_kg: Optional[float] = 0.0
    edad: Optional[str] = ""
    alergias_medicas: Optional[str] = "Ninguna"
    temperamento: Optional[str] = "Dócil"
    numero_navaja: Optional[str] = ""
    tipo_shampoo: Optional[str] = ""
    estilo_corte: Optional[str] = ""


class CitaCreate(ContextoOperativoMixin):
    mascota_id: str
    fecha_hora: str
    servicio: str
    duracion_minutos: Optional[int] = 60
    estilista: Optional[str] = "Por asignar"
    precio: float = 0.0
    estado: Optional[str] = "Programada"
    notas_servicio: Optional[str] = ""


class CitaCompletar(ContextoOperativoMixin):
    metodo_pago: str = "Efectivo"
    monto: Optional[float] = None
    estilista: Optional[str] = None
    notas_servicio: Optional[str] = None
    etapa_estancia: Optional[str] = None


class CitaUpdate(ContextoOperativoMixin):
    fecha_hora: Optional[str] = None
    servicio: Optional[str] = None
    duracion_minutos: Optional[int] = None
    estilista: Optional[str] = None
    precio: Optional[float] = None
    estado: Optional[str] = None
    etapa_estancia: Optional[str] = None
    notas_servicio: Optional[str] = None



class CajaManualCreate(ContextoOperativoMixin):
    concepto: str
    monto: float
    metodo_pago: str = "Efectivo"
    estilista: Optional[str] = "General"
    cita_id: Optional[str] = None


class ProductoCreate(ContextoOperativoMixin):
    nombre: str
    categoria: str = "Insumo"
    stock: int = 0
    stock_minimo: int = 5
    precio_venta: float = 0.0


class EscaneoRequest(ContextoOperativoMixin):
    codigo: str
    accion: Optional[str] = "consulta"  # consulta | descontar_insumo | vender_producto
    cantidad: Optional[int] = 1
    metodo_pago: Optional[str] = "Efectivo"


class UsuarioCreate(ContextoOperativoMixin):
    nombre: str
    rol: str = "Estilista"
    pin: str = Field(..., min_length=3)
    activo: Optional[bool] = True


class UsuarioUpdate(ContextoOperativoMixin):
    nombre: Optional[str] = None
    rol: Optional[str] = None
    pin: Optional[str] = None
    activo: Optional[bool] = None
    nueva_sucursal_id: Optional[str] = None


class CheckOutRequest(ContextoOperativoMixin):
    asistencia_id: Optional[str] = None
    usuario_id: Optional[str] = None
    monto_corte_caja: Optional[float] = 0.0


class AgendaConfigUpdate(ContextoOperativoMixin):
    modo_asignacion: str = "global"
    intervalo_minutos: int = 60


class PlantillaDiaItem(BaseModel):
    id: Optional[str] = None
    dia_semana: int
    nombre_dia: Optional[str] = None
    activo: bool = True
    hora_apertura: str = "09:00:00"
    hora_cierre: str = "18:00:00"
    estilistas_activos: int = 2
    comida_inicio: str = "14:00:00"
    comida_fin: str = "15:00:00"
    estilistas_en_comida: int = 1


class PlantillaDiaUpdate(ContextoOperativoMixin):
    # Soporta tanto actualización de un día individual como lista de días
    id: Optional[str] = None
    dia_semana: Optional[int] = None
    nombre_dia: Optional[str] = None
    activo: Optional[bool] = True
    hora_apertura: Optional[str] = "09:00:00"
    hora_cierre: Optional[str] = "18:00:00"
    estilistas_activos: Optional[int] = 2
    comida_inicio: Optional[str] = "14:00:00"
    comida_fin: Optional[str] = "15:00:00"
    estilistas_en_comida: Optional[int] = 1
    dias: Optional[List[PlantillaDiaItem]] = None


class ExcepcionCreate(ContextoOperativoMixin):
    fecha: str
    cerrado_todo_el_dia: bool = False
    hora_inicio: Optional[str] = None
    hora_fin: Optional[str] = None
    estilistas_disponibles: int = 0
    motivo: Optional[str] = ""


class ServicioCreate(ContextoOperativoMixin):
    nombre: str
    duracion_minutos: int = 60
    precio_base: float = 0.0
    activo: Optional[bool] = True


class PerfilPermisosInput(ContextoOperativoMixin):
    nombre: str = Field(..., min_length=2)
    nuevo_nombre: Optional[str] = None
    descripcion: Optional[str] = ""
    niveles: Optional[Dict[str, str]] = None
    permisos: Dict[str, bool] = Field(default_factory=dict)


class MatrizPerfilesBatchInput(ContextoOperativoMixin):
    perfiles: List[Dict[str, Any]] = Field(default_factory=list)


