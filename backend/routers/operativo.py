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
    ClienteCreate,
    EscaneoRequest,
    ExcepcionCreate,
    MascotaCreate,
    PlantillaDiaUpdate,
    ProductoCreate,
    ServicioCreate,
    UsuarioCreate,
    UsuarioUpdate,
)
from backend.services.disponibilidad import AvailabilityEngine

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

    hoy_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    citas_hoy = [
        c for c in citas if str(c.get("fecha_hora", "")).startswith(hoy_str)
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
            "ingresos_totales": round(ingresos_totales, 2),
            "ingresos_hoy": round(ingresos_hoy, 2),
            "ticket_promedio": ticket_promedio,
            "citas_totales": len(citas),
            "citas_hoy": len(citas_hoy),
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
# 2. CLIENTES Y MASCOTAS (Búsqueda Privada y Creación con Hash de Lealtad)
# -------------------------------------------------------------------------
@router.get("/clientes/buscar")
def buscar_clientes_privado(
    q: str = Query(default="", description="Término de búsqueda: teléfono, nombre, mascota o código PET-"),
    organizacion_id: Optional[str] = Query(default=None),
    x_organizacion_id: Optional[str] = Header(default=None),
    db: Client = Depends(get_db),
) -> Dict[str, Any]:
    """
    Búsqueda privada de clientes y sus mascotas por teléfono, nombre de cliente,
    nombre de mascota o código de barras (PET-...), sin exponer el padrón completo.
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
        resultados.append({**cliente, "mascotas": mascotas_cliente})

    return {
        "resultados": resultados,
        "clientes": resultados,
        "total": len(resultados),
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
            detalle=f"Cliente registrado: {nuevo_cliente.get('nombre')} ({nuevo_cliente.get('telefono')})",
        )

    return {"cliente": nuevo_cliente, "mensaje": "Cliente registrado exitosamente."}


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


@router.get("/citas")
def listar_citas(
    fecha: Optional[str] = Query(default=None),
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

    q = citas_repo.query("*, mascotas(id, nombre, raza, codigo_barras, cliente_id, clientes(id, nombre, telefono))")
    if fecha:
        q = q.gte("fecha_hora", f"{fecha[:10]}T00:00:00").lte(
            "fecha_hora", f"{fecha[:10]}T23:59:59"
        )
    if estado:
        q = q.eq("estado", estado)

    try:
        res = q.order("fecha_hora", desc=False).execute()
        citas = res.data or []
    except Exception:
        # Fallback si no existe relación embebida en PostgREST
        citas = citas_repo.get_all(order_by="fecha_hora", desc=False)

    return {"citas": citas, "total": len(citas)}


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
    citas_repo = BranchRepository(db, "citas", org_id, suc_id)

    nueva_cita = citas_repo.insert(
        {
            "mascota_id": payload.mascota_id,
            "fecha_hora": payload.fecha_hora,
            "servicio": payload.servicio,
            "duracion_minutos": payload.duracion_minutos or 60,
            "estilista": payload.estilista or "Por asignar",
            "precio": payload.precio,
            "estado": payload.estado or "Programada",
            "notas_servicio": payload.notas_servicio or "",
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
    Marca una cita como Completada y registra automáticamente el ingreso en caja.
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
    notas_final = (
        payload.notas_servicio
        if payload.notas_servicio is not None
        else cita.get("notas_servicio", "")
    )

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
    movimiento_caja = caja_repo.insert(
        {
            "cita_id": cita_id,
            "concepto": f"Servicio cita: {cita.get('servicio', 'Grooming')}",
            "monto": monto_cobrado,
            "metodo_pago": payload.metodo_pago or "Efectivo",
            "estilista": estilista_final,
        }
    )

    SecurityManager.registrar_auditoria(
        db=db,
        org_id=org_id,
        suc_id=suc_id,
        usuario=payload.usuario_actual or "Sistema",
        rol=payload.rol_actual or "Operativo",
        accion="COMPLETAR_CITA",
        detalle=f"Cita {cita_id} completada y cobrada (${monto_cobrado} en {payload.metodo_pago})",
    )

    return {
        "cita": cita_actualizada,
        "movimiento_caja": movimiento_caja,
        "mensaje": "Cita completada e ingreso registrado en caja.",
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
    - Si inicia con PET-, busca la mascota y su dueño (tarjeta de lealtad).
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
        mascota = res.data[0]
        clientes_repo = OrganizationRepository(db, "clientes", org_id)
        cliente = clientes_repo.get_by_id(mascota["cliente_id"])
        return {
            "tipo": "mascota",
            "mascota": mascota,
            "cliente": cliente,
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
        .select("id, organizacion_id, sucursal_id, nombre, rol, activo, created_at")
        .eq("organizacion_id", org_id)
        .order("nombre")
        .execute()
        .data
        or []
    )
    personal = [
        {**u, "sucursal_nombre": sucs_map.get(u.get("sucursal_id"), "Sucursal Matriz")}
        for u in personal_raw
    ]

    asistencias_repo = BranchRepository(db, "asistencias", org_id, suc_id)
    bitacora_repo = BranchRepository(db, "bitacora_auditoria", org_id, suc_id)

    asistencias = asistencias_repo.get_all(order_by="hora_entrada", desc=True, limit=50)
    bitacora = bitacora_repo.get_all(order_by="fecha", desc=True, limit=100)

    return {
        "personal": personal,
        "usuarios": personal,
        "sucursales": sucs,
        "asistencias": asistencias,
        "bitacora": bitacora,
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
    eventos = bitacora_repo.get_all(order_by="fecha", desc=True, limit=100)
    return {"bitacora": eventos, "total": len(eventos)}


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

    usuarios_repo = BranchRepository(db, "usuarios_crm", org_id, suc_id)
    nuevo_usuario = usuarios_repo.insert(
        {
            "nombre": payload.nombre.strip(),
            "rol": payload.rol,
            "pin": payload.pin.strip(),
            "activo": payload.activo if payload.activo is not None else True,
        }
    )

    SecurityManager.registrar_auditoria(
        db=db,
        org_id=org_id,
        suc_id=suc_id,
        usuario=payload.usuario_actual or "Sistema",
        rol=payload.rol_actual or "Operativo",
        accion="ALTA_PERSONAL",
        detalle=f"Colaborador registrado: {nuevo_usuario.get('nombre')} ({nuevo_usuario.get('rol')})",
    )

    usuario_seguro = {k: v for k, v in nuevo_usuario.items() if k != "pin"}
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
    actual = usr_res.data[0]

    cambios: Dict[str, Any] = {}
    if payload.nombre is not None and payload.nombre.strip():
        nuevo_nombre = payload.nombre.strip()
        if nuevo_nombre.lower() != str(actual.get("nombre", "")).lower():
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

    if payload.rol is not None and payload.rol.strip():
        cambios["rol"] = payload.rol.strip()

    if payload.pin is not None and payload.pin.strip():
        if len(payload.pin.strip()) < 3:
            raise HTTPException(
                status_code=400,
                detail="La nueva contraseña o PIN debe tener al menos 3 caracteres.",
            )
        cambios["pin"] = payload.pin.strip()

    if payload.activo is not None:
        cambios["activo"] = payload.activo

    if payload.nueva_sucursal_id:
        cambios["sucursal_id"] = payload.nueva_sucursal_id

    if not cambios:
        usuario_seguro = {k: v for k, v in actual.items() if k != "pin"}
        return {"usuario": usuario_seguro, "mensaje": "Sin cambios para aplicar."}

    upd = (
        db.table("usuarios_crm")
        .update(cambios)
        .eq("id", usuario_id)
        .eq("organizacion_id", org_id)
        .execute()
    )
    actualizado = upd.data[0] if upd.data else {**actual, **cambios}

    SecurityManager.registrar_auditoria(
        db=db,
        org_id=org_id,
        suc_id=suc_id,
        usuario=payload.usuario_actual or "Administrador",
        rol=payload.rol_actual or "Dueño",
        accion="EDITAR_PERSONAL",
        detalle=f"Perfil actualizado: {actualizado.get('nombre')} -> Rol: {actualizado.get('rol')} ({'Activo' if actualizado.get('activo') else 'Inactivo'})",
    )

    usuario_seguro = {k: v for k, v in actualizado.items() if k != "pin"}
    return {
        "usuario": usuario_seguro,
        "mensaje": f"Perfil de '{actualizado.get('nombre')}' actualizado correctamente.",
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
