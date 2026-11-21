import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from supabase import Client
from backend.core.database import get_db
from backend.core.security import SecurityManager
from backend.repositories.base import BranchRepository, OrganizationRepository
from backend.schemas.operativo import (
    AgendaConfigUpdate,
    CajaManualCreate,
    CheckOutRequest,
    CitaCompletar,
    CitaCreate,
    CitaUpdate,
    ClienteCreate,
    EscaneoRequest,
    ExcepcionCreate,
    MascotaCreate,
    MatrizPerfilesBatchInput,
    PerfilPermisosInput,
    PlantillaDiaUpdate,
    ProductoCreate,
    ServicioCreate,
    UsuarioCreate,
    UsuarioUpdate,
)
from backend.services.disponibilidad import AvailabilityEngine
from backend.services.perfiles_permisos import (
    CATALOGO_PERMISOS,
    MODULOS_MATRIZ,
    NIVELES_ACCESO,
    PERFILES_BASE_SISTEMA,
    PerfilesPermisosService,
)

router = APIRouter(prefix="/api", tags=["Operativo CRM"])


def _resolver_contexto(
    db: Client,
    organizacion_id: Optional[str] = None,
    sucursal_id: Optional[str] = None,
    x_organizacion_id: Optional[str] = None,
    x_sucursal_id: Optional[str] = None,
    requiere_sucursal: bool = True,
) -> Dict[str, str]:
    """
    Resuelve organizacion_id y sucursal_id desde query params, body o headers.
    Si no se envían, obtiene la organización/sucursal activa por defecto para facilitar pruebas.
    """
    org_id = organizacion_id or x_organizacion_id
    suc_id = sucursal_id or x_sucursal_id

    if not org_id and suc_id:
        res = (
            db.table("sucursales")
            .select("organizacion_id")
            .eq("id", suc_id)
            .limit(1)
            .execute()
        )
        if res.data:
            org_id = res.data[0]["organizacion_id"]

    if not org_id:
        res = (
            db.table("organizaciones")
            .select("id")
            .eq("estado", "Activa")
            .limit(1)
            .execute()
        )
        if res.data:
            org_id = res.data[0]["id"]

    if not org_id:
        raise HTTPException(
            status_code=400, detail="Se requiere organizacion_id válido."
        )

    if requiere_sucursal and not suc_id:
        res = (
            db.table("sucursales")
            .select("id")
            .eq("organizacion_id", org_id)
            .eq("activa", True)
            .limit(1)
            .execute()
        )
        if res.data:
            suc_id = res.data[0]["id"]

    if requiere_sucursal and not suc_id:
        raise HTTPException(status_code=400, detail="Se requiere sucursal_id válido.")

    return {"organizacion_id": org_id, "sucursal_id": suc_id or ""}


