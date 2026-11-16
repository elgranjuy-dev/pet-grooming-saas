import hashlib
from typing import Any, Dict, Optional
from fastapi import APIRouter, Body, Depends, HTTPException, Query
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
        .select("id, nombre, plan, estado, max_sucursales, max_usuarios, max_clientes, email_propietario, created_at")
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
    usuario = None
    try:
        usuario = usuarios_repo.get_by_id(payload.usuario_id)
    except Exception:
        usuario = None

    if not usuario:
        # Fallback: buscar por nombre o tomar el usuario coincidente con el PIN en la sucursal
        todos = usuarios_repo.get_all(filters={"activo": True})
        for u in todos:
            if (
                str(u.get("id")) == str(payload.usuario_id)
                or str(u.get("nombre", "")).lower() == str(payload.usuario_id).lower()
                or str(u.get("pin", "")).strip() == str(payload.pin).strip()
            ):
                usuario = u
                break

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


@router.post("/auth/login")
@router.post("/login")
def login_universal(
    payload: Dict[str, Any] = Body(...),
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    """
    Endpoint compatible tanto con login de propietario (email + password)
    como con login operativo por PIN.
    """
    if payload.get("usuario_id") and payload.get("pin"):
        req = PinLoginRequest(
            organizacion_id=payload["organizacion_id"],
            sucursal_id=payload["sucursal_id"],
            usuario_id=payload["usuario_id"],
            pin=str(payload["pin"]),
        )
        return login_con_pin(req, db)

    identificador = (
        payload.get("email")
        or payload.get("usuario")
        or payload.get("username")
        or ""
    ).strip()
    secreto = str(
        payload.get("password") or payload.get("pin") or ""
    ).strip()

    if not identificador or not secreto:
        raise HTTPException(status_code=400, detail="Faltan credenciales de acceso.")

    # 1. Intentar autenticar como propietario de organización (email_propietario + password_hash)
    secreto_sha256 = hashlib.sha256(secreto.encode("utf-8")).hexdigest()
    orgs_res = (
        db.table("organizaciones")
        .select("*")
        .ilike("email_propietario", identificador)
        .limit(1)
        .execute()
    )
    if orgs_res.data:
        org = orgs_res.data[0]
        stored_hash = str(org.get("password_hash") or "").strip()
        if stored_hash in (secreto, secreto_sha256):
            sucs = (
                db.table("sucursales")
                .select("*")
                .eq("organizacion_id", org["id"])
                .eq("activa", True)
                .limit(1)
                .execute()
                .data
                or []
            )
            suc = sucs[0] if sucs else {}
            usrs = (
                db.table("usuarios_crm")
                .select("*")
                .eq("organizacion_id", org["id"])
                .eq("activo", True)
                .limit(1)
                .execute()
                .data
                or []
            )
            usr = usrs[0] if usrs else {
                "id": org["id"],
                "organizacion_id": org["id"],
                "sucursal_id": suc.get("id", ""),
                "nombre": org.get("nombre", "Propietario"),
                "rol": "Dueño",
            }
            return {
                "autenticado": True,
                "organizacion": {k: v for k, v in org.items() if k != "password_hash"},
                "sucursal": suc,
                "usuario": {k: v for k, v in usr.items() if k != "pin"},
                "mensaje": f"Bienvenido a {org.get('nombre')}",
            }

    # 2. Intentar autenticar contra usuarios_crm por nombre + PIN
    usrs_res = (
        db.table("usuarios_crm")
        .select("*")
        .ilike("nombre", f"%{identificador}%")
        .eq("activo", True)
        .execute()
    )
    for u in usrs_res.data or []:
        if str(u.get("pin", "")).strip() == secreto:
            req = PinLoginRequest(
                organizacion_id=u["organizacion_id"],
                sucursal_id=u["sucursal_id"],
                usuario_id=u["id"],
                pin=secreto,
            )
            return login_con_pin(req, db)

    raise HTTPException(status_code=401, detail="Credenciales o PIN incorrectos.")
