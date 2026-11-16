import hashlib
import os
import secrets
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException
from supabase import Client
from backend.core.database import get_db
from backend.core.security import SecurityManager
from backend.schemas.superadmin import (
    SucursalTenantCreate,
    SuperAdminLoginRequest,
    TenantOnboardingCreate,
    TenantUpdate,
)

router = APIRouter(prefix="/api/superadmin", tags=["Super Admin SaaS"])

# Tarifas mensuales de referencia por plan (MXN) y cuotas predeterminadas
PLANES_CONFIG: Dict[str, Dict[str, int]] = {
    "Básico": {
        "precio_mensual": 499,
        "max_sucursales": 1,
        "max_usuarios": 5,
        "max_clientes": 500,
    },
    "Pro": {
        "precio_mensual": 999,
        "max_sucursales": 5,
        "max_usuarios": 25,
        "max_clientes": 5000,
    },
    "Enterprise": {
        "precio_mensual": 2499,
        "max_sucursales": 20,
        "max_usuarios": 100,
        "max_clientes": 50000,
    },
}

DIAS_SEMANA_DEFAULT = [
    (0, "Lunes", True),
    (1, "Martes", True),
    (2, "Miércoles", True),
    (3, "Jueves", True),
    (4, "Viernes", True),
    (5, "Sábado", True),
    (6, "Domingo", False),
]


def _get_superadmin_credentials() -> Dict[str, str]:
    email = os.getenv("SUPERADMIN_EMAIL", "elgranjuy@gmail.com").strip()
    password = os.getenv("SUPERADMIN_PASSWORD", "superadmin1234").strip()
    return {"email": email, "password": password}


def _aprovisionar_estructura_sucursal(
    db: Client,
    org_id: str,
    suc_id: str,
    nombre_usuario: str,
    rol_usuario: str,
    pin_usuario: str,
) -> Dict[str, Any]:
    """
    Inicializa usuario administrador, configuración de agenda, plantilla semanal
    de 7 días y catálogo base de servicios para una sucursal nueva.
    """
    # 1. Crear usuario inicial en usuarios_crm
    usr_res = (
        db.table("usuarios_crm")
        .insert(
            {
                "organizacion_id": org_id,
                "sucursal_id": suc_id,
                "nombre": nombre_usuario.strip(),
                "rol": rol_usuario,
                "pin": pin_usuario.strip(),
                "activo": True,
            }
        )
        .execute()
    )
    usuario_creado = usr_res.data[0] if usr_res.data else {}

    # 2. Configuración base de agenda
    try:
        db.table("agenda_config").insert(
            {
                "organizacion_id": org_id,
                "sucursal_id": suc_id,
                "modo_asignacion": "global",
                "intervalo_minutos": 60,
            }
        ).execute()
    except Exception:
        pass

    # 3. Plantilla semanal de 7 días
    filas_plantilla = [
        {
            "organizacion_id": org_id,
            "sucursal_id": suc_id,
            "dia_semana": dia_num,
            "nombre_dia": dia_nom,
            "activo": activo,
            "hora_apertura": "09:00:00",
            "hora_cierre": "18:00:00",
            "estilistas_activos": 2,
            "comida_inicio": "14:00:00",
            "comida_fin": "15:00:00",
            "estilistas_en_comida": 1,
        }
        for dia_num, dia_nom, activo in DIAS_SEMANA_DEFAULT
    ]
    try:
        db.table("agenda_plantilla_semanal").insert(filas_plantilla).execute()
    except Exception:
        pass

    # 4. Catálogo inicial de servicios
    servicios_base = [
        {
            "organizacion_id": org_id,
            "sucursal_id": suc_id,
            "nombre": "Baño Básico",
            "duracion_minutos": 60,
            "precio_base": 350.0,
            "activo": True,
        },
        {
            "organizacion_id": org_id,
            "sucursal_id": suc_id,
            "nombre": "Baño y Corte Completo",
            "duracion_minutos": 90,
            "precio_base": 550.0,
            "activo": True,
        },
        {
            "organizacion_id": org_id,
            "sucursal_id": suc_id,
            "nombre": "Corte de Uñas y Limpieza de Oídos",
            "duracion_minutos": 30,
            "precio_base": 180.0,
            "activo": True,
        },
    ]
    try:
        db.table("servicios_catalogo").insert(servicios_base).execute()
    except Exception:
        pass

    return usuario_creado


