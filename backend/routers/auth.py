from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import Client
from backend.core.database import get_db
from backend.core.security import SecurityManager
from backend.repositories.base import BranchRepository
from backend.schemas.operativo import PinLoginRequest

router = APIRouter(prefix="/api", tags=["Autenticación y Contexto"])


@router.get("/contexto-inicial")
def obtener_contexto_inicial(db: Client = Depends(get_db)) -> Dict[str, Any]:
    """
    Devuelve las organizaciones activas y sus sucursales activas
    para poblar el selector de inicio de sesión.
    """
    orgs_res = (
        db.table("organizaciones")
        .select("*")
        .eq("estado", "Activa")
        .order("nombre")
        .execute()
    )
    organizaciones = orgs_res.data or []

    sucs_res = (
        db.table("sucursales")
        .select("*")
        .eq("activa", True)
        .order("nombre")
        .execute()
    )
    sucursales = sucs_res.data or []

    # Agrupar sucursales dentro de cada organización además de exponer listas planas
    sucs_por_org: Dict[str, list] = {}
    for suc in sucursales:
        oid = suc.get("organizacion_id")
        if oid:
            sucs_por_org.setdefault(oid, []).append(suc)

    organizaciones_con_sucursales = [
        {**org, "sucursales": sucs_por_org.get(org["id"], [])}
        for org in organizaciones
    ]

    return {
        "organizaciones": organizaciones_con_sucursales,
        "sucursales": sucursales,
    }


@router.get("/sucursales/{sucursal_id}/usuarios")
def listar_usuarios_sucursal(
    sucursal_id: str,
    organizacion_id: Optional[str] = Query(default=None),
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    """Lista los usuarios activos asignados a una sucursal específica."""
    query = (
        db.table("usuarios_crm")
        .select("id, organizacion_id, sucursal_id, nombre, rol, activo, created_at")
        .eq("sucursal_id", sucursal_id)
        .eq("activo", True)
    )
    if organizacion_id:
        query = query.eq("organizacion_id", organizacion_id)

    res = query.order("nombre").execute()
    usuarios = res.data or []
    return {"usuarios": usuarios, "total": len(usuarios)}


@router.post("/auth/login-pin")
def login_con_pin(
    payload: PinLoginRequest,
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    """
    Valida el PIN del usuario en la sucursal seleccionada,
    registra su entrada en la tabla asistencias y guarda evento en bitácora de auditoría.
    """
    usuarios_repo = BranchRepository(
        db, "usuarios_crm", payload.organizacion_id, payload.sucursal_id
    )
    usuario = usuarios_repo.get_by_id(payload.usuario_id)

    if not usuario or not usuario.get("activo", True):
        raise HTTPException(
            status_code=404,
            detail="Usuario no encontrado o inactivo en esta sucursal.",
        )

    if str(usuario.get("pin", "")).strip() != str(payload.pin).strip():
        SecurityManager.registrar_auditoria(
            db=db,
            org_id=payload.organizacion_id,
            suc_id=payload.sucursal_id,
            usuario=usuario.get("nombre", "Desconocido"),
            rol=usuario.get("rol", "Operativo"),
            accion="LOGIN_FALLIDO",
            detalle="Intento de acceso con PIN incorrecto",
        )
        raise HTTPException(status_code=401, detail="PIN incorrecto.")

    # Registrar entrada en asistencias
    asistencias_repo = BranchRepository(
        db, "asistencias", payload.organizacion_id, payload.sucursal_id
    )
    asistencia = asistencias_repo.insert(
        {
            "usuario_id": usuario["id"],
            "usuario_nombre": usuario["nombre"],
            "rol": usuario["rol"],
        }
    )

    # Registrar auditoría
    SecurityManager.registrar_auditoria(
        db=db,
        org_id=payload.organizacion_id,
        suc_id=payload.sucursal_id,
        usuario=usuario["nombre"],
        rol=usuario["rol"],
        accion="LOGIN_EXITOSO",
        detalle=f"Inicio de turno registrado (asistencia_id={asistencia.get('id')})",
    )

    usuario_seguro = {k: v for k, v in usuario.items() if k != "pin"}
    return {
        "autenticado": True,
        "usuario": usuario_seguro,
        "asistencia": asistencia,
        "mensaje": f"Bienvenido(a), {usuario['nombre']}",
    }