# -------------------------------------------------------------------------
# 1. DASHBOARD (KPIs y Gráficas por Sucursal)
# -------------------------------------------------------------------------
@router.get("/dashboard")
def obtener_dashboard(
    fecha_local: Optional[str] = Query(default=None),
    organizacion_id: Optional[str] = Query(default=None),
    sucursal_id: Optional[str] = Query(default=None),
    x_organizacion_id: Optional[str] = Header(default=None),
    x_sucursal_id: Optional[str] = Header(default=None),
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    ctx = _resolver_contexto(
        db, organizacion_id, sucursal_id, x_organizacion_id, x_sucursal_id
    )
    org_id, suc_id = ctx["organizacion_id"], ctx["sucursal_id"]

    citas_repo = BranchRepository(db, "citas", org_id, suc_id)
    caja_repo = BranchRepository(db, "caja", org_id, suc_id)
    inv_repo = BranchRepository(db, "inventario", org_id, suc_id)
    clientes_repo = OrganizationRepository(db, "clientes", org_id)
    mascotas_repo = OrganizationRepository(db, "mascotas", org_id)

    citas = citas_repo.get_all(order_by="fecha_hora", desc=True)
    movimientos_caja = caja_repo.get_all(order_by="fecha", desc=True)
    productos = inv_repo.get_all()
    clientes = clientes_repo.get_all()
    mascotas = mascotas_repo.get_all()

    hoy_str = (
        fecha_local[:10]
        if (fecha_local and len(fecha_local) >= 10)
        else datetime.now().strftime("%Y-%m-%d")
    )

    citas_hoy = [
        c for c in citas if str(c.get("fecha_hora", "")).startswith(hoy_str)
    ]
    citas_hoy_completadas = [
        c for c in citas_hoy if str(c.get("estado", "")).lower() == "completada"
    ]
    citas_hoy_pendientes = [
        c for c in citas_hoy if str(c.get("estado", "")).lower() == "programada"
    ]
    citas_completadas = [
        c for c in citas if str(c.get("estado", "")).lower() == "completada"
    ]
    citas_programadas = [
        c for c in citas if str(c.get("estado", "")).lower() == "programada"
    ]

    ingresos_totales = sum(float(m.get("monto") or 0) for m in movimientos_caja)
    ingresos_hoy = sum(
        float(m.get("monto") or 0)
        for m in movimientos_caja
        if str(m.get("fecha", "")).startswith(hoy_str)
    )

    alertas_stock = [
        p
        for p in productos
        if int(p.get("stock") or 0) <= int(p.get("stock_minimo") or 0)
    ]

    # Gráficas agregadas
    ingresos_por_metodo: Dict[str, float] = {}
    for m in movimientos_caja:
        metodo = m.get("metodo_pago") or "Otro"
        ingresos_por_metodo[metodo] = ingresos_por_metodo.get(metodo, 0.0) + float(
            m.get("monto") or 0
        )

    citas_por_servicio: Dict[str, int] = {}
    citas_por_estado: Dict[str, int] = {}
    citas_por_estilista: Dict[str, int] = {}
    for c in citas:
        srv = c.get("servicio") or "General"
        est = c.get("estado") or "Programada"
        stylist = c.get("estilista") or "Por asignar"
        citas_por_servicio[srv] = citas_por_servicio.get(srv, 0) + 1
        citas_por_estado[est] = citas_por_estado.get(est, 0) + 1
        citas_por_estilista[stylist] = citas_por_estilista.get(stylist, 0) + 1

    ticket_promedio = (
        round(ingresos_totales / len(movimientos_caja), 2)
        if movimientos_caja
        else 0.0
    )

    return {
        "kpis": {
            "fecha_referencia": hoy_str,
            "ingresos_totales": round(ingresos_totales, 2),
            "ingresos_hoy": round(ingresos_hoy, 2),
            "ticket_promedio": ticket_promedio,
            "citas_totales": len(citas),
            "citas_hoy": len(citas_hoy),
            "citas_hoy_completadas": len(citas_hoy_completadas),
            "citas_hoy_pendientes": len(citas_hoy_pendientes),
            "citas_completadas": len(citas_completadas),
            "citas_pendientes": len(citas_programadas),
            "total_clientes": len(clientes),
            "total_mascotas": len(mascotas),
            "alertas_inventario": len(alertas_stock),
        },
        "graficas": {
            "ingresos_por_metodo": ingresos_por_metodo,
            "citas_por_servicio": citas_por_servicio,
            "citas_por_estado": citas_por_estado,
            "citas_por_estilista": citas_por_estilista,
        },
        "alertas_stock": alertas_stock,
        "proximas_citas": citas[:10],
        "ultimos_movimientos_caja": movimientos_caja[:10],
    }


# -------------------------------------------------------------------------
# 2. CLIENTES Y MASCOTAS (Búsqueda Privada, Expediente y Creación con Hash)
# -------------------------------------------------------------------------
def _enmascarar_telefono(telefono: Optional[str]) -> str:
    """Devuelve únicamente los últimos 4 dígitos del celular por privacidad anti-robo de cartera."""
    digitos = re.sub(r"\D", "", str(telefono or ""))
    if len(digitos) >= 4:
        return f"•••• ••{digitos[-4:]}"
    return f"•••• {digitos}" if digitos else "••••"


def _ultimos_4_telefono(telefono: Optional[str]) -> str:
    digitos = re.sub(r"\D", "", str(telefono or ""))
    return digitos[-4:] if len(digitos) >= 4 else digitos


def _sanitizar_cliente_privado(cliente: Dict[str, Any]) -> Dict[str, Any]:
    copia = dict(cliente or {})
    raw_tel = copia.get("telefono", "")
    copia["telefono"] = _enmascarar_telefono(raw_tel)
    copia["ultimos_4_telefono"] = _ultimos_4_telefono(raw_tel)
    return copia


@router.get("/clientes/buscar")
def buscar_clientes_privado(
    q: str = Query(default="", description="Término de búsqueda: teléfono, nombre, mascota o código PET-"),
    organizacion_id: Optional[str] = Query(default=None),
    x_organizacion_id: Optional[str] = Header(default=None),
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    """
    Búsqueda privada de clientes y sus mascotas por teléfono, nombre de cliente,
    nombre de mascota o código de barras (PET-...), sin exponer el padrón completo
    y mostrando únicamente los últimos 4 dígitos del celular.
    """
    termino = (q or "").strip()
    if len(termino) < 2:
        return {
            "resultados": [],
            "clientes": [],
            "total": 0,
            "mensaje": "Ingrese al menos 2 caracteres para realizar la búsqueda privada.",
        }

    ctx = _resolver_contexto(
        db,
        organizacion_id=organizacion_id,
        x_organizacion_id=x_organizacion_id,
        requiere_sucursal=False,
    )
    org_id = ctx["organizacion_id"]

    clientes_repo = OrganizationRepository(db, "clientes", org_id)
    mascotas_repo = OrganizationRepository(db, "mascotas", org_id)

    # 1. Buscar coincidencias en clientes por teléfono o nombre
    res_tel = clientes_repo.query("*").ilike("telefono", f"%{termino}%").limit(20).execute()
    res_nom = clientes_repo.query("*").ilike("nombre", f"%{termino}%").limit(20).execute()

    # 2. Buscar coincidencias en mascotas por código de barras o nombre
    res_bar = mascotas_repo.query("*").ilike("codigo_barras", f"%{termino}%").limit(20).execute()
    res_pet = mascotas_repo.query("*").ilike("nombre", f"%{termino}%").limit(20).execute()

    clientes_map: Dict[str, Dict[str, Any]] = {}
    for c in (res_tel.data or []) + (res_nom.data or []):
        clientes_map[c["id"]] = c

    mascotas_encontradas = (res_bar.data or []) + (res_pet.data or [])
    cliente_ids_faltantes = {
        m["cliente_id"]
        for m in mascotas_encontradas
        if m.get("cliente_id") and m["cliente_id"] not in clientes_map
    }

    for cid in cliente_ids_faltantes:
        cli = clientes_repo.get_by_id(cid)
        if cli:
            clientes_map[cid] = cli

    resultados: List[Dict[str, Any]] = []
    for cid, cliente in clientes_map.items():
        mascotas_cliente = (
            mascotas_repo.query("*").eq("cliente_id", cid).order("nombre").execute().data
            or []
        )
        cliente_seguro = _sanitizar_cliente_privado(cliente)
        resultados.append(
            {
                **cliente_seguro,
                "mascotas": mascotas_cliente,
                "total_mascotas": len(mascotas_cliente),
            }
        )

    return {
        "resultados": resultados,
        "clientes": resultados,
        "total": len(resultados),
    }


def _sincronizar_visitas_mascota(
    db: Client, org_id: str, mascota_id: Optional[str]
) -> int:
    """
    Recalcula las citas con estado 'Completada' de una mascota y sincroniza
    la columna `visitas_acumuladas` en la tabla `mascotas`.
    """
    if not mascota_id:
        return 0
    try:
        res_citas = (
            db.table("citas")
            .select("id")
            .eq("organizacion_id", org_id)
            .eq("mascota_id", mascota_id)
            .eq("estado", "Completada")
            .execute()
        )
        total_completadas = len(res_citas.data or [])
        db.table("mascotas").update({"visitas_acumuladas": total_completadas}).eq(
            "id", mascota_id
        ).eq("organizacion_id", org_id).execute()
        return total_completadas
    except Exception:
        return 0


@router.get("/clientes-mascotas/padron")
def obtener_padron_clientes_mascotas(
    organizacion_id: Optional[str] = Query(default=None),
    x_organizacion_id: Optional[str] = Header(default=None),
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    """
    Devuelve la tabla completa de clientes y la tabla completa de mascotas de la organización
    para el módulo de Clientes y Expedientes (exclusivo de Administrador y Dueño).
    """
    ctx = _resolver_contexto(
        db,
        organizacion_id=organizacion_id,
        x_organizacion_id=x_organizacion_id,
        requiere_sucursal=False,
    )
    org_id = ctx["organizacion_id"]

    clientes_repo = OrganizationRepository(db, "clientes", org_id)
    mascotas_repo = OrganizationRepository(db, "mascotas", org_id)

    clientes_raw = clientes_repo.get_all(order_by="created_at", desc=True)
    mascotas_raw = mascotas_repo.get_all(order_by="created_at", desc=True)

    # Contar citas completadas reales por mascota para garantizar 100% consistencia con el expediente
    conteo_completadas: Dict[str, int] = {}
    try:
        citas_comp_res = (
            db.table("citas")
            .select("mascota_id")
            .eq("organizacion_id", org_id)
            .eq("estado", "Completada")
            .execute()
        )
        for row in citas_comp_res.data or []:
            mid = row.get("mascota_id")
            if mid:
                conteo_completadas[mid] = conteo_completadas.get(mid, 0) + 1
    except Exception:
        pass

    for m in mascotas_raw:
        mid = m.get("id")
        if mid and mid in conteo_completadas:
            vis_real = conteo_completadas[mid]
            if int(m.get("visitas_acumuladas") or 0) != vis_real:
                m["visitas_acumuladas"] = vis_real
                try:
                    db.table("mascotas").update({"visitas_acumuladas": vis_real}).eq(
                        "id", mid
                    ).execute()
                except Exception:
                    pass

    clientes_por_id: Dict[str, Dict[str, Any]] = {
        c["id"]: c for c in clientes_raw if c.get("id")
    }
    mascotas_por_cliente: Dict[str, List[Dict[str, Any]]] = {}
    for m in mascotas_raw:
        cid = m.get("cliente_id")
        if cid:
            mascotas_por_cliente.setdefault(cid, []).append(m)

    clientes_tabla: List[Dict[str, Any]] = []
    for c in clientes_raw:
        cid = c.get("id", "")
        pets = mascotas_por_cliente.get(cid, [])
        nombres_mascotas = ", ".join(
            f"{p.get('nombre', '')} ({p.get('raza', '')})" for p in pets
        )
        clientes_tabla.append(
            {
                **c,
                "telefono_enmascarado": _enmascarar_telefono(c.get("telefono")),
                "ultimos_4_telefono": _ultimos_4_telefono(c.get("telefono")),
                "mascotas": pets,
                "total_mascotas": len(pets),
                "mascotas_resumen": nombres_mascotas or "Sin mascotas",
            }
        )

    mascotas_tabla: List[Dict[str, Any]] = []
    for m in mascotas_raw:
        dueno = clientes_por_id.get(m.get("cliente_id", ""), {})
        mascotas_tabla.append(
            {
                **m,
                "cliente_nombre": dueno.get("nombre") or "Sin dueño",
                "cliente_telefono": dueno.get("telefono") or "",
                "cliente_telefono_enmascarado": _enmascarar_telefono(
                    dueno.get("telefono")
                ),
                "cliente_email": dueno.get("email") or "",
            }
        )

    return {
        "clientes": clientes_tabla,
        "mascotas": mascotas_tabla,
        "total_clientes": len(clientes_tabla),
        "total_mascotas": len(mascotas_tabla),
    }


@router.get("/clientes/{cliente_id}/expediente")
def obtener_expediente_cliente(
    cliente_id: str,
    organizacion_id: Optional[str] = Query(default=None),
    x_organizacion_id: Optional[str] = Header(default=None),
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    """
    Devuelve el expediente integral de un cliente (con celular enmascarado a los últimos 4 dígitos),
    su resumen e historial de actividad con la estética a nivel cliente, y el listado de sus mascotas
    con el expediente clínico e historial individual de cada mascota.
    """
    ctx = _resolver_contexto(
        db,
        organizacion_id=organizacion_id,
        x_organizacion_id=x_organizacion_id,
        requiere_sucursal=False,
    )
    org_id = ctx["organizacion_id"]

    clientes_repo = OrganizationRepository(db, "clientes", org_id)
    mascotas_repo = OrganizationRepository(db, "mascotas", org_id)
    citas_org_repo = OrganizationRepository(db, "citas", org_id)

    cliente = clientes_repo.get_by_id(cliente_id)
    if not cliente:
        raise HTTPException(
            status_code=404, detail="Expediente de cliente no encontrado."
        )

    cliente_seguro = _sanitizar_cliente_privado(cliente)

    mascotas_cliente = (
        mascotas_repo.query("*").eq("cliente_id", cliente_id).order("nombre").execute().data
        or []
    )
    mascota_ids = [m["id"] for m in mascotas_cliente if m.get("id")]
    mascotas_por_id = {m["id"]: m for m in mascotas_cliente if m.get("id")}

    citas_cliente: List[Dict[str, Any]] = []
    if mascota_ids:
        citas_res = (
            citas_org_repo.query("*")
            .in_("mascota_id", mascota_ids)
            .order("fecha_hora", desc=True)
            .execute()
        )
        citas_cliente = citas_res.data or []

    # Enriquecer cada cita con datos de la mascota
    historial_citas_cliente: List[Dict[str, Any]] = []
    citas_por_mascota: Dict[str, List[Dict[str, Any]]] = {mid: [] for mid in mascota_ids}

    for c in citas_cliente:
        mid = c.get("mascota_id")
        pet = mascotas_por_id.get(mid, {})
        no_asistio = _es_cita_no_asistio(c)
        cita_enriquecida = {
            **c,
            "notas_servicio": _limpiar_tag_no_asistio(c.get("notas_servicio")),
            "etapa_estancia": _extraer_etapa_estancia(c),
            "estado": "No Asistió" if no_asistio else c.get("estado"),
            "mascota_nombre": pet.get("nombre") or "Mascota",
            "mascota_raza": pet.get("raza") or "",
            "mascota_codigo": pet.get("codigo_barras") or "",
        }
        historial_citas_cliente.append(cita_enriquecida)
        if mid in citas_por_mascota:
            citas_por_mascota[mid].append(cita_enriquecida)

    citas_completadas = [
        c for c in historial_citas_cliente if str(c.get("estado", "")).lower() == "completada"
    ]
    citas_programadas = [
        c for c in historial_citas_cliente if str(c.get("estado", "")).lower() == "programada"
    ]
    total_invertido = sum(float(c.get("precio") or 0) for c in citas_completadas)

    ultima_visita = citas_completadas[0].get("fecha_hora") if citas_completadas else (
        historial_citas_cliente[0].get("fecha_hora") if historial_citas_cliente else None
    )
    proxima_cita = citas_programadas[-1].get("fecha_hora") if citas_programadas else None

    mascotas_detalladas: List[Dict[str, Any]] = []
    for m in mascotas_cliente:
        mid = m["id"]
        hist_m = citas_por_mascota.get(mid, [])
        comp_m = [
            c for c in hist_m if str(c.get("estado", "")).lower() == "completada"
        ]
        visitas_reales = len(comp_m)
        if int(m.get("visitas_acumuladas") or 0) != visitas_reales:
            try:
                db.table("mascotas").update({"visitas_acumuladas": visitas_reales}).eq(
                    "id", mid
                ).execute()
            except Exception:
                pass
        gasto_m = sum(float(c.get("precio") or 0) for c in comp_m)
        ultima_m = comp_m[0].get("fecha_hora") if comp_m else (
            hist_m[0].get("fecha_hora") if hist_m else None
        )
        mascotas_detalladas.append(
            {
                **m,
                "visitas_acumuladas": visitas_reales,
                "historial_citas": hist_m,
                "total_citas": len(hist_m),
                "citas_completadas": visitas_reales,
                "total_invertido": round(gasto_m, 2),
                "ultima_visita": ultima_m,
            }
        )

    return {
        "cliente": cliente_seguro,
        "resumen_actividad": {
            "total_mascotas": len(mascotas_detalladas),
            "total_citas": len(historial_citas_cliente),
            "citas_completadas": len(citas_completadas),
            "citas_programadas": len(citas_programadas),
            "total_invertido": round(total_invertido, 2),
            "ultima_visita": ultima_visita,
            "proxima_cita": proxima_cita,
        },
        "historial_citas_cliente": historial_citas_cliente,
        "mascotas": mascotas_detalladas,
    }


@router.post("/clientes")
def crear_cliente(
    payload: ClienteCreate,
    organizacion_id: Optional[str] = Query(default=None),
    sucursal_id: Optional[str] = Query(default=None),
    x_organizacion_id: Optional[str] = Header(default=None),
    x_sucursal_id: Optional[str] = Header(default=None),
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    ctx = _resolver_contexto(
        db,
        organizacion_id or payload.organizacion_id,
        sucursal_id or payload.sucursal_id,
        x_organizacion_id,
        x_sucursal_id,
        requiere_sucursal=False,
    )
    org_id = ctx["organizacion_id"]
    suc_id = ctx.get("sucursal_id") or payload.sucursal_id

    clientes_repo = OrganizationRepository(db, "clientes", org_id)
    nuevo_cliente = clientes_repo.insert(
        {
            "nombre": payload.nombre.strip(),
            "telefono": payload.telefono.strip(),
            "email": (payload.email or "").strip(),
            "notas": (payload.notas or "").strip(),
        }
    )

    if suc_id:
        SecurityManager.registrar_auditoria(
            db=db,
            org_id=org_id,
            suc_id=suc_id,
            usuario=payload.usuario_actual or "Sistema",
            rol=payload.rol_actual or "Operativo",
            accion="CREAR_CLIENTE",
            detalle=f"Cliente registrado: {nuevo_cliente.get('nombre')} ({_enmascarar_telefono(nuevo_cliente.get('telefono'))})",
        )

    return {
        "cliente": _sanitizar_cliente_privado(nuevo_cliente),
        "mensaje": "Cliente registrado exitosamente.",
    }


@router.post("/mascotas")
def crear_mascota(
    payload: MascotaCreate,
    organizacion_id: Optional[str] = Query(default=None),
    sucursal_id: Optional[str] = Query(default=None),
    x_organizacion_id: Optional[str] = Header(default=None),
    x_sucursal_id: Optional[str] = Header(default=None),
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    """
    Crea una mascota en Supabase y genera su codigo_barras único con
    SecurityManager.generar_hash_lealtad(telefono, mascota_uuid) usando el UUID real creado.
    """
    ctx = _resolver_contexto(
        db,
        organizacion_id or payload.organizacion_id,
        sucursal_id or payload.sucursal_id,
        x_organizacion_id,
        x_sucursal_id,
        requiere_sucursal=False,
    )
    org_id = ctx["organizacion_id"]
    suc_id = ctx.get("sucursal_id") or payload.sucursal_id

    clientes_repo = OrganizationRepository(db, "clientes", org_id)
    cliente = clientes_repo.get_by_id(payload.cliente_id)
    if not cliente:
        raise HTTPException(
            status_code=404,
            detail="El cliente especificado no existe en esta organización.",
        )

    mascotas_repo = OrganizationRepository(db, "mascotas", org_id)
    mascota_creada = mascotas_repo.insert(
        {
            "cliente_id": payload.cliente_id,
            "nombre": payload.nombre.strip(),
            "raza": payload.raza.strip(),
            "peso_kg": payload.peso_kg or 0.0,
            "edad": payload.edad or "",
            "alergias_medicas": payload.alergias_medicas or "Ninguna",
            "temperamento": payload.temperamento or "Dócil",
            "numero_navaja": payload.numero_navaja or "",
            "tipo_shampoo": payload.tipo_shampoo or "",
            "estilo_corte": payload.estilo_corte or "",
        }
    )

    mascota_uuid = str(mascota_creada["id"])
    codigo_barras = SecurityManager.generar_hash_lealtad(
        telefono=cliente.get("telefono", ""),
        mascota_uuid=mascota_uuid,
    )

    mascota_actualizada = (
        mascotas_repo.update(mascota_uuid, {"codigo_barras": codigo_barras})
        or {**mascota_creada, "codigo_barras": codigo_barras}
    )

    if suc_id:
        SecurityManager.registrar_auditoria(
            db=db,
            org_id=org_id,
            suc_id=suc_id,
            usuario=payload.usuario_actual or "Sistema",
            rol=payload.rol_actual or "Operativo",
            accion="CREAR_MASCOTA",
            detalle=f"Mascota {mascota_actualizada.get('nombre')} creada con código {codigo_barras}",
        )

    return {
        "mascota": mascota_actualizada,
        "codigo_barras": codigo_barras,
        "mensaje": "Mascota registrada con código de lealtad generado.",
    }


# -------------------------------------------------------------------------
# 3. DISPONIBILIDAD Y CITAS
# -------------------------------------------------------------------------
@router.get("/disponibilidad")
def consultar_disponibilidad(
    fecha: str = Query(..., description="Fecha en formato YYYY-MM-DD"),
    duracion_minutos: int = Query(default=60),
    organizacion_id: Optional[str] = Query(default=None),
    sucursal_id: Optional[str] = Query(default=None),
    x_organizacion_id: Optional[str] = Header(default=None),
    x_sucursal_id: Optional[str] = Header(default=None),
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    ctx = _resolver_contexto(
        db, organizacion_id, sucursal_id, x_organizacion_id, x_sucursal_id
    )
    engine = AvailabilityEngine(
        db=db,
        organizacion_id=ctx["organizacion_id"],
        sucursal_id=ctx["sucursal_id"],
    )
    try:
        return engine.calcular_disponibilidad(
            fecha_str=fecha, duracion_minutos=duracion_minutos
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/disponibilidad/semana")
def consultar_disponibilidad_semana(
    fecha: str = Query(..., description="Fecha de referencia en formato YYYY-MM-DD"),
    duracion_minutos: int = Query(default=60),
    organizacion_id: Optional[str] = Query(default=None),
    sucursal_id: Optional[str] = Query(default=None),
    x_organizacion_id: Optional[str] = Header(default=None),
    x_sucursal_id: Optional[str] = Header(default=None),
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    ctx = _resolver_contexto(
        db, organizacion_id, sucursal_id, x_organizacion_id, x_sucursal_id
    )
    engine = AvailabilityEngine(
        db=db,
        organizacion_id=ctx["organizacion_id"],
        sucursal_id=ctx["sucursal_id"],
    )
    try:
        return engine.calcular_disponibilidad_semana(
            fecha_str=fecha, duracion_minutos=duracion_minutos
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


_ESTANCIA_REGEX = re.compile(r"\[ESTANCIA:([^\]]+)\]")


def _limpiar_tag_no_asistio(notas: Optional[str]) -> str:
    texto = str(notas or "")
    texto = texto.replace("[NO_ASISTIO]", "")
    texto = _ESTANCIA_REGEX.sub("", texto)
    return texto.strip()


def _extraer_etapa_estancia(cita: Dict[str, Any]) -> str:
    notas = str(cita.get("notas_servicio") or "")
    match = _ESTANCIA_REGEX.search(notas)
    if match:
        return match.group(1).strip()
    estado = str(cita.get("estado") or "Programada").lower()
    if estado == "completada":
        return "Entregada"
    if _es_cita_no_asistio(cita):
        return "No asistió"
    if estado in ("cancelada", "cancelado"):
        return "Cancelada"
    return "Por llegar"


def _construir_notas_con_tags(
    notas_limpias: Optional[str],
    no_asistio: bool = False,
    etapa_estancia: Optional[str] = None,
) -> str:
    limpio = _limpiar_tag_no_asistio(notas_limpias)
    prefijos: List[str] = []
    if no_asistio:
        prefijos.append("[NO_ASISTIO]")
    if etapa_estancia and etapa_estancia.strip():
        etapa_clean = etapa_estancia.strip().replace("]", "")
        prefijos.append(f"[ESTANCIA:{etapa_clean}]")
    if limpio:
        prefijos.append(limpio)
    return " ".join(prefijos).strip()


def _es_cita_no_asistio(cita: Dict[str, Any]) -> bool:
    estado = str(cita.get("estado") or "").lower()
    notas = str(cita.get("notas_servicio") or "")
    return estado in ("no asistió", "no asistio") or (
        estado in ("cancelada", "cancelado") and "[NO_ASISTIO]" in notas
    )


@router.get("/citas")
def listar_citas(
    fecha: Optional[str] = Query(default=None),
    fecha_inicio: Optional[str] = Query(default=None),
    fecha_fin: Optional[str] = Query(default=None),
    estado: Optional[str] = Query(default=None),
    organizacion_id: Optional[str] = Query(default=None),
    sucursal_id: Optional[str] = Query(default=None),
    x_organizacion_id: Optional[str] = Header(default=None),
    x_sucursal_id: Optional[str] = Header(default=None),
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    ctx = _resolver_contexto(
        db, organizacion_id, sucursal_id, x_organizacion_id, x_sucursal_id
    )
    org_id, suc_id = ctx["organizacion_id"], ctx["sucursal_id"]
    citas_repo = BranchRepository(db, "citas", org_id, suc_id)
    caja_repo = BranchRepository(db, "caja", org_id, suc_id)

    q = citas_repo.query(
        "*, mascotas(id, nombre, raza, codigo_barras, cliente_id, clientes(id, nombre, telefono))"
    )
    if fecha_inicio and fecha_fin:
        q = q.gte("fecha_hora", f"{fecha_inicio[:10]}T00:00:00").lte(
            "fecha_hora", f"{fecha_fin[:10]}T23:59:59"
        )
    elif fecha:
        q = q.gte("fecha_hora", f"{fecha[:10]}T00:00:00").lte(
            "fecha_hora", f"{fecha[:10]}T23:59:59"
        )
    if estado:
        q = q.eq("estado", estado)

    try:
        res = q.order("fecha_hora", desc=False).execute()
        citas_raw = res.data or []
    except Exception:
        citas_raw = citas_repo.get_all(order_by="fecha_hora", desc=False)

    cita_ids = [c["id"] for c in citas_raw if c.get("id")]
    pagos_por_cita: Dict[str, Dict[str, Any]] = {}
    if cita_ids:
        try:
            res_caja = caja_repo.query("*").in_("cita_id", cita_ids).execute()
            for mov in res_caja.data or []:
                cid = mov.get("cita_id")
                if cid:
                    pagos_por_cita[cid] = mov
        except Exception:
            pass

    por_cobrar_total = 0.0
    pendiente_por_cobrar = 0.0
    cobrado_real = 0.0
    total_efectivo = 0.0
    total_tarjeta = 0.0
    total_transferencia = 0.0

    citas_enriquecidas: List[Dict[str, Any]] = []
    for c in citas_raw:
        cid = c.get("id", "")
        mascota_obj = c.get("mascotas") or {}
        cliente_obj = (
            mascota_obj.get("clientes") if isinstance(mascota_obj, dict) else {}
        ) or {}
        mov_caja = pagos_por_cita.get(cid)

        estado_db = str(c.get("estado") or "Programada")
        no_asistio = _es_cita_no_asistio(c)
        es_completada = estado_db.lower() == "completada"
        es_cancelada = estado_db.lower() in ("cancelada", "cancelado") and not no_asistio

        if es_completada:
            asistencia = "asistio"
            estado_visual = "Asistió"
        elif no_asistio:
            asistencia = "no_asistio"
            estado_visual = "No Asistió"
        elif es_cancelada:
            asistencia = "cancelada"
            estado_visual = "Cancelada"
        else:
            asistencia = "pendiente"
            estado_visual = "Programada"

        etapa_estancia = _extraer_etapa_estancia(c)
        precio_cita = float(c.get("precio") or 0.0)
        monto_pagado = (
            float(mov_caja.get("monto") or precio_cita) if mov_caja else precio_cita
        )
        metodo_pago = (mov_caja.get("metodo_pago") if mov_caja else None) or None

        if not no_asistio and not es_cancelada:
            por_cobrar_total += precio_cita
        if asistencia == "pendiente":
            pendiente_por_cobrar += precio_cita
        if es_completada:
            cobrado_real += monto_pagado
            mp_low = str(metodo_pago or "Efectivo").lower()
            if "tarjeta" in mp_low:
                total_tarjeta += monto_pagado
            elif "transfer" in mp_low:
                total_transferencia += monto_pagado
            else:
                total_efectivo += monto_pagado

        raw_tel = cliente_obj.get("telefono") or ""
        citas_enriquecidas.append(
            {
                **c,
                "notas_servicio_limpias": _limpiar_tag_no_asistio(
                    c.get("notas_servicio")
                ),
                "asistencia": asistencia,
                "estado_visual": estado_visual,
                "etapa_estancia": etapa_estancia,
                "metodo_pago": metodo_pago,
                "mascota_nombre": (
                    mascota_obj.get("nombre")
                    if isinstance(mascota_obj, dict)
                    else None
                )
                or "Mascota",
                "mascota_raza": (
                    mascota_obj.get("raza") if isinstance(mascota_obj, dict) else ""
                )
                or "",
                "mascota_codigo": (
                    mascota_obj.get("codigo_barras")
                    if isinstance(mascota_obj, dict)
                    else ""
                )
                or "",
                "cliente_id": (
                    cliente_obj.get("id") if isinstance(cliente_obj, dict) else None
                ),
                "cliente_nombre": (
                    cliente_obj.get("nombre")
                    if isinstance(cliente_obj, dict)
                    else None
                )
                or "Sin dueño registrado",
                "cliente_telefono": raw_tel,
                "cliente_telefono_enmascarado": _enmascarar_telefono(raw_tel),
            }
        )

    return {
        "citas": citas_enriquecidas,
        "total": len(citas_enriquecidas),
        "resumen_financiero": {
            "por_cobrar_total": round(por_cobrar_total, 2),
            "pendiente_por_cobrar": round(pendiente_por_cobrar, 2),
            "cobrado_real": round(cobrado_real, 2),
            "total_efectivo": round(total_efectivo, 2),
            "total_tarjeta": round(total_tarjeta, 2),
            "total_transferencia": round(total_transferencia, 2),
        },
    }


def _validar_cupo_y_fecha_futura(
    db: Client,
    org_id: str,
    suc_id: str,
    fecha_hora_str: str,
    duracion_minutos: int = 60,
    cita_id_excluir: Optional[str] = None,
) -> None:
    """
    Valida que la fecha/hora no esté en el pasado y que exista cupo disponible
    en el bloque solicitado para impedir sobrecupos simultáneos.
    """
    raw_fh = str(fecha_hora_str or "").strip()
    dt_clean = raw_fh.replace("Z", "")
    if "+" in dt_clean:
        dt_clean = dt_clean.split("+")[0]
    dt_cita = datetime.fromisoformat(dt_clean)
    ahora_local = datetime.now()
    if dt_cita.date() < ahora_local.date():
        raise HTTPException(
            status_code=400,
            detail="No se pueden agendar ni reprogramar citas en fechas pasadas.",
        )
    if dt_cita.date() == ahora_local.date() and dt_cita < ahora_local.replace(
        second=0, microsecond=0
    ):
        raise HTTPException(
            status_code=400,
            detail="No se pueden agendar ni reprogramar citas en un horario que ya pasó el día de hoy.",
        )

    # Verificar capacidad del bloque en AvailabilityEngine para evitar sobrecupos
    try:
        fecha_dia = dt_cita.strftime("%Y-%m-%d")
        hora_hhmm = dt_cita.strftime("%H:%M")
        engine = AvailabilityEngine(db=db, organizacion_id=org_id, sucursal_id=suc_id)
        disp = engine.calcular_disponibilidad(
            fecha_str=fecha_dia, duracion_minutos=duracion_minutos
        )
        if disp.get("cerrado"):
            raise HTTPException(
                status_code=400,
                detail=f"La sucursal se encuentra cerrada el {fecha_dia} ({disp.get('motivo') or 'Día inactivo'}).",
            )
        slots = disp.get("slots") or []
        slot_obj = next((s for s in slots if s.get("hora") == hora_hhmm), None)
        if slot_obj and not slot_obj.get("disponible"):
            # Si estamos reagendando la misma cita que ya estaba en ese mismo horario, permitirlo
            permite_mismo_slot = False
            if cita_id_excluir:
                existente = (
                    db.table("citas")
                    .select("fecha_hora")
                    .eq("id", cita_id_excluir)
                    .limit(1)
                    .execute()
                    .data
                    or []
                )
                if existente and str(existente[0].get("fecha_hora", "")).startswith(
                    f"{fecha_dia}T{hora_hhmm}"
                ):
                    permite_mismo_slot = True
            if not permite_mismo_slot:
                raise HTTPException(
                    status_code=409,
                    detail=f"El bloque de las {hora_hhmm} del {fecha_dia} ya no tiene cupo disponible (sobrecupo bloqueado).",
                )
    except HTTPException:
        raise
    except Exception:
        pass


@router.post("/citas")
def crear_cita(
    payload: CitaCreate,
    organizacion_id: Optional[str] = Query(default=None),
    sucursal_id: Optional[str] = Query(default=None),
    x_organizacion_id: Optional[str] = Header(default=None),
    x_sucursal_id: Optional[str] = Header(default=None),
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    ctx = _resolver_contexto(
        db,
        organizacion_id or payload.organizacion_id,
        sucursal_id or payload.sucursal_id,
        x_organizacion_id,
        x_sucursal_id,
    )
    org_id, suc_id = ctx["organizacion_id"], ctx["sucursal_id"]

    _validar_cupo_y_fecha_futura(
        db=db,
        org_id=org_id,
        suc_id=suc_id,
        fecha_hora_str=payload.fecha_hora,
        duracion_minutos=payload.duracion_minutos or 60,
    )

    citas_repo = BranchRepository(db, "citas", org_id, suc_id)
    notas_con_etapa = _construir_notas_con_tags(
        payload.notas_servicio, no_asistio=False, etapa_estancia="Por llegar"
    )

    nueva_cita = citas_repo.insert(
        {
            "mascota_id": payload.mascota_id,
            "fecha_hora": payload.fecha_hora,
            "servicio": payload.servicio,
            "duracion_minutos": payload.duracion_minutos or 60,
            "estilista": payload.estilista or "Por asignar",
            "precio": payload.precio,
            "estado": payload.estado or "Programada",
            "notas_servicio": notas_con_etapa,
        }
    )

    SecurityManager.registrar_auditoria(
        db=db,
        org_id=org_id,
        suc_id=suc_id,
        usuario=payload.usuario_actual or "Sistema",
        rol=payload.rol_actual or "Operativo",
        accion="AGENDAR_CITA",
        detalle=f"Cita creada: {payload.servicio} ({payload.fecha_hora}) - ${payload.precio}",
    )

    return {"cita": nueva_cita, "mensaje": "Cita agendada correctamente."}


@router.put("/citas/{cita_id}")
def actualizar_o_reagendar_cita(
    cita_id: str,
    payload: CitaUpdate,
    organizacion_id: Optional[str] = Query(default=None),
    sucursal_id: Optional[str] = Query(default=None),
    x_organizacion_id: Optional[str] = Header(default=None),
    x_sucursal_id: Optional[str] = Header(default=None),
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    """
    Permite reagendar una cita (liberando el bloque anterior y validando el nuevo),
    actualizar la etapa de estancia en cabina ('Por llegar', 'Recibida', 'En servicio',
    'Lista para recoger', 'Entregada'), editar precio/estilista/notas o cancelar con aviso
    (distinto de No Asistió).
    """
    ctx = _resolver_contexto(
        db,
        organizacion_id or payload.organizacion_id,
        sucursal_id or payload.sucursal_id,
        x_organizacion_id,
        x_sucursal_id,
    )
    org_id, suc_id = ctx["organizacion_id"], ctx["sucursal_id"]

    citas_repo = BranchRepository(db, "citas", org_id, suc_id)
    cita = citas_repo.get_by_id(cita_id)
    if not cita:
        raise HTTPException(status_code=404, detail="Cita no encontrada.")

    cambios: Dict[str, Any] = {}
    duracion_obj = int(payload.duracion_minutos or cita.get("duracion_minutos") or 60)

    if payload.fecha_hora and payload.fecha_hora != cita.get("fecha_hora"):
        _validar_cupo_y_fecha_futura(
            db=db,
            org_id=org_id,
            suc_id=suc_id,
            fecha_hora_str=payload.fecha_hora,
            duracion_minutos=duracion_obj,
            cita_id_excluir=cita_id,
        )
        cambios["fecha_hora"] = payload.fecha_hora
        # Si una cita cancelada o no-asistió se reagenda, vuelve a estar Programada
        if not payload.estado and str(cita.get("estado", "")).lower() in (
            "cancelada",
            "cancelado",
        ):
            cambios["estado"] = "Programada"

    if payload.servicio is not None and payload.servicio.strip():
        cambios["servicio"] = payload.servicio.strip()
    if payload.duracion_minutos is not None:
        cambios["duracion_minutos"] = duracion_obj
    if payload.estilista is not None and payload.estilista.strip():
        cambios["estilista"] = payload.estilista.strip()
    if payload.precio is not None:
        cambios["precio"] = float(payload.precio)

    estado_objetivo = payload.estado or cambios.get("estado") or cita.get("estado", "Programada")
    es_no_asistio_actual = _es_cita_no_asistio(cita)

    if payload.estado:
        est_low = payload.estado.strip().lower()
        if est_low in ("cancelada", "cancelado"):
            cambios["estado"] = "Cancelada"
            es_no_asistio_actual = False  # Cancelación anticipada != No Asistió
        elif est_low == "programada":
            cambios["estado"] = "Programada"
            es_no_asistio_actual = False
        elif est_low == "completada":
            cambios["estado"] = "Completada"
            es_no_asistio_actual = False

    etapa_actual = (
        payload.etapa_estancia
        if payload.etapa_estancia is not None
        else _extraer_etapa_estancia(cita)
    )
    if cambios.get("estado") == "Cancelada" and not es_no_asistio_actual:
        etapa_actual = "Cancelada"
    elif cambios.get("estado") == "Programada" and etapa_actual in ("Cancelada", "No asistió"):
        etapa_actual = "Por llegar"

    notas_limpias = (
        payload.notas_servicio
        if payload.notas_servicio is not None
        else _limpiar_tag_no_asistio(cita.get("notas_servicio"))
    )
    cambios["notas_servicio"] = _construir_notas_con_tags(
        notas_limpias,
        no_asistio=es_no_asistio_actual,
        etapa_estancia=etapa_actual,
    )

    cita_actualizada = citas_repo.update(cita_id, cambios)

    # Si se canceló o regresó a Programada, limpiar cobro de caja si existía y sincronizar lealtad
    if str(cambios.get("estado", "")).lower() in ("cancelada", "programada"):
        caja_repo = BranchRepository(db, "caja", org_id, suc_id)
        existentes = caja_repo.query("*").eq("cita_id", cita_id).execute().data or []
        for mov in existentes:
            if mov.get("id"):
                caja_repo.delete(mov["id"])

    visitas_actuales = _sincronizar_visitas_mascota(
        db, org_id, cita.get("mascota_id")
    )

    SecurityManager.registrar_auditoria(
        db=db,
        org_id=org_id,
        suc_id=suc_id,
        usuario=payload.usuario_actual or "Operador Agenda",
        rol=payload.rol_actual or "Operativo",
        accion="ACTUALIZAR_CITA",
        detalle=f"Cita {cita_id} actualizada (estado={cita_actualizada.get('estado')}, estancia={etapa_actual}, fecha={cita_actualizada.get('fecha_hora')})",
    )

    return {
        "cita": {
            **cita_actualizada,
            "etapa_estancia": etapa_actual,
            "notas_servicio_limpias": _limpiar_tag_no_asistio(
                cita_actualizada.get("notas_servicio")
            ),
        },
        "visitas_acumuladas_mascota": visitas_actuales,
        "mensaje": "Cita actualizada correctamente.",
    }


@router.post("/citas/{cita_id}/completar")
def completar_cita(
    cita_id: str,
    payload: CitaCompletar,
    organizacion_id: Optional[str] = Query(default=None),
    sucursal_id: Optional[str] = Query(default=None),
    x_organizacion_id: Optional[str] = Header(default=None),
    x_sucursal_id: Optional[str] = Header(default=None),
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    """
    Marca una cita como Completada (Asistió), registra o actualiza automáticamente el ingreso en caja
    y sincroniza el contador de visitas_acumuladas de la mascota en la tabla mascotas.
    """
    ctx = _resolver_contexto(
        db,
        organizacion_id or payload.organizacion_id,
        sucursal_id or payload.sucursal_id,
        x_organizacion_id,
        x_sucursal_id,
    )
    org_id, suc_id = ctx["organizacion_id"], ctx["sucursal_id"]

    citas_repo = BranchRepository(db, "citas", org_id, suc_id)
    cita = citas_repo.get_by_id(cita_id)
    if not cita:
        raise HTTPException(
            status_code=404, detail="Cita no encontrada en esta sucursal."
        )

    monto_cobrado = (
        float(payload.monto)
        if payload.monto is not None
        else float(cita.get("precio") or 0.0)
    )
    estilista_final = payload.estilista or cita.get("estilista") or "General"
    notas_base = (
        payload.notas_servicio
        if payload.notas_servicio is not None
        else cita.get("notas_servicio", "")
    )
    etapa_previa = _extraer_etapa_estancia(cita)
    etapa_final = (
        payload.etapa_estancia
        if payload.etapa_estancia
        else (
            etapa_previa
            if etapa_previa in ("Recibida", "En servicio", "Lista para recoger", "Entregada")
            else "Recibida"
        )
    )
    notas_final = _construir_notas_con_tags(
        notas_base, no_asistio=False, etapa_estancia=etapa_final
    )
    metodo_pago_final = payload.metodo_pago or "Efectivo"

    cita_actualizada = citas_repo.update(
        cita_id,
        {
            "estado": "Completada",
            "precio": monto_cobrado,
            "estilista": estilista_final,
            "notas_servicio": notas_final,
        },
    )

    caja_repo = BranchRepository(db, "caja", org_id, suc_id)
    existentes = caja_repo.query("*").eq("cita_id", cita_id).execute().data or []
    if existentes:
        mov_id = existentes[0]["id"]
        movimiento_caja = caja_repo.update(
            mov_id,
            {
                "concepto": f"Servicio cita: {cita.get('servicio', 'Grooming')}",
                "monto": monto_cobrado,
                "metodo_pago": metodo_pago_final,
                "estilista": estilista_final,
            },
        )
    else:
        movimiento_caja = caja_repo.insert(
            {
                "cita_id": cita_id,
                "concepto": f"Servicio cita: {cita.get('servicio', 'Grooming')}",
                "monto": monto_cobrado,
                "metodo_pago": metodo_pago_final,
                "estilista": estilista_final,
            }
        )

    # Sincronizar visitas_acumuladas en la tabla mascotas para que Padrón, Expediente y Escáner coincidan
    visitas_actuales = _sincronizar_visitas_mascota(
        db, org_id, cita.get("mascota_id")
    )

    SecurityManager.registrar_auditoria(
        db=db,
        org_id=org_id,
        suc_id=suc_id,
        usuario=payload.usuario_actual or "Sistema",
        rol=payload.rol_actual or "Operativo",
        accion="ASISTIO_CITA",
        detalle=f"Cita {cita_id} marcada como Asistió y cobrada (${monto_cobrado} en {metodo_pago_final}) · Lealtad={visitas_actuales}",
    )

    return {
        "cita": cita_actualizada,
        "movimiento_caja": movimiento_caja,
        "visitas_acumuladas_mascota": visitas_actuales,
        "mensaje": f"Cita marcada como Asistió (${monto_cobrado} en {metodo_pago_final}).",
    }


@router.post("/citas/{cita_id}/no-asistio")
def marcar_no_asistio_cita(
    cita_id: str,
    organizacion_id: Optional[str] = Query(default=None),
    sucursal_id: Optional[str] = Query(default=None),
    x_organizacion_id: Optional[str] = Header(default=None),
    x_sucursal_id: Optional[str] = Header(default=None),
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    """
    Marca una cita como No Asistió (guardando estado Cancelada + marcador [NO_ASISTIO]),
    reversa cualquier cobro asociado en caja y sincroniza el contador de lealtad de la mascota.
    """
    ctx = _resolver_contexto(
        db, organizacion_id, sucursal_id, x_organizacion_id, x_sucursal_id
    )
    org_id, suc_id = ctx["organizacion_id"], ctx["sucursal_id"]

    citas_repo = BranchRepository(db, "citas", org_id, suc_id)
    cita = citas_repo.get_by_id(cita_id)
    if not cita:
        raise HTTPException(
            status_code=404, detail="Cita no encontrada en esta sucursal."
        )

    nuevas_notas = _construir_notas_con_tags(
        cita.get("notas_servicio"),
        no_asistio=True,
        etapa_estancia="No asistió",
    )

    cita_actualizada = citas_repo.update(
        cita_id,
        {
            "estado": "Cancelada",
            "notas_servicio": nuevas_notas,
        },
    )

    # Si tenía movimiento en caja previo, eliminarlo para cuadrar corte del día
    caja_repo = BranchRepository(db, "caja", org_id, suc_id)
    existentes = caja_repo.query("*").eq("cita_id", cita_id).execute().data or []
    for mov in existentes:
        if mov.get("id"):
            caja_repo.delete(mov["id"])

    visitas_actuales = _sincronizar_visitas_mascota(
        db, org_id, cita.get("mascota_id")
    )

    SecurityManager.registrar_auditoria(
        db=db,
        org_id=org_id,
        suc_id=suc_id,
        usuario="Operador Agenda",
        rol="Operativo",
        accion="NO_ASISTIO_CITA",
        detalle=f"Cita {cita_id} marcada como No Asistió ({cita.get('servicio', '')}) · Lealtad={visitas_actuales}",
    )

    return {
        "cita": cita_actualizada,
        "visitas_acumuladas_mascota": visitas_actuales,
        "mensaje": "Cita marcada como No Asistió. Se liberó el espacio y se actualizó el balance del día.",
    }


# -------------------------------------------------------------------------
# 4. INVENTARIO Y ESCANEO
# -------------------------------------------------------------------------
@router.get("/inventario")
def listar_inventario(
    organizacion_id: Optional[str] = Query(default=None),
    sucursal_id: Optional[str] = Query(default=None),
    x_organizacion_id: Optional[str] = Header(default=None),
    x_sucursal_id: Optional[str] = Header(default=None),
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    ctx = _resolver_contexto(
        db, organizacion_id, sucursal_id, x_organizacion_id, x_sucursal_id
    )
    inv_repo = BranchRepository(
        db, "inventario", ctx["organizacion_id"], ctx["sucursal_id"]
    )
    productos = inv_repo.get_all(order_by="nombre")
    alertas = [
        p
        for p in productos
        if int(p.get("stock") or 0) <= int(p.get("stock_minimo") or 0)
    ]
    return {
        "inventario": productos,
        "productos": productos,
        "alertas_stock": alertas,
        "total": len(productos),
    }


@router.post("/inventario")
def crear_producto_inventario(
    payload: ProductoCreate,
    organizacion_id: Optional[str] = Query(default=None),
    sucursal_id: Optional[str] = Query(default=None),
    x_organizacion_id: Optional[str] = Header(default=None),
    x_sucursal_id: Optional[str] = Header(default=None),
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    ctx = _resolver_contexto(
        db,
        organizacion_id or payload.organizacion_id,
        sucursal_id or payload.sucursal_id,
        x_organizacion_id,
        x_sucursal_id,
    )
    org_id, suc_id = ctx["organizacion_id"], ctx["sucursal_id"]
    inv_repo = BranchRepository(db, "inventario", org_id, suc_id)

    producto = inv_repo.insert(
        {
            "nombre": payload.nombre.strip(),
            "categoria": payload.categoria,
            "stock": payload.stock,
            "stock_minimo": payload.stock_minimo,
            "precio_venta": payload.precio_venta,
        }
    )

    SecurityManager.registrar_auditoria(
        db=db,
        org_id=org_id,
        suc_id=suc_id,
        usuario=payload.usuario_actual or "Sistema",
        rol=payload.rol_actual or "Operativo",
        accion="ALTA_INVENTARIO",
        detalle=f"Producto creado: {producto.get('nombre')} (stock inicial: {producto.get('stock')})",
    )

    return {"producto": producto, "mensaje": "Producto agregado al inventario."}


@router.post("/escanear")
@router.post("/inventario/escanear")
def procesar_escaneo(
    payload: EscaneoRequest,
    organizacion_id: Optional[str] = Query(default=None),
    sucursal_id: Optional[str] = Query(default=None),
    x_organizacion_id: Optional[str] = Header(default=None),
    x_sucursal_id: Optional[str] = Header(default=None),
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    """
    Procesa el escaneo de un código:
    - Si inicia con PET-, busca la mascota y su dueño (tarjeta de lealtad) con visitas sincronizadas.
    - De lo contrario, busca en el inventario de la sucursal por ID o nombre y aplica la acción
      (consulta, descontar_insumo o vender_producto).
    """
    ctx = _resolver_contexto(
        db,
        organizacion_id or payload.organizacion_id,
        sucursal_id or payload.sucursal_id,
        x_organizacion_id,
        x_sucursal_id,
    )
    org_id, suc_id = ctx["organizacion_id"], ctx["sucursal_id"]
    codigo = (payload.codigo or "").strip()

    if not codigo:
        raise HTTPException(status_code=400, detail="El código escaneado está vacío.")

    # Caso 1: Código de lealtad de mascota (PET-...)
    if codigo.upper().startswith("PET-"):
        mascotas_repo = OrganizationRepository(db, "mascotas", org_id)
        res = (
            mascotas_repo.query("*")
            .eq("codigo_barras", codigo.upper())
            .limit(1)
            .execute()
        )
        if not res.data:
            raise HTTPException(
                status_code=404,
                detail=f"No se encontró mascota con el código {codigo.upper()}",
            )
        mascota = dict(res.data[0])
        visitas_sync = _sincronizar_visitas_mascota(db, org_id, mascota.get("id"))
        mascota["visitas_acumuladas"] = max(
            int(mascota.get("visitas_acumuladas") or 0), visitas_sync
        )
        clientes_repo = OrganizationRepository(db, "clientes", org_id)
        cliente = clientes_repo.get_by_id(mascota["cliente_id"])
        return {
            "tipo": "mascota",
            "mascota": mascota,
            "cliente": _sanitizar_cliente_privado(cliente) if cliente else None,
            "mensaje": f"Mascota identificada: {mascota.get('nombre')}",
        }

    # Caso 2: Producto de inventario por ID o coincidencia de nombre
    inv_repo = BranchRepository(db, "inventario", org_id, suc_id)
    producto = None
    try:
        producto = inv_repo.get_by_id(codigo)
    except Exception:
        producto = None

    if not producto:
        res_nom = inv_repo.query("*").ilike("nombre", f"%{codigo}%").limit(1).execute()
        if res_nom.data:
            producto = res_nom.data[0]

    if not producto:
        raise HTTPException(
            status_code=404,
            detail=f"Código o producto '{codigo}' no encontrado en la sucursal.",
        )

    accion = (payload.accion or "consulta").lower()
    cantidad = max(1, int(payload.cantidad or 1))
    stock_actual = int(producto.get("stock") or 0)

    if accion in ("descontar", "descontar_insumo", "venta", "vender_producto"):
        if stock_actual < cantidad:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente para {producto['nombre']} (disponible: {stock_actual}).",
            )
        nuevo_stock = stock_actual - cantidad
        producto = inv_repo.update(producto["id"], {"stock": nuevo_stock}) or {
            **producto,
            "stock": nuevo_stock,
        }

        movimiento_caja = None
        if accion in ("venta", "vender_producto"):
            monto_venta = float(producto.get("precio_venta") or 0.0) * cantidad
            caja_repo = BranchRepository(db, "caja", org_id, suc_id)
            movimiento_caja = caja_repo.insert(
                {
                    "concepto": f"Venta mostrador ({cantidad}x): {producto['nombre']}",
                    "monto": monto_venta,
                    "metodo_pago": payload.metodo_pago or "Efectivo",
                    "estilista": payload.usuario_actual or "Mostrador",
                }
            )

        SecurityManager.registrar_auditoria(
            db=db,
            org_id=org_id,
            suc_id=suc_id,
            usuario=payload.usuario_actual or "Sistema",
            rol=payload.rol_actual or "Operativo",
            accion="ESCANEO_INVENTARIO",
            detalle=f"{accion}: {cantidad}x {producto['nombre']} (stock restante: {nuevo_stock})",
        )

        return {
            "tipo": "producto",
            "accion": accion,
            "producto": producto,
            "movimiento_caja": movimiento_caja,
            "mensaje": f"Stock actualizado para {producto['nombre']} (restante: {nuevo_stock}).",
        }

    return {
        "tipo": "producto",
        "accion": "consulta",
        "producto": producto,
        "mensaje": f"Producto localizado: {producto['nombre']}",
    }


# -------------------------------------------------------------------------
# 5. CAJA (Listado y Registro Manual)
# -------------------------------------------------------------------------
@router.get("/caja")
def listar_caja(
    organizacion_id: Optional[str] = Query(default=None),
    sucursal_id: Optional[str] = Query(default=None),
    x_organizacion_id: Optional[str] = Header(default=None),
    x_sucursal_id: Optional[str] = Header(default=None),
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    ctx = _resolver_contexto(
        db, organizacion_id, sucursal_id, x_organizacion_id, x_sucursal_id
    )
    caja_repo = BranchRepository(
        db, "caja", ctx["organizacion_id"], ctx["sucursal_id"]
    )
    movimientos = caja_repo.get_all(order_by="fecha", desc=True)
    total_ingresos = round(
        sum(float(m.get("monto") or 0) for m in movimientos), 2
    )
    return {
        "movimientos": movimientos,
        "caja": movimientos,
        "total_ingresos": total_ingresos,
        "total_movimientos": len(movimientos),
    }


@router.post("/caja")
def registrar_movimiento_caja(
    payload: CajaManualCreate,
    organizacion_id: Optional[str] = Query(default=None),
    sucursal_id: Optional[str] = Query(default=None),
    x_organizacion_id: Optional[str] = Header(default=None),
    x_sucursal_id: Optional[str] = Header(default=None),
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    ctx = _resolver_contexto(
        db,
        organizacion_id or payload.organizacion_id,
        sucursal_id or payload.sucursal_id,
        x_organizacion_id,
        x_sucursal_id,
    )
    org_id, suc_id = ctx["organizacion_id"], ctx["sucursal_id"]
    caja_repo = BranchRepository(db, "caja", org_id, suc_id)

    insert_data: Dict[str, Any] = {
        "concepto": payload.concepto.strip(),
        "monto": payload.monto,
        "metodo_pago": payload.metodo_pago or "Efectivo",
        "estilista": payload.estilista or "General",
    }
    if payload.cita_id:
        insert_data["cita_id"] = payload.cita_id

    movimiento = caja_repo.insert(insert_data)

    SecurityManager.registrar_auditoria(
        db=db,
        org_id=org_id,
        suc_id=suc_id,
        usuario=payload.usuario_actual or "Sistema",
        rol=payload.rol_actual or "Operativo",
        accion="REGISTRO_CAJA_MANUAL",
        detalle=f"Movimiento de caja: {payload.concepto} (${payload.monto} - {payload.metodo_pago})",
    )

    return {"movimiento": movimiento, "mensaje": "Movimiento registrado en caja."}


# -------------------------------------------------------------------------
# 6. AGENDA CONFIG (Config, Plantilla Semanal, Servicios y Excepciones)
# -------------------------------------------------------------------------
@router.get("/agenda-config")
def obtener_agenda_config(
    organizacion_id: Optional[str] = Query(default=None),
    sucursal_id: Optional[str] = Query(default=None),
    x_organizacion_id: Optional[str] = Header(default=None),
    x_sucursal_id: Optional[str] = Header(default=None),
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    ctx = _resolver_contexto(
        db, organizacion_id, sucursal_id, x_organizacion_id, x_sucursal_id
    )
    org_id, suc_id = ctx["organizacion_id"], ctx["sucursal_id"]

    config_repo = BranchRepository(db, "agenda_config", org_id, suc_id)
    plantilla_repo = BranchRepository(db, "agenda_plantilla_semanal", org_id, suc_id)
    servicios_repo = BranchRepository(db, "servicios_catalogo", org_id, suc_id)
    excepciones_repo = BranchRepository(db, "agenda_excepciones", org_id, suc_id)

    configs = config_repo.get_all(limit=1)
    config = (
        configs[0]
        if configs
        else {
            "organizacion_id": org_id,
            "sucursal_id": suc_id,
            "modo_asignacion": "global",
            "intervalo_minutos": 60,
        }
    )

    plantilla = plantilla_repo.get_all(order_by="dia_semana", desc=False)
    servicios = servicios_repo.get_all(order_by="nombre", desc=False)
    excepciones = excepciones_repo.get_all(order_by="fecha", desc=False)

    return {
        "config": config,
        "plantilla_semanal": plantilla,
        "servicios_catalogo": servicios,
        "excepciones": excepciones,
    }


@router.put("/agenda-config")
@router.put("/agenda-config/config")
def actualizar_agenda_config(
    payload: AgendaConfigUpdate,
    organizacion_id: Optional[str] = Query(default=None),
    sucursal_id: Optional[str] = Query(default=None),
    x_organizacion_id: Optional[str] = Header(default=None),
    x_sucursal_id: Optional[str] = Header(default=None),
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    ctx = _resolver_contexto(
        db,
        organizacion_id or payload.organizacion_id,
        sucursal_id or payload.sucursal_id,
        x_organizacion_id,
        x_sucursal_id,
    )
    org_id, suc_id = ctx["organizacion_id"], ctx["sucursal_id"]
    config_repo = BranchRepository(db, "agenda_config", org_id, suc_id)

    existente = config_repo.get_all(limit=1)
    if existente:
        actualizado = config_repo.update(
            suc_id,
            {
                "modo_asignacion": payload.modo_asignacion,
                "intervalo_minutos": payload.intervalo_minutos,
            },
            id_column="sucursal_id",
        )
    else:
        actualizado = config_repo.insert(
            {
                "modo_asignacion": payload.modo_asignacion,
                "intervalo_minutos": payload.intervalo_minutos,
            }
        )

    SecurityManager.registrar_auditoria(
        db=db,
        org_id=org_id,
        suc_id=suc_id,
        usuario=payload.usuario_actual or "Sistema",
        rol=payload.rol_actual or "Operativo",
        accion="ACTUALIZAR_AGENDA_CONFIG",
        detalle=f"Modo={payload.modo_asignacion}, Intervalo={payload.intervalo_minutos}m",
    )

    return {"config": actualizado, "mensaje": "Configuración de agenda actualizada."}


@router.put("/agenda-config/plantilla")
def actualizar_plantilla_semanal(
    payload: PlantillaDiaUpdate,
    organizacion_id: Optional[str] = Query(default=None),
    sucursal_id: Optional[str] = Query(default=None),
    x_organizacion_id: Optional[str] = Header(default=None),
    x_sucursal_id: Optional[str] = Header(default=None),
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    ctx = _resolver_contexto(
        db,
        organizacion_id or payload.organizacion_id,
        sucursal_id or payload.sucursal_id,
        x_organizacion_id,
        x_sucursal_id,
    )
    org_id, suc_id = ctx["organizacion_id"], ctx["sucursal_id"]
    plantilla_repo = BranchRepository(db, "agenda_plantilla_semanal", org_id, suc_id)

    items = payload.dias if payload.dias is not None else [payload]
    actualizados = []

    for item in items:
        datos = {
            "activo": item.activo if item.activo is not None else True,
            "hora_apertura": item.hora_apertura or "09:00:00",
            "hora_cierre": item.hora_cierre or "18:00:00",
            "estilistas_activos": item.estilistas_activos if item.estilistas_activos is not None else 2,
            "comida_inicio": item.comida_inicio or "14:00:00",
            "comida_fin": item.comida_fin or "15:00:00",
            "estilistas_en_comida": item.estilistas_en_comida if item.estilistas_en_comida is not None else 1,
        }
        if item.nombre_dia:
            datos["nombre_dia"] = item.nombre_dia

        if item.id:
            reg = plantilla_repo.update(item.id, datos)
            if reg:
                actualizados.append(reg)
        elif item.dia_semana is not None:
            existentes = plantilla_repo.get_all(
                filters={"dia_semana": item.dia_semana}, limit=1
            )
            if existentes:
                reg = plantilla_repo.update(existentes[0]["id"], datos)
            else:
                datos["dia_semana"] = item.dia_semana
                datos["nombre_dia"] = (
                    item.nombre_dia
                    or AvailabilityEngine.DIAS_NOMBRES.get(item.dia_semana, f"Día {item.dia_semana}")
                )
                reg = plantilla_repo.insert(datos)
            if reg:
                actualizados.append(reg)

    SecurityManager.registrar_auditoria(
        db=db,
        org_id=org_id,
        suc_id=suc_id,
        usuario=payload.usuario_actual or "Sistema",
        rol=payload.rol_actual or "Operativo",
        accion="ACTUALIZAR_PLANTILLA_AGENDA",
        detalle=f"Plantilla semanal actualizada ({len(actualizados)} días)",
    )

    return {
        "plantilla_semanal": actualizados,
        "mensaje": "Plantilla semanal actualizada correctamente.",
    }


@router.put("/agenda-config/servicios")
@router.post("/agenda-config/servicios")
def crear_o_actualizar_servicio_catalogo(
    payload: ServicioCreate,
    organizacion_id: Optional[str] = Query(default=None),
    sucursal_id: Optional[str] = Query(default=None),
    x_organizacion_id: Optional[str] = Header(default=None),
    x_sucursal_id: Optional[str] = Header(default=None),
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    ctx = _resolver_contexto(
        db,
        organizacion_id or payload.organizacion_id,
        sucursal_id or payload.sucursal_id,
        x_organizacion_id,
        x_sucursal_id,
    )
    org_id, suc_id = ctx["organizacion_id"], ctx["sucursal_id"]
    servicios_repo = BranchRepository(db, "servicios_catalogo", org_id, suc_id)

    servicio = servicios_repo.insert(
        {
            "nombre": payload.nombre.strip(),
            "duracion_minutos": payload.duracion_minutos,
            "precio_base": payload.precio_base,
            "activo": payload.activo if payload.activo is not None else True,
        }
    )

    SecurityManager.registrar_auditoria(
        db=db,
        org_id=org_id,
        suc_id=suc_id,
        usuario=payload.usuario_actual or "Sistema",
        rol=payload.rol_actual or "Operativo",
        accion="CATALOGO_SERVICIO",
        detalle=f"Servicio guardado: {servicio.get('nombre')} (${servicio.get('precio_base')})",
    )

    return {"servicio": servicio, "mensaje": "Servicio registrado en el catálogo."}


@router.put("/agenda-config/excepciones")
@router.post("/agenda-config/excepciones")
def crear_excepcion_agenda(
    payload: ExcepcionCreate,
    organizacion_id: Optional[str] = Query(default=None),
    sucursal_id: Optional[str] = Query(default=None),
    x_organizacion_id: Optional[str] = Header(default=None),
    x_sucursal_id: Optional[str] = Header(default=None),
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    ctx = _resolver_contexto(
        db,
        organizacion_id or payload.organizacion_id,
        sucursal_id or payload.sucursal_id,
        x_organizacion_id,
        x_sucursal_id,
    )
    org_id, suc_id = ctx["organizacion_id"], ctx["sucursal_id"]
    excepciones_repo = BranchRepository(db, "agenda_excepciones", org_id, suc_id)

    excepcion = excepciones_repo.insert(
        {
            "fecha": payload.fecha[:10],
            "cerrado_todo_el_dia": payload.cerrado_todo_el_dia,
            "hora_inicio": payload.hora_inicio,
            "hora_fin": payload.hora_fin,
            "estilistas_disponibles": payload.estilistas_disponibles,
            "motivo": payload.motivo or "",
        }
    )

    SecurityManager.registrar_auditoria(
        db=db,
        org_id=org_id,
        suc_id=suc_id,
        usuario=payload.usuario_actual or "Sistema",
        rol=payload.rol_actual or "Operativo",
        accion="CREAR_EXCEPCION_AGENDA",
        detalle=f"Excepción de agenda para {payload.fecha}: {payload.motivo}",
    )

    return {"excepcion": excepcion, "mensaje": "Excepción de agenda registrada."}


# -------------------------------------------------------------------------
# 7. PERSONAL Y CHECKOUT DE ASISTENCIA
# -------------------------------------------------------------------------
@router.get("/personal")
def listar_personal(
    organizacion_id: Optional[str] = Query(default=None),
    sucursal_id: Optional[str] = Query(default=None),
    x_organizacion_id: Optional[str] = Header(default=None),
    x_sucursal_id: Optional[str] = Header(default=None),
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    ctx = _resolver_contexto(
        db, organizacion_id, sucursal_id, x_organizacion_id, x_sucursal_id
    )
    org_id, suc_id = ctx["organizacion_id"], ctx["sucursal_id"]

    # Obtener sucursales de la organización para mostrar la sucursal de cada colaborador
    sucs = (
        db.table("sucursales")
        .select("id, nombre, activa")
        .eq("organizacion_id", org_id)
        .order("nombre")
        .execute()
        .data
        or []
    )
    sucs_map = {s["id"]: s["nombre"] for s in sucs}

    # Listar todos los colaboradores de la organización para que el Dueño/Admin gestione toda su plantilla
    personal_raw = (
        db.table("usuarios_crm")
        .select("*")
        .eq("organizacion_id", org_id)
        .order("nombre")
        .execute()
        .data
        or []
    )
    personal = [
        {
            **SecurityManager.normalizar_usuario_crm(u, ocultar_pin=True),
            "sucursal_nombre": sucs_map.get(u.get("sucursal_id"), "Sucursal Matriz"),
        }
        for u in personal_raw
    ]

    asistencias_repo = BranchRepository(db, "asistencias", org_id, suc_id)
    bitacora_repo = BranchRepository(db, "bitacora_auditoria", org_id, suc_id)

    asistencias = asistencias_repo.get_all(order_by="hora_entrada", desc=True, limit=50)
    bitacora_raw = bitacora_repo.get_all(order_by="fecha", desc=True, limit=120)
    bitacora = [
        b for b in bitacora_raw if b.get("accion") != "CONFIG_PERFILES_SNAPSHOT"
    ][:100]
    perfiles = PerfilesPermisosService.obtener_perfiles(db, org_id)

    return {
        "personal": personal,
        "usuarios": personal,
        "sucursales": sucs,
        "asistencias": asistencias,
        "bitacora": bitacora,
        "perfiles": perfiles,
        "catalogo_permisos": CATALOGO_PERMISOS,
        "modulos_matriz": MODULOS_MATRIZ,
        "niveles_acceso": NIVELES_ACCESO,
        "total": len(personal),
    }


@router.get("/bitacora")
def listar_bitacora(
    organizacion_id: Optional[str] = Query(default=None),
    sucursal_id: Optional[str] = Query(default=None),
    x_organizacion_id: Optional[str] = Header(default=None),
    x_sucursal_id: Optional[str] = Header(default=None),
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    ctx = _resolver_contexto(
        db, organizacion_id, sucursal_id, x_organizacion_id, x_sucursal_id
    )
    bitacora_repo = BranchRepository(
        db, "bitacora_auditoria", ctx["organizacion_id"], ctx["sucursal_id"]
    )
    eventos_raw = bitacora_repo.get_all(order_by="fecha", desc=True, limit=120)
    eventos = [
        e for e in eventos_raw if e.get("accion") != "CONFIG_PERFILES_SNAPSHOT"
    ][:100]
    return {"bitacora": eventos, "total": len(eventos)}


# -------------------------------------------------------------------------
# 7B. MATRIZ DE PERFILES Y PERMISOS POR MÓDULO (TABLA PERFILES X ACTIVIDADES)
# -------------------------------------------------------------------------
@router.get("/perfiles")
def obtener_perfiles_permisos(
    organizacion_id: Optional[str] = Query(default=None),
    sucursal_id: Optional[str] = Query(default=None),
    x_organizacion_id: Optional[str] = Header(default=None),
    x_sucursal_id: Optional[str] = Header(default=None),
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    """Devuelve todos los perfiles, los módulos con sus columnas de actividades y los niveles de acceso."""
    ctx = _resolver_contexto(
        db,
        organizacion_id,
        sucursal_id,
        x_organizacion_id,
        x_sucursal_id,
        requiere_sucursal=False,
    )
    org_id = ctx["organizacion_id"]
    perfiles = PerfilesPermisosService.obtener_perfiles(db, org_id)
    return {
        "perfiles": perfiles,
        "catalogo_permisos": CATALOGO_PERMISOS,
        "modulos_matriz": MODULOS_MATRIZ,
        "niveles_acceso": NIVELES_ACCESO,
        "total": len(perfiles),
    }


@router.put("/perfiles-matriz")
def guardar_matriz_perfiles_completa(
    payload: MatrizPerfilesBatchInput,
    organizacion_id: Optional[str] = Query(default=None),
    sucursal_id: Optional[str] = Query(default=None),
    x_organizacion_id: Optional[str] = Header(default=None),
    x_sucursal_id: Optional[str] = Header(default=None),
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    """Guarda en lote toda la tabla matriz de perfiles y sus niveles por actividad en todos los módulos."""
    ctx = _resolver_contexto(
        db,
        organizacion_id or payload.organizacion_id,
        sucursal_id or payload.sucursal_id,
        x_organizacion_id,
        x_sucursal_id,
    )
    org_id, suc_id = ctx["organizacion_id"], ctx["sucursal_id"]

    actuales = PerfilesPermisosService.obtener_perfiles(db, org_id)
    mapa_actual = {p["nombre"].lower(): p for p in actuales}

    nuevos_perfiles: List[Dict[str, Any]] = []
    vistos = set()

    for p_in in payload.perfiles or []:
        nom = str(p_in.get("nombre") or "").strip()
        if not nom or nom.lower() in vistos:
            continue
        vistos.add(nom.lower())
        base_prev = mapa_actual.get(nom.lower())
        norm = PerfilesPermisosService.normalizar_perfil_completo(p_in, base_prev)
        nuevos_perfiles.append(norm)

    # Conservar perfiles que no venían en el payload por seguridad
    for p_act in actuales:
        if p_act["nombre"].lower() not in vistos:
            nuevos_perfiles.append(p_act)

    PerfilesPermisosService.guardar_perfiles(db, org_id, suc_id, nuevos_perfiles)

    SecurityManager.registrar_auditoria(
        db=db,
        org_id=org_id,
        suc_id=suc_id,
        usuario=payload.usuario_actual or "Administrador",
        rol=payload.rol_actual or "Dueño",
        accion="GUARDAR_MATRIZ_PERFILES",
        detalle=f"Matriz de permisos actualizada para {len(nuevos_perfiles)} perfiles.",
    )

    return {
        "perfiles": nuevos_perfiles,
        "catalogo_permisos": CATALOGO_PERMISOS,
        "modulos_matriz": MODULOS_MATRIZ,
        "niveles_acceso": NIVELES_ACCESO,
        "mensaje": "Matriz de permisos de todos los perfiles guardada correctamente.",
    }


@router.post("/perfiles")
def crear_o_actualizar_perfil(
    payload: PerfilPermisosInput,
    organizacion_id: Optional[str] = Query(default=None),
    sucursal_id: Optional[str] = Query(default=None),
    x_organizacion_id: Optional[str] = Header(default=None),
    x_sucursal_id: Optional[str] = Header(default=None),
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    """Crea un nuevo perfil o actualiza los niveles/permisos de un perfil existente."""
    ctx = _resolver_contexto(
        db,
        organizacion_id or payload.organizacion_id,
        sucursal_id or payload.sucursal_id,
        x_organizacion_id,
        x_sucursal_id,
    )
    org_id, suc_id = ctx["organizacion_id"], ctx["sucursal_id"]

    nombre_limpio = (payload.nombre or "").strip()
    if len(nombre_limpio) < 2:
        raise HTTPException(
            status_code=400,
            detail="El nombre del perfil debe tener al menos 2 caracteres.",
        )

    perfiles = PerfilesPermisosService.obtener_perfiles(db, org_id)
    existente_idx = next(
        (i for i, p in enumerate(perfiles) if p["nombre"].lower() == nombre_limpio.lower()),
        None,
    )
    base_existente = perfiles[existente_idx] if existente_idx is not None else None

    perfil_obj = PerfilesPermisosService.normalizar_perfil_completo(
        {
            "nombre": nombre_limpio,
            "descripcion": payload.descripcion,
            "niveles": payload.niveles,
            "permisos": payload.permisos,
        },
        base_existente,
    )

    if not any(
        perfil_obj["permisos"].get(k)
        for k in (
            "ver_dashboard",
            "ver_agenda",
            "ver_clientes",
            "ver_inventario",
            "ver_caja",
            "ver_config",
        )
    ):
        # Si ningún módulo quedó con visibilidad, habilitar al menos Agenda en lectura
        perfil_obj["niveles"]["agenda_acceso_modulo"] = "lectura"
        perfil_obj["permisos"]["ver_agenda"] = True

    accion_audit = "CREAR_PERFIL"
    if existente_idx is not None:
        perfiles[existente_idx] = perfil_obj
        accion_audit = "EDITAR_PERFIL_PERMISOS"
    else:
        perfiles.append(perfil_obj)

    PerfilesPermisosService.guardar_perfiles(db, org_id, suc_id, perfiles)

    activos_count = sum(1 for v in perfil_obj["niveles"].values() if v != "sin_acceso")
    SecurityManager.registrar_auditoria(
        db=db,
        org_id=org_id,
        suc_id=suc_id,
        usuario=payload.usuario_actual or "Administrador",
        rol=payload.rol_actual or "Dueño",
        accion=accion_audit,
        detalle=f"Perfil '{perfil_obj['nombre']}' guardado ({activos_count} actividades con acceso)",
    )

    return {
        "perfil": perfil_obj,
        "perfiles": perfiles,
        "catalogo_permisos": CATALOGO_PERMISOS,
        "modulos_matriz": MODULOS_MATRIZ,
        "niveles_acceso": NIVELES_ACCESO,
        "mensaje": f"Perfil '{perfil_obj['nombre']}' guardado correctamente.",
    }


@router.put("/perfiles/{nombre_perfil}")
def editar_perfil_existente(
    nombre_perfil: str,
    payload: PerfilPermisosInput,
    organizacion_id: Optional[str] = Query(default=None),
    sucursal_id: Optional[str] = Query(default=None),
    x_organizacion_id: Optional[str] = Header(default=None),
    x_sucursal_id: Optional[str] = Header(default=None),
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    """Actualiza los niveles de acceso por actividad, descripción o nombre de un perfil."""
    ctx = _resolver_contexto(
        db,
        organizacion_id or payload.organizacion_id,
        sucursal_id or payload.sucursal_id,
        x_organizacion_id,
        x_sucursal_id,
    )
    org_id, suc_id = ctx["organizacion_id"], ctx["sucursal_id"]

    perfiles = PerfilesPermisosService.obtener_perfiles(db, org_id)
    target_idx = next(
        (i for i, p in enumerate(perfiles) if p["nombre"].lower() == nombre_perfil.strip().lower()),
        None,
    )
    if target_idx is None:
        return crear_o_actualizar_perfil(
            payload, organizacion_id, sucursal_id, x_organizacion_id, x_sucursal_id, db
        )

    actual = perfiles[target_idx]
    nuevo_nom = (payload.nuevo_nombre or payload.nombre or actual["nombre"]).strip()

    if actual.get("es_sistema"):
        nuevo_nom = actual["nombre"]
    elif nuevo_nom.lower() != actual["nombre"].lower():
        if any(
            i != target_idx and p["nombre"].lower() == nuevo_nom.lower()
            for i, p in enumerate(perfiles)
        ):
            raise HTTPException(
                status_code=400,
                detail=f"Ya existe otro perfil llamado '{nuevo_nom}'.",
            )

    actualizado = PerfilesPermisosService.normalizar_perfil_completo(
        {
            "nombre": nuevo_nom,
            "descripcion": payload.descripcion or actual.get("descripcion", ""),
            "niveles": payload.niveles,
            "permisos": payload.permisos,
        },
        actual,
    )
    actualizado["nombre"] = nuevo_nom

    if not any(
        actualizado["permisos"].get(k)
        for k in (
            "ver_dashboard",
            "ver_agenda",
            "ver_clientes",
            "ver_inventario",
            "ver_caja",
            "ver_config",
        )
    ):
        actualizado["niveles"]["agenda_acceso_modulo"] = "lectura"
        actualizado["permisos"]["ver_agenda"] = True

    perfiles[target_idx] = actualizado
    PerfilesPermisosService.guardar_perfiles(db, org_id, suc_id, perfiles)

    activos_count = sum(1 for v in actualizado["niveles"].values() if v != "sin_acceso")
    SecurityManager.registrar_auditoria(
        db=db,
        org_id=org_id,
        suc_id=suc_id,
        usuario=payload.usuario_actual or "Administrador",
        rol=payload.rol_actual or "Dueño",
        accion="EDITAR_PERFIL_PERMISOS",
        detalle=f"Permisos actualizados para perfil '{actualizado['nombre']}' ({activos_count} actividades con acceso)",
    )

    return {
        "perfil": actualizado,
        "perfiles": perfiles,
        "catalogo_permisos": CATALOGO_PERMISOS,
        "modulos_matriz": MODULOS_MATRIZ,
        "niveles_acceso": NIVELES_ACCESO,
        "mensaje": f"Permisos del perfil '{actualizado['nombre']}' actualizados correctamente.",
    }


@router.delete("/perfiles/{nombre_perfil}")
def eliminar_perfil_personalizado(
    nombre_perfil: str,
    organizacion_id: Optional[str] = Query(default=None),
    sucursal_id: Optional[str] = Query(default=None),
    usuario_actual: Optional[str] = Query(default=None),
    rol_actual: Optional[str] = Query(default=None),
    x_organizacion_id: Optional[str] = Header(default=None),
    x_sucursal_id: Optional[str] = Header(default=None),
    x_usuario_actual: Optional[str] = Header(default=None),
    x_rol_actual: Optional[str] = Header(default=None),
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    """Elimina un perfil personalizado si no es un perfil base del sistema ni está asignado a colaboradores."""
    ctx = _resolver_contexto(
        db, organizacion_id, sucursal_id, x_organizacion_id, x_sucursal_id
    )
    org_id, suc_id = ctx["organizacion_id"], ctx["sucursal_id"]

    perfiles = PerfilesPermisosService.obtener_perfiles(db, org_id)
    target = next(
        (p for p in perfiles if p["nombre"].lower() == nombre_perfil.strip().lower()),
        None,
    )
    if not target:
        raise HTTPException(status_code=404, detail="Perfil no encontrado.")

    if target.get("es_sistema") or any(
        b.lower() == target["nombre"].lower() for b in PERFILES_BASE_SISTEMA
    ):
        raise HTTPException(
            status_code=400,
            detail=f"El perfil '{target['nombre']}' es un perfil base del sistema. Puedes editar sus niveles en la tabla, pero no eliminarlo.",
        )

    personal_raw = (
        db.table("usuarios_crm")
        .select("*")
        .eq("organizacion_id", org_id)
        .execute()
        .data
        or []
    )
    en_uso = [
        SecurityManager.normalizar_usuario_crm(u).get("nombre")
        for u in personal_raw
        if str(SecurityManager.normalizar_usuario_crm(u).get("rol", "")).lower()
        == target["nombre"].lower()
    ]
    if en_uso:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede eliminar el perfil '{target['nombre']}' porque está asignado a: {', '.join(en_uso)}.",
        )

    nuevos_perfiles = [
        p for p in perfiles if p["nombre"].lower() != target["nombre"].lower()
    ]
    PerfilesPermisosService.guardar_perfiles(db, org_id, suc_id, nuevos_perfiles)

    SecurityManager.registrar_auditoria(
        db=db,
        org_id=org_id,
        suc_id=suc_id,
        usuario=usuario_actual or x_usuario_actual or "Administrador",
        rol=rol_actual or x_rol_actual or "Dueño",
        accion="ELIMINAR_PERFIL",
        detalle=f"Perfil personalizado eliminado: {target['nombre']}",
    )

    return {
        "eliminado": True,
        "nombre": target["nombre"],
        "perfiles": nuevos_perfiles,
        "catalogo_permisos": CATALOGO_PERMISOS,
        "modulos_matriz": MODULOS_MATRIZ,
        "niveles_acceso": NIVELES_ACCESO,
        "mensaje": f"Perfil '{target['nombre']}' eliminado correctamente.",
    }



@router.post("/personal")
def crear_usuario_personal(
    payload: UsuarioCreate,
    organizacion_id: Optional[str] = Query(default=None),
    sucursal_id: Optional[str] = Query(default=None),
    x_organizacion_id: Optional[str] = Header(default=None),
    x_sucursal_id: Optional[str] = Header(default=None),
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    ctx = _resolver_contexto(
        db,
        organizacion_id or payload.organizacion_id,
        sucursal_id or payload.sucursal_id,
        x_organizacion_id,
        x_sucursal_id,
    )
    org_id = ctx["organizacion_id"]
    suc_id = payload.sucursal_id or ctx["sucursal_id"]

    # Verificar límite de usuarios del plan
    org_res = db.table("organizaciones").select("max_usuarios").eq("id", org_id).limit(1).execute()
    if org_res.data:
        max_usr = int(org_res.data[0].get("max_usuarios") or 10)
        actuales = (
            db.table("usuarios_crm")
            .select("id")
            .eq("organizacion_id", org_id)
            .execute()
            .data
            or []
        )
        if len(actuales) >= max_usr:
            raise HTTPException(
                status_code=400,
                detail=f"Has alcanzado el límite de {max_usr} colaboradores de tu plan actual.",
            )

    # Validar que no exista otro colaborador con el mismo nombre de usuario en la organización
    duplicados = (
        db.table("usuarios_crm")
        .select("id, nombre")
        .eq("organizacion_id", org_id)
        .ilike("nombre", payload.nombre.strip())
        .execute()
        .data
        or []
    )
    if duplicados:
        raise HTTPException(
            status_code=400,
            detail=f"Ya existe un colaborador con el usuario '{payload.nombre.strip()}'.",
        )

    rol_db, pin_db = SecurityManager.codificar_rol_y_pin(payload.rol, payload.pin)
    usuarios_repo = BranchRepository(db, "usuarios_crm", org_id, suc_id)
    nuevo_usuario = usuarios_repo.insert(
        {
            "nombre": payload.nombre.strip(),
            "rol": rol_db,
            "pin": pin_db,
            "activo": payload.activo if payload.activo is not None else True,
        }
    )

    usuario_seguro = SecurityManager.normalizar_usuario_crm(nuevo_usuario, ocultar_pin=True)

    SecurityManager.registrar_auditoria(
        db=db,
        org_id=org_id,
        suc_id=suc_id,
        usuario=payload.usuario_actual or "Sistema",
        rol=payload.rol_actual or "Operativo",
        accion="ALTA_PERSONAL",
        detalle=f"Colaborador registrado: {usuario_seguro.get('nombre')} ({usuario_seguro.get('rol')})",
    )

    return {"usuario": usuario_seguro, "mensaje": "Colaborador registrado exitosamente."}


@router.put("/personal/{usuario_id}")
def actualizar_usuario_personal(
    usuario_id: str,
    payload: UsuarioUpdate,
    organizacion_id: Optional[str] = Query(default=None),
    sucursal_id: Optional[str] = Query(default=None),
    x_organizacion_id: Optional[str] = Header(default=None),
    x_sucursal_id: Optional[str] = Header(default=None),
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    """
    Permite al Dueño / Administrador editar el perfil de un colaborador:
    nombre (usuario de login), rol (vista asignada), contraseña/PIN, sucursal y estado activo.
    """
    ctx = _resolver_contexto(
        db,
        organizacion_id or payload.organizacion_id,
        sucursal_id or payload.sucursal_id,
        x_organizacion_id,
        x_sucursal_id,
    )
    org_id, suc_id = ctx["organizacion_id"], ctx["sucursal_id"]

    usr_res = (
        db.table("usuarios_crm")
        .select("*")
        .eq("id", usuario_id)
        .eq("organizacion_id", org_id)
        .limit(1)
        .execute()
    )
    if not usr_res.data:
        raise HTTPException(status_code=404, detail="Colaborador no encontrado.")
    actual_raw = usr_res.data[0]
    actual_norm = SecurityManager.normalizar_usuario_crm(actual_raw, ocultar_pin=False)

    cambios: Dict[str, Any] = {}
    if payload.nombre is not None and payload.nombre.strip():
        nuevo_nombre = payload.nombre.strip()
        if nuevo_nombre.lower() != str(actual_norm.get("nombre", "")).lower():
            dup = (
                db.table("usuarios_crm")
                .select("id")
                .eq("organizacion_id", org_id)
                .ilike("nombre", nuevo_nombre)
                .neq("id", usuario_id)
                .execute()
                .data
                or []
            )
            if dup:
                raise HTTPException(
                    status_code=400,
                    detail=f"Ya existe otro colaborador con el usuario '{nuevo_nombre}'.",
                )
        cambios["nombre"] = nuevo_nombre

    rol_objetivo = (
        payload.rol.strip()
        if (payload.rol is not None and payload.rol.strip())
        else actual_norm.get("rol", "Estilista")
    )
    pin_objetivo = actual_norm.get("pin", "1234")
    if payload.pin is not None and payload.pin.strip():
        if len(payload.pin.strip()) < 3:
            raise HTTPException(
                status_code=400,
                detail="La nueva contraseña o PIN debe tener al menos 3 caracteres.",
            )
        pin_objetivo = payload.pin.strip()

    if (payload.rol is not None and payload.rol.strip()) or (
        payload.pin is not None and payload.pin.strip()
    ):
        rol_db, pin_db = SecurityManager.codificar_rol_y_pin(rol_objetivo, pin_objetivo)
        cambios["rol"] = rol_db
        cambios["pin"] = pin_db

    if payload.activo is not None:
        cambios["activo"] = payload.activo

    if payload.nueva_sucursal_id:
        cambios["sucursal_id"] = payload.nueva_sucursal_id

    if not cambios:
        usuario_seguro = SecurityManager.normalizar_usuario_crm(actual_raw, ocultar_pin=True)
        return {"usuario": usuario_seguro, "mensaje": "Sin cambios para aplicar."}

    upd = (
        db.table("usuarios_crm")
        .update(cambios)
        .eq("id", usuario_id)
        .eq("organizacion_id", org_id)
        .execute()
    )
    actualizado_raw = upd.data[0] if upd.data else {**actual_raw, **cambios}
    usuario_seguro = SecurityManager.normalizar_usuario_crm(actualizado_raw, ocultar_pin=True)

    SecurityManager.registrar_auditoria(
        db=db,
        org_id=org_id,
        suc_id=suc_id,
        usuario=payload.usuario_actual or "Administrador",
        rol=payload.rol_actual or "Dueño",
        accion="EDITAR_PERSONAL",
        detalle=f"Perfil actualizado: {usuario_seguro.get('nombre')} -> Rol: {usuario_seguro.get('rol')} ({'Activo' if usuario_seguro.get('activo') else 'Inactivo'})",
    )

    return {
        "usuario": usuario_seguro,
        "mensaje": f"Perfil de '{usuario_seguro.get('nombre')}' actualizado correctamente.",
    }


@router.delete("/personal/{usuario_id}")
def eliminar_usuario_personal(
    usuario_id: str,
    organizacion_id: Optional[str] = Query(default=None),
    sucursal_id: Optional[str] = Query(default=None),
    usuario_actual: Optional[str] = Query(default=None),
    rol_actual: Optional[str] = Query(default=None),
    x_organizacion_id: Optional[str] = Header(default=None),
    x_sucursal_id: Optional[str] = Header(default=None),
    x_usuario_actual: Optional[str] = Header(default=None),
    x_rol_actual: Optional[str] = Header(default=None),
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    """
    Elimina un colaborador de la organización y limpia sus registros de asistencia vinculados.
    Protege que no se elimine al único Dueño de la organización.
    """
    ctx = _resolver_contexto(
        db, organizacion_id, sucursal_id, x_organizacion_id, x_sucursal_id
    )
    org_id, suc_id = ctx["organizacion_id"], ctx["sucursal_id"]

    usr_res = (
        db.table("usuarios_crm")
        .select("*")
        .eq("id", usuario_id)
        .eq("organizacion_id", org_id)
        .limit(1)
        .execute()
    )
    if not usr_res.data:
        raise HTTPException(status_code=404, detail="Colaborador no encontrado.")
    objetivo = usr_res.data[0]

    # Evitar dejar la organización sin ningún Dueño/Administrador
    if objetivo.get("rol") == "Dueño":
        otros_duenos = (
            db.table("usuarios_crm")
            .select("id")
            .eq("organizacion_id", org_id)
            .eq("rol", "Dueño")
            .neq("id", usuario_id)
            .execute()
            .data
            or []
        )
        if not otros_duenos:
            raise HTTPException(
                status_code=400,
                detail="No puedes eliminar al único usuario con rol 'Dueño' de la organización. Puedes editar su nombre o contraseña.",
            )

    # Limpiar asistencias vinculadas a este usuario_id para evitar bloqueo por llave foránea
    try:
        db.table("asistencias").delete().eq("usuario_id", usuario_id).execute()
    except Exception:
        pass

    db.table("usuarios_crm").delete().eq("id", usuario_id).eq(
        "organizacion_id", org_id
    ).execute()

    SecurityManager.registrar_auditoria(
        db=db,
        org_id=org_id,
        suc_id=suc_id,
        usuario=usuario_actual or x_usuario_actual or "Administrador",
        rol=rol_actual or x_rol_actual or "Dueño",
        accion="ELIMINAR_PERSONAL",
        detalle=f"Colaborador eliminado: {objetivo.get('nombre')} ({objetivo.get('rol')})",
    )

    return {
        "eliminado": True,
        "usuario_id": usuario_id,
        "mensaje": f"Colaborador '{objetivo.get('nombre')}' eliminado permanentemente.",
    }



@router.post("/checkout")
@router.post("/asistencias/checkout")
def registrar_checkout(
    payload: CheckOutRequest,
    organizacion_id: Optional[str] = Query(default=None),
    sucursal_id: Optional[str] = Query(default=None),
    x_organizacion_id: Optional[str] = Header(default=None),
    x_sucursal_id: Optional[str] = Header(default=None),
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    """
    Registra la hora de salida y el monto de corte de caja en la tabla asistencias.
    """
    ctx = _resolver_contexto(
        db,
        organizacion_id or payload.organizacion_id,
        sucursal_id or payload.sucursal_id,
        x_organizacion_id,
        x_sucursal_id,
    )
    org_id, suc_id = ctx["organizacion_id"], ctx["sucursal_id"]
    asistencias_repo = BranchRepository(db, "asistencias", org_id, suc_id)

    asistencia_id = payload.asistencia_id
    if not asistencia_id and payload.usuario_id:
        abiertas = (
            asistencias_repo.query("*")
            .eq("usuario_id", payload.usuario_id)
            .is_("hora_salida", "null")
            .order("hora_entrada", desc=True)
            .limit(1)
            .execute()
        )
        if abiertas.data:
            asistencia_id = abiertas.data[0]["id"]

    if not asistencia_id:
        ultimas = (
            asistencias_repo.query("*")
            .is_("hora_salida", "null")
            .order("hora_entrada", desc=True)
            .limit(1)
            .execute()
        )
        if ultimas.data:
            asistencia_id = ultimas.data[0]["id"]

    if not asistencia_id:
        raise HTTPException(
            status_code=404,
            detail="No se encontró un registro de asistencia abierto para cerrar turno.",
        )

    ahora_iso = datetime.now(timezone.utc).isoformat()
    actualizada = asistencias_repo.update(
        asistencia_id,
        {
            "hora_salida": ahora_iso,
            "monto_corte_caja": payload.monto_corte_caja,
        },
    )

    SecurityManager.registrar_auditoria(
        db=db,
        org_id=org_id,
        suc_id=suc_id,
        usuario=payload.usuario_actual or "Sistema",
        rol=payload.rol_actual or "Operativo",
        accion="CHECKOUT_ASISTENCIA",
        detalle=f"Salida de turno registrada (corte de caja=${payload.monto_corte_caja})",
    )

    return {
        "asistencia": actualizada,
        "mensaje": "Salida y corte de caja registrados correctamente.",
    }