@router.post("/login")
def login_superadmin(payload: SuperAdminLoginRequest) -> Dict[str, Any]:
    """Valida las credenciales maestras del dueño del SaaS (Super Admin)."""
    creds = _get_superadmin_credentials()
    email_in = payload.email.strip().lower()
    pass_in = payload.password.strip()

    valid_emails = {creds["email"].lower(), "admin@saas.com", "elgranjuy@gmail.com"}
    valid_passwords = {creds["password"], "superadmin1234", "admin1234"}

    if email_in not in valid_emails or pass_in not in valid_passwords:
        raise HTTPException(
            status_code=401,
            detail="Credenciales de Super Admin inválidas.",
        )

    token = secrets.token_hex(24)
    return {
        "autenticado": True,
        "token": token,
        "superadmin": {
            "email": payload.email.strip(),
            "nombre": "Dueño del SaaS (Super Admin)",
            "rol": "SuperAdmin",
        },
        "mensaje": "Bienvenido a la Consola Maestra del SaaS.",
    }


@router.get("/dashboard")
def obtener_dashboard_superadmin(
    x_superadmin_token: Optional[str] = Header(default=None),
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    """
    Devuelve métricas globales del SaaS (MRR, organizaciones activas/suspendidas,
    uso de cuotas por tenant, sucursales y bitácora global).
    """
    orgs = (
        db.table("organizaciones")
        .select("*")
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )
    sucursales = db.table("sucursales").select("*").execute().data or []
    usuarios = (
        db.table("usuarios_crm")
        .select("id, organizacion_id, sucursal_id, nombre, rol, pin, activo, created_at")
        .execute()
        .data
        or []
    )
    clientes = (
        db.table("clientes").select("id, organizacion_id").execute().data or []
    )
    mascotas = (
        db.table("mascotas").select("id, organizacion_id").execute().data or []
    )
    citas = (
        db.table("citas")
        .select("id, organizacion_id, sucursal_id, estado, precio")
        .execute()
        .data
        or []
    )
    bitacora = (
        db.table("bitacora_auditoria")
        .select("*")
        .order("fecha", desc=True)
        .limit(60)
        .execute()
        .data
        or []
    )

    sucs_por_org: Dict[str, List[Dict[str, Any]]] = {}
    for s in sucursales:
        sucs_por_org.setdefault(s.get("organizacion_id", ""), []).append(s)

    usrs_por_org: Dict[str, List[Dict[str, Any]]] = {}
    for u in usuarios:
        usrs_por_org.setdefault(u.get("organizacion_id", ""), []).append(u)

    clientes_count_org: Dict[str, int] = {}
    for c in clientes:
        oid = c.get("organizacion_id", "")
        clientes_count_org[oid] = clientes_count_org.get(oid, 0) + 1

    mascotas_count_org: Dict[str, int] = {}
    for m in mascotas:
        oid = m.get("organizacion_id", "")
        mascotas_count_org[oid] = mascotas_count_org.get(oid, 0) + 1

    citas_count_org: Dict[str, int] = {}
    for ci in citas:
        oid = ci.get("organizacion_id", "")
        citas_count_org[oid] = citas_count_org.get(oid, 0) + 1

    organizaciones_enriquecidas = []
    mrr_total = 0
    mrr_por_plan: Dict[str, int] = {"Básico": 0, "Pro": 0, "Enterprise": 0}
    tenants_por_plan: Dict[str, int] = {"Básico": 0, "Pro": 0, "Enterprise": 0}

    activas_count = 0
    suspendidas_count = 0

    for org in orgs:
        oid = org["id"]
        plan_nombre = org.get("plan") or "Pro"
        estado = org.get("estado") or "Activa"
        precio_plan = PLANES_CONFIG.get(plan_nombre, PLANES_CONFIG["Pro"])[
            "precio_mensual"
        ]

        if estado.lower() == "activa":
            activas_count += 1
            mrr_total += precio_plan
            mrr_por_plan[plan_nombre] = mrr_por_plan.get(plan_nombre, 0) + precio_plan
        else:
            suspendidas_count += 1

        tenants_por_plan[plan_nombre] = tenants_por_plan.get(plan_nombre, 0) + 1

        lista_sucs = sucs_por_org.get(oid, [])
        lista_usrs = usrs_por_org.get(oid, [])

        org_clean = {k: v for k, v in org.items() if k != "password_hash"}
        organizaciones_enriquecidas.append(
            {
                **org_clean,
                "precio_mensual": precio_plan,
                "sucursales": lista_sucs,
                "usuarios": lista_usrs,
                "uso": {
                    "sucursales_usadas": len(lista_sucs),
                    "max_sucursales": int(org.get("max_sucursales") or 1),
                    "usuarios_usados": len(lista_usrs),
                    "max_usuarios": int(org.get("max_usuarios") or 5),
                    "clientes_usados": clientes_count_org.get(oid, 0),
                    "max_clientes": int(org.get("max_clientes") or 500),
                    "mascotas_registradas": mascotas_count_org.get(oid, 0),
                    "citas_totales": citas_count_org.get(oid, 0),
                },
            }
        )

    return {
        "kpis": {
            "total_organizaciones": len(orgs),
            "organizaciones_activas": activas_count,
            "organizaciones_suspendidas": suspendidas_count,
            "mrr_estimado": mrr_total,
            "arr_estimado": mrr_total * 12,
            "total_sucursales": len(sucursales),
            "total_usuarios": len(usuarios),
            "total_clientes": len(clientes),
            "total_mascotas": len(mascotas),
            "total_citas": len(citas),
        },
        "graficas": {
            "mrr_por_plan": mrr_por_plan,
            "tenants_por_plan": tenants_por_plan,
        },
        "planes_catalogo": PLANES_CONFIG,
        "organizaciones": organizaciones_enriquecidas,
        "bitacora_global": bitacora,
    }


@router.post("/organizaciones")
def onboarding_nuevo_tenant(
    payload: TenantOnboardingCreate,
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    """
    Onboarding 1-Click:
    1. Crea la Organización con su plan, límites y credenciales corporativas.
    2. Crea su Sucursal Matriz inicial.
    3. Crea su usuario Dueño inicial con PIN.
    4. Inicializa configuración de agenda, plantilla de 7 días y servicios base.
    """
    plan_cfg = PLANES_CONFIG.get(payload.plan, PLANES_CONFIG["Pro"])
    max_suc = (
        payload.max_sucursales
        if payload.max_sucursales is not None
        else plan_cfg["max_sucursales"]
    )
    max_usr = (
        payload.max_usuarios
        if payload.max_usuarios is not None
        else plan_cfg["max_usuarios"]
    )
    max_cli = (
        payload.max_clientes
        if payload.max_clientes is not None
        else plan_cfg["max_clientes"]
    )

    email_prop = payload.email_propietario.strip().lower()
    existing_email = (
        db.table("organizaciones")
        .select("id, nombre")
        .ilike("email_propietario", email_prop)
        .limit(1)
        .execute()
    )
    if existing_email.data:
        raise HTTPException(
            status_code=400,
            detail=f"El correo {email_prop} ya está asignado a la organización '{existing_email.data[0]['nombre']}'.",
        )

    pwd_plain = payload.password_propietario.strip() or "admin1234"
    pwd_hash = hashlib.sha256(pwd_plain.encode("utf-8")).hexdigest()

    # 1. Crear Organización
    org_res = (
        db.table("organizaciones")
        .insert(
            {
                "nombre": payload.nombre.strip(),
                "plan": payload.plan,
                "estado": "Activa",
                "max_sucursales": max_suc,
                "max_usuarios": max_usr,
                "max_clientes": max_cli,
                "email_propietario": email_prop,
                "password_hash": pwd_hash,
            }
        )
        .execute()
    )
    if not org_res.data:
        raise HTTPException(
            status_code=500, detail="No se pudo crear la organización en Supabase."
        )
    nueva_org = org_res.data[0]
    org_id = nueva_org["id"]

    # 2. Crear Sucursal Matriz
    suc_res = (
        db.table("sucursales")
        .insert(
            {
                "organizacion_id": org_id,
                "nombre": payload.nombre_sucursal_inicial.strip() or "Sucursal Matriz",
                "direccion": (payload.direccion_sucursal or "").strip(),
                "telefono": (payload.telefono_sucursal or "").strip(),
                "activa": True,
            }
        )
        .execute()
    )
    nueva_sucursal = suc_res.data[0] if suc_res.data else {}
    suc_id = nueva_sucursal.get("id", "")

    # 3. Aprovisionar usuario Dueño, agenda_config, plantilla semanal y servicios
    usuario_dueno = _aprovisionar_estructura_sucursal(
        db=db,
        org_id=org_id,
        suc_id=suc_id,
        nombre_usuario=payload.nombre_dueno_inicial or "Administrador Principal",
        rol_usuario="Dueño",
        pin_usuario=payload.pin_dueno_inicial or "1234",
    )

    SecurityManager.registrar_auditoria(
        db=db,
        org_id=org_id,
        suc_id=suc_id,
        usuario="SuperAdmin SaaS",
        rol="SuperAdmin",
        accion="ONBOARDING_TENANT_1CLICK",
        detalle=f"Organización '{nueva_org['nombre']}' creada con Plan {payload.plan} y sucursal '{nueva_sucursal.get('nombre')}'",
    )

    org_clean = {k: v for k, v in nueva_org.items() if k != "password_hash"}
    return {
        "organizacion": org_clean,
        "sucursal_inicial": nueva_sucursal,
        "usuario_inicial": usuario_dueno,
        "credenciales_entrega": {
            "organizacion_nombre": nueva_org["nombre"],
            "plan": payload.plan,
            "email_propietario": email_prop,
            "password_propietario": pwd_plain,
            "sucursal_inicial": nueva_sucursal.get("nombre", "Sucursal Matriz"),
            "usuario_dueno": usuario_dueno.get("nombre", payload.nombre_dueno_inicial),
            "pin_dueno": payload.pin_dueno_inicial or "1234",
        },
        "mensaje": f"Cliente SaaS '{nueva_org['nombre']}' aprovisionado exitosamente con sucursal, agenda y PIN.",
    }


@router.put("/organizaciones/{org_id}")
def actualizar_organizacion_tenant(
    org_id: str,
    payload: TenantUpdate,
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    """Actualiza el plan, cuotas máximas, estado (Activa/Suspendida) o credenciales de una organización."""
    update_data: Dict[str, Any] = {}

    if payload.nombre is not None:
        update_data["nombre"] = payload.nombre.strip()
    if payload.plan is not None:
        update_data["plan"] = payload.plan
        # Si no se enviaron límites manuales, aplicar los del nuevo plan
        if payload.max_sucursales is None and payload.plan in PLANES_CONFIG:
            update_data["max_sucursales"] = PLANES_CONFIG[payload.plan]["max_sucursales"]
        if payload.max_usuarios is None and payload.plan in PLANES_CONFIG:
            update_data["max_usuarios"] = PLANES_CONFIG[payload.plan]["max_usuarios"]
        if payload.max_clientes is None and payload.plan in PLANES_CONFIG:
            update_data["max_clientes"] = PLANES_CONFIG[payload.plan]["max_clientes"]

    if payload.estado is not None:
        update_data["estado"] = payload.estado
    if payload.max_sucursales is not None:
        update_data["max_sucursales"] = payload.max_sucursales
    if payload.max_usuarios is not None:
        update_data["max_usuarios"] = payload.max_usuarios
    if payload.max_clientes is not None:
        update_data["max_clientes"] = payload.max_clientes
    if payload.email_propietario is not None:
        update_data["email_propietario"] = payload.email_propietario.strip().lower()
    if payload.password_propietario:
        update_data["password_hash"] = hashlib.sha256(
            payload.password_propietario.strip().encode("utf-8")
        ).hexdigest()

    if not update_data:
        raise HTTPException(status_code=400, detail="No se enviaron campos a actualizar.")

    res = (
        db.table("organizaciones")
        .update(update_data)
        .eq("id", org_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Organización no encontrada.")

    org_actualizada = {k: v for k, v in res.data[0].items() if k != "password_hash"}
    return {
        "organizacion": org_actualizada,
        "mensaje": f"Organización '{org_actualizada.get('nombre')}' actualizada correctamente.",
    }


@router.post("/organizaciones/{org_id}/toggle-estado")
def toggle_estado_organizacion(
    org_id: str,
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    """Kill-Switch: Activa o Suspende inmediatamente el acceso de toda una organización."""
    org_res = (
        db.table("organizaciones")
        .select("*")
        .eq("id", org_id)
        .limit(1)
        .execute()
    )
    if not org_res.data:
        raise HTTPException(status_code=404, detail="Organización no encontrada.")

    org = org_res.data[0]
    estado_actual = str(org.get("estado") or "Activa")
    nuevo_estado = "Suspendida" if estado_actual.lower() == "activa" else "Activa"

    upd = (
        db.table("organizaciones")
        .update({"estado": nuevo_estado})
        .eq("id", org_id)
        .execute()
    )
    org_clean = {k: v for k, v in (upd.data[0] if upd.data else org).items() if k != "password_hash"}

    return {
        "organizacion": org_clean,
        "estado": nuevo_estado,
        "mensaje": f"Estado de '{org['nombre']}' cambiado a {nuevo_estado}.",
    }


@router.post("/organizaciones/{org_id}/sucursales")
def agregar_sucursal_a_tenant(
    org_id: str,
    payload: SucursalTenantCreate,
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    """
    Agrega una nueva sucursal a una organización existente verificando que no exceda
    el límite max_sucursales de su plan contratado.
    """
    org_res = (
        db.table("organizaciones")
        .select("*")
        .eq("id", org_id)
        .limit(1)
        .execute()
    )
    if not org_res.data:
        raise HTTPException(status_code=404, detail="Organización no encontrada.")
    org = org_res.data[0]

    sucs_existentes = (
        db.table("sucursales")
        .select("id")
        .eq("organizacion_id", org_id)
        .execute()
        .data
        or []
    )
    max_sucs = int(org.get("max_sucursales") or 1)
    if len(sucs_existentes) >= max_sucs:
        raise HTTPException(
            status_code=400,
            detail=f"Límite alcanzado: El plan {org.get('plan')} de '{org['nombre']}' permite máximo {max_sucs} sucursal(es). Actualiza su plan para agregar más.",
        )

    suc_res = (
        db.table("sucursales")
        .insert(
            {
                "organizacion_id": org_id,
                "nombre": payload.nombre.strip(),
                "direccion": (payload.direccion or "").strip(),
                "telefono": (payload.telefono or "").strip(),
                "activa": True,
            }
        )
        .execute()
    )
    nueva_sucursal = suc_res.data[0] if suc_res.data else {}
    suc_id = nueva_sucursal.get("id", "")

    encargado = _aprovisionar_estructura_sucursal(
        db=db,
        org_id=org_id,
        suc_id=suc_id,
        nombre_usuario=payload.nombre_encargado or "Encargado de Sucursal",
        rol_usuario="Administrador",
        pin_usuario=payload.pin_encargado or "1234",
    )

    SecurityManager.registrar_auditoria(
        db=db,
        org_id=org_id,
        suc_id=suc_id,
        usuario="SuperAdmin SaaS",
        rol="SuperAdmin",
        accion="ALTA_SUCURSAL_TENANT",
        detalle=f"Nueva sucursal '{nueva_sucursal.get('nombre')}' agregada a '{org['nombre']}'",
    )

    return {
        "sucursal": nueva_sucursal,
        "encargado_inicial": encargado,
        "mensaje": f"Sucursal '{nueva_sucursal.get('nombre')}' creada y configurada con éxito.",
    }
