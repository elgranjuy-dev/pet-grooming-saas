import hashlib
import re
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query
from supabase import Client
from backend.core.database import get_db
from backend.core.security import SecurityManager
from backend.repositories.base import BranchRepository
from backend.schemas.operativo import PinLoginRequest

router = APIRouter(prefix="/api", tags=["Autenticación y Contexto"])

# Hashes aceptados equivalentes para compatibilidad con el script SQL manual
_LEGACY_SQL_HASHES = {
    "ac9689e2272427085e35b9d3e3e8be88cb3d895416747bc1447e5daf139b2e72",
    hashlib.sha256(b"admin1234").hexdigest(),
    hashlib.sha256(b"admin123").hexdigest(),
}


def _slugify(texto: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (texto or "").lower())


def _resolver_org_por_subdominio(
    organizaciones: List[Dict[str, Any]],
    subdominio: Optional[str] = None,
    host: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Identifica el tenant (organización) a partir del subdominio o parámetro tenant.
    Ej. 'thebluedog.tudominio.com' -> 'thebluedog' -> 'The Blue Dog'
    """
    candidato = (subdominio or "").strip().lower()
    if not candidato and host:
        host_clean = host.split(":")[0].strip().lower()
        partes = host_clean.split(".")
        if len(partes) >= 2 and partes[0] not in ("www", "localhost", "127", "app", "api"):
            candidato = partes[0]

    slug_buscado = _slugify(candidato)
    if slug_buscado:
        for org in organizaciones:
            nombre_slug = _slugify(org.get("nombre", ""))
            email_prop = (org.get("email_propietario") or "").lower()
            dominio_email = _slugify(email_prop.split("@")[1].split(".")[0]) if "@" in email_prop else ""
            if (
                slug_buscado == nombre_slug
                or slug_buscado == dominio_email
                or slug_buscado in nombre_slug
                or str(org.get("id", "")).lower() == candidato
            ):
                return org

    return organizaciones[0] if organizaciones else None


@router.get("/contexto-inicial")
def obtener_contexto_inicial(
    tenant: Optional[str] = Query(default=None),
    subdominio: Optional[str] = Query(default=None),
    host: Optional[str] = Header(default=None),
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    """
    Devuelve la organización detectada por subdominio y sus sucursales activas.
    """
    orgs_res = (
        db.table("organizaciones")
        .select(
            "id, nombre, plan, estado, max_sucursales, max_usuarios, max_clientes, email_propietario, created_at"
        )
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
        {
            **org,
            "subdominio": _slugify(org.get("nombre", "")),
            "sucursales": sucs_por_org.get(org["id"], []),
        }
        for org in organizaciones
    ]

    tenant_detectado = _resolver_org_por_subdominio(
        organizaciones_con_sucursales, tenant or subdominio, host
    )

    return {
        "tenant_detectado": tenant_detectado,
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


def _construir_sesion_completa(
    db: Client,
    org: Dict[str, Any],
    usuario: Dict[str, Any],
    sucursal_preferida_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Valida estado del tenant (Kill-Switch), resuelve sucursal activa,
    registra entrada en asistencias y bitácora, y devuelve el payload de sesión.
    """
    if str(org.get("estado", "Activa")).lower() != "activa":
        raise HTTPException(
            status_code=403,
            detail=f"La cuenta de '{org.get('nombre')}' se encuentra suspendida. Contacta al soporte del SaaS.",
        )

    sucs = (
        db.table("sucursales")
        .select("*")
        .eq("organizacion_id", org["id"])
        .eq("activa", True)
        .order("created_at")
        .execute()
        .data
        or []
    )
    if not sucs:
        raise HTTPException(
            status_code=404,
            detail="Esta organización no tiene sucursales activas configuradas.",
        )

    suc_id_obj = sucursal_preferida_id or usuario.get("sucursal_id")
    sucursal = next((s for s in sucs if s["id"] == suc_id_obj), sucs[0])

    asistencias_repo = BranchRepository(db, "asistencias", org["id"], sucursal["id"])
    asistencia = {}
    if usuario.get("id") and usuario.get("id") != org["id"]:
        try:
            asistencia = asistencias_repo.insert(
                {
                    "usuario_id": usuario["id"],
                    "usuario_nombre": usuario["nombre"],
                    "rol": usuario["rol"],
                }
            )
        except Exception:
            asistencia = {}

    SecurityManager.registrar_auditoria(
        db=db,
        org_id=org["id"],
        suc_id=sucursal["id"],
        usuario=usuario["nombre"],
        rol=usuario["rol"],
        accion="LOGIN_EXITOSO",
        detalle=f"Inicio de sesión ({usuario['rol']}) en {sucursal.get('nombre')}",
    )

    usuario_seguro = {k: v for k, v in usuario.items() if k != "pin"}
    org_clean = {k: v for k, v in org.items() if k != "password_hash"}

    return {
        "autenticado": True,
        "ok": True,
        "organizacion": {
            **org_clean,
            "subdominio": _slugify(org.get("nombre", "")),
            "sucursales": sucs,
        },
        "organizacion_id": org["id"],
        "organizacion_nombre": org["nombre"],
        "plan": org.get("plan", "Pro"),
        "sucursal": sucursal,
        "sucursal_id": sucursal["id"],
        "sucursal_nombre": sucursal["nombre"],
        "sucursales": sucs,
        "usuario": usuario_seguro,
        "asistencia": asistencia,
        "mensaje": f"Bienvenido(a), {usuario['nombre']} ({usuario['rol']})",
    }


@router.post("/auth/login-pin")
def login_con_pin(
    payload: PinLoginRequest,
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    """
    Compatibilidad con login por PIN / usuario_id.
    """
    org_res = (
        db.table("organizaciones")
        .select("*")
        .eq("id", payload.organizacion_id)
        .limit(1)
        .execute()
    )
    if not org_res.data:
        raise HTTPException(status_code=404, detail="Organización no encontrada.")
    org = org_res.data[0]

    usuarios_repo = BranchRepository(
        db, "usuarios_crm", payload.organizacion_id, payload.sucursal_id
    )
    usuario = None
    try:
        usuario = usuarios_repo.get_by_id(payload.usuario_id)
    except Exception:
        usuario = None

    if not usuario:
        todos = (
            db.table("usuarios_crm")
            .select("*")
            .eq("organizacion_id", payload.organizacion_id)
            .eq("activo", True)
            .execute()
            .data
            or []
        )
        for u in todos:
            if (
                str(u.get("id")) == str(payload.usuario_id)
                or str(u.get("nombre", "")).lower() == str(payload.usuario_id).lower()
            ):
                usuario = u
                break

    if not usuario or not usuario.get("activo", True):
        raise HTTPException(
            status_code=404,
            detail="Usuario no encontrado o inactivo.",
        )

    if str(usuario.get("pin", "")).strip() != str(payload.pin).strip():
        SecurityManager.registrar_auditoria(
            db=db,
            org_id=payload.organizacion_id,
            suc_id=payload.sucursal_id,
            usuario=usuario.get("nombre", "Desconocido"),
            rol=usuario.get("rol", "Operativo"),
            accion="LOGIN_FALLIDO",
            detalle="Intento de acceso con contraseña/PIN incorrecto",
        )
        raise HTTPException(status_code=401, detail="Contraseña o PIN incorrecto.")

    return _construir_sesion_completa(db, org, usuario, payload.sucursal_id)


@router.post("/auth/login-tenant")
@router.post("/auth/organizacion")
@router.post("/auth/login-organizacion")
@router.post("/auth/conectar-organizacion")
@router.post("/auth/empresa")
@router.post("/auth/login-empresa")
@router.post("/auth/saas")
@router.post("/auth/login-saas")
@router.post("/auth/corporativo")
@router.post("/auth/login")
@router.post("/login")
def login_unificado_tenant(
    payload: Dict[str, Any] = Body(...),
    host: Optional[str] = Header(default=None),
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    """
    Login Unificado por Subdominio (Usuario + Contraseña):
    - Identifica el tenant por subdominio (o busca el usuario en las organizaciones).
    - Autentica colaboradores de `usuarios_crm` (Dueño, Administrador, Cajero, Estilista)
      o bien el correo corporativo `email_propietario` de `organizaciones`.
    - En función del usuario autenticado devuelve su rol para activar la vista correspondiente.
    """
    if payload.get("usuario_id") and payload.get("pin") and payload.get("sucursal_id"):
        req = PinLoginRequest(
            organizacion_id=payload["organizacion_id"],
            sucursal_id=payload["sucursal_id"],
            usuario_id=payload["usuario_id"],
            pin=str(payload["pin"]),
        )
        return login_con_pin(req, db)

    identificador = (
        payload.get("usuario")
        or payload.get("username")
        or payload.get("nombre")
        or payload.get("email")
        or payload.get("email_propietario")
        or payload.get("correo")
        or ""
    ).strip()
    secreto = str(
        payload.get("password")
        or payload.get("contrasena")
        or payload.get("pin")
        or payload.get("password_hash")
        or ""
    ).strip()

    if not identificador or not secreto:
        raise HTTPException(
            status_code=400, detail="Ingresa tu usuario y contraseña."
        )

    subdominio = payload.get("subdominio") or payload.get("tenant")
    org_id_filtro = payload.get("organizacion_id")

    todas_orgs = db.table("organizaciones").select("*").execute().data or []
    orgs_por_id = {o["id"]: o for o in todas_orgs}

    # Determinar si hay un subdominio explícito
    org_subdominio = None
    if org_id_filtro and org_id_filtro in orgs_por_id:
        org_subdominio = orgs_por_id[org_id_filtro]
    elif subdominio:
        org_subdominio = _resolver_org_por_subdominio(todas_orgs, subdominio, None)
    elif host:
        host_clean = host.split(":")[0].strip().lower()
        partes = host_clean.split(".")
        if len(partes) >= 2 and partes[0] not in ("www", "localhost", "127", "app", "api"):
            org_subdominio = _resolver_org_por_subdominio(todas_orgs, partes[0], host)

    secreto_sha256 = hashlib.sha256(secreto.encode("utf-8")).hexdigest()

    # 1. Intentar autenticar como colaborador en `usuarios_crm` (Nombre/Usuario + Contraseña/PIN)
    query_usr = db.table("usuarios_crm").select("*")
    if org_subdominio:
        query_usr = query_usr.eq("organizacion_id", org_subdominio["id"])

    usuarios_todos = query_usr.execute().data or []
    ident_lower = identificador.lower()

    # Primero buscar coincidencia exacta de nombre/usuario, luego coincidencia parcial
    candidatos_usr = [
        u for u in usuarios_todos if str(u.get("nombre", "")).strip().lower() == ident_lower
    ]
    if not candidatos_usr:
        candidatos_usr = [
            u
            for u in usuarios_todos
            if ident_lower in str(u.get("nombre", "")).strip().lower()
        ]

    if candidatos_usr:
        for u in candidatos_usr:
            pin_guardado = str(u.get("pin") or "").strip()
            if pin_guardado in (secreto, secreto_sha256):
                if not u.get("activo", True):
                    raise HTTPException(
                        status_code=403,
                        detail=f"El usuario '{u.get('nombre')}' está desactivado. Contacta al administrador.",
                    )
                org_u = orgs_por_id.get(u["organizacion_id"])
                if not org_u:
                    raise HTTPException(status_code=404, detail="Organización no encontrada.")
                return _construir_sesion_completa(
                    db, org_u, u, payload.get("sucursal_id") or u.get("sucursal_id")
                )

        # Si el usuario existe pero la contraseña no coincidió:
        u_fallido = candidatos_usr[0]
        org_fallida = orgs_por_id.get(u_fallido["organizacion_id"])
        if org_fallida:
            SecurityManager.registrar_auditoria(
                db=db,
                org_id=org_fallida["id"],
                suc_id=u_fallido.get("sucursal_id"),
                usuario=u_fallido.get("nombre", identificador),
                rol=u_fallido.get("rol", "Operativo"),
                accion="LOGIN_FALLIDO",
                detalle="Contraseña incorrecta en inicio de sesión",
            )
        raise HTTPException(
            status_code=401,
            detail="Contraseña incorrecta para este usuario.",
        )

    # 2. Intentar autenticar por correo corporativo del Dueño (`organizaciones.email_propietario`)
    orgs_candidatas = [org_subdominio] if org_subdominio else todas_orgs
    for org in orgs_candidatas:
        if not org:
            continue
        email_prop = str(org.get("email_propietario") or "").strip().lower()
        nombre_org = str(org.get("nombre") or "").strip().lower()
        if ident_lower and ident_lower in (email_prop, nombre_org):
            stored_hash = str(org.get("password_hash") or "").strip()
            es_valido = (
                stored_hash in (secreto, secreto_sha256)
                or (
                    stored_hash in _LEGACY_SQL_HASHES
                    and secreto_sha256 in _LEGACY_SQL_HASHES
                )
            )
            if not es_valido:
                raise HTTPException(
                    status_code=401, detail="Contraseña incorrecta."
                )

            # Buscar el perfil de Dueño en usuarios_crm de esta organización
            usrs_org = (
                db.table("usuarios_crm")
                .select("*")
                .eq("organizacion_id", org["id"])
                .eq("activo", True)
                .order("created_at")
                .execute()
                .data
                or []
            )
            usuario_dueno = next(
                (u for u in usrs_org if u.get("rol") in ("Dueño", "Administrador")),
                usrs_org[0] if usrs_org else None,
            )
            if not usuario_dueno:
                usuario_dueno = {
                    "id": org["id"],
                    "organizacion_id": org["id"],
                    "sucursal_id": None,
                    "nombre": f"Dueño ({org.get('nombre')})",
                    "rol": "Dueño",
                    "activo": True,
                }
            return _construir_sesion_completa(
                db, org, usuario_dueno, payload.get("sucursal_id")
            )

    raise HTTPException(
        status_code=404,
        detail="Usuario no encontrado. Verifica tu nombre de usuario o correo.",
    )
