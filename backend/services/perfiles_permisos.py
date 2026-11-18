import copy
import json
from pathlib import Path
from typing import Any, Dict, List, Optional

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "perfiles_permisos.json"

# Niveles jerárquicos de acceso para cada actividad en la matriz
NIVELES_ACCESO: List[Dict[str, Any]] = [
    {
        "id": "sin_acceso",
        "orden": 0,
        "nombre": "Sin Acceso",
        "etiqueta_corta": "Sin Acceso",
        "descripcion": "Bloqueado: no puede ver ni ejecutar esta actividad.",
        "color": "slate",
    },
    {
        "id": "lectura",
        "orden": 1,
        "nombre": "Solo Visibilidad (Lectura)",
        "etiqueta_corta": "Visibilidad",
        "descripcion": "Puede ver y consultar la información, sin crear ni modificar registros.",
        "color": "blue",
    },
    {
        "id": "operacion",
        "orden": 2,
        "nombre": "Creación y Operación",
        "etiqueta_corta": "Operación",
        "descripcion": "Puede ver, crear registros y ejecutar acciones operativas del día a día.",
        "color": "emerald",
    },
    {
        "id": "edicion_total",
        "orden": 3,
        "nombre": "Edición Total / Administración",
        "etiqueta_corta": "Edición Total",
        "descripcion": "Control completo: ver, crear, editar, corregir, cancelar o eliminar.",
        "color": "indigo",
    },
]

NIVELES_VALIDOS = {n["id"] for n in NIVELES_ACCESO}

# Catálogo de Módulos y sus Columnas de Actividades (Encabezados de la Tabla)
MODULOS_MATRIZ: List[Dict[str, Any]] = [
    {
        "id": "agenda",
        "nombre": "Agenda, Turnos y Citas",
        "icono": "fa-calendar-days",
        "descripcion": "Calendario diario y semanal, bloques de horario, asistencia de mascotas y cobro de citas.",
        "actividades": [
            {
                "key": "agenda_acceso_modulo",
                "titulo": "Acceso al Calendario de Agenda",
                "subtitulo": "Ver pestaña Agenda (Día / Semana) y citas programadas",
                "es_acceso_modulo": True,
                "tab": "agenda",
            },
            {
                "key": "agenda_kpis_cobro_dia",
                "titulo": "KPIs Financieros del Día",
                "subtitulo": "Ver cuánto se va a cobrar, cobrado real, efectivo y tarjeta",
            },
            {
                "key": "agenda_crear_citas",
                "titulo": "Agendar Nuevas Citas",
                "subtitulo": "Seleccionar bloques disponibles y registrar turnos futuros",
            },
            {
                "key": "agenda_asistencia_cobro",
                "titulo": "Marcar Asistió / No Asistió y Cobrar",
                "subtitulo": "Confirmar asistencia en tarjeta de mascota y registrar pago",
            },
            {
                "key": "agenda_cancelar_editar",
                "titulo": "Editar Citas, Precios y Notas",
                "subtitulo": "Modificar precio pactado, estilista asignado o cancelar cita",
            },
        ],
    },
    {
        "id": "clientes",
        "nombre": "Clientes, Mascotas y Expedientes",
        "icono": "fa-dog",
        "descripcion": "Buscador lateral privado, expediente clínico de mascotas y base de datos completa.",
        "actividades": [
            {
                "key": "cli_acceso_padron_completo",
                "titulo": "Módulo Base de Datos Completa",
                "subtitulo": "Ver tabla general de Clientes y Mascotas con filtros por columna",
                "es_acceso_modulo": True,
                "tab": "clientes",
            },
            {
                "key": "cli_buscador_lateral",
                "titulo": "Buscador Lateral de Cuentas",
                "subtitulo": "Buscar clientes por nombre, código PET- o últimos 4 dígitos",
            },
            {
                "key": "cli_expediente_perfil",
                "titulo": "Expediente y Perfil de Cliente",
                "subtitulo": "Abrir pop-up de perfil, historial de servicios y ficha técnica",
            },
            {
                "key": "cli_alta_edicion_clientes",
                "titulo": "Alta y Edición de Clientes (Dueños)",
                "subtitulo": "Botón Registrar Nuevo Cliente y edición de datos del dueño",
            },
            {
                "key": "cli_alta_edicion_mascotas",
                "titulo": "Alta y Ficha Clínica de Mascotas",
                "subtitulo": "Agregar mascotas al dueño, raza, alergias, navaja y shampoo",
            },
        ],
    },
    {
        "id": "dashboard",
        "nombre": "Dashboard e Indicadores",
        "icono": "fa-chart-pie",
        "descripcion": "Métricas ejecutivas, ingresos acumulados, gráficas de desempeño y alertas.",
        "actividades": [
            {
                "key": "dash_acceso_modulo",
                "titulo": "Acceso al Módulo Dashboard",
                "subtitulo": "Ver pestaña Dashboard en el menú principal",
                "es_acceso_modulo": True,
                "tab": "dashboard",
            },
            {
                "key": "dash_kpis_financieros",
                "titulo": "KPIs de Ingresos y Ticket Promedio",
                "subtitulo": "Consultar ingresos históricos, ingresos de hoy y métricas de caja",
            },
            {
                "key": "dash_graficas_operativas",
                "titulo": "Gráficas por Servicio y Estilista",
                "subtitulo": "Visualizar distribución de citas, métodos de pago y productividad",
            },
            {
                "key": "dash_alertas_stock",
                "titulo": "Alertas de Inventario y Turnos",
                "subtitulo": "Monitorear productos en stock crítico y próximas citas",
            },
        ],
    },
    {
        "id": "inventario",
        "nombre": "Inventario y Terminal Escáner",
        "icono": "fa-boxes-stacked",
        "descripcion": "Catálogo de insumos y productos comerciales, control de existencias y lector de barras.",
        "actividades": [
            {
                "key": "inv_acceso_modulo",
                "titulo": "Acceso al Módulo Inventario",
                "subtitulo": "Ver pestaña Inventario y tabla de existencias",
                "es_acceso_modulo": True,
                "tab": "inventario",
            },
            {
                "key": "inv_catalogo_productos",
                "titulo": "Alta y Edición de Productos",
                "subtitulo": "Registrar nuevos productos, categorías, stock mínimo y precios",
            },
            {
                "key": "inv_escaner_descuento",
                "titulo": "Escáner: Consumo de Insumos",
                "subtitulo": "Descontar shampoo o material interno mediante código de barras",
            },
            {
                "key": "inv_escaner_venta",
                "titulo": "Escáner: Venta de Productos",
                "subtitulo": "Vender accesorios/alimento con código y registrar cobro automático",
            },
        ],
    },
    {
        "id": "caja",
        "nombre": "Caja, Cobros y Cortes",
        "icono": "fa-cash-register",
        "descripcion": "Flujo de efectivo, pagos con tarjeta/transferencia, ingresos manuales y cierre de turno.",
        "actividades": [
            {
                "key": "caja_acceso_modulo",
                "titulo": "Acceso al Módulo Caja y Cobros",
                "subtitulo": "Ver pestaña Caja y bitácora de transacciones financieras",
                "es_acceso_modulo": True,
                "tab": "caja",
            },
            {
                "key": "caja_movimientos_manuales",
                "titulo": "Registrar Ingresos Manuales",
                "subtitulo": "Capturar cobros directos, propinas o conceptos adicionales",
            },
            {
                "key": "caja_corte_turno",
                "titulo": "Corte de Caja y Arqueo",
                "subtitulo": "Declarar efectivo al cerrar turno y auditar totales por método",
            },
        ],
    },
    {
        "id": "config",
        "nombre": "Configuración, Personal y Perfiles",
        "icono": "fa-sliders",
        "descripcion": "Reglas de agenda, horarios semanales, catálogo de servicios, plantilla y matriz de permisos.",
        "actividades": [
            {
                "key": "cfg_acceso_modulo",
                "titulo": "Acceso a Configuración y Personal",
                "subtitulo": "Ver pestaña Configuración y Personal en el menú",
                "es_acceso_modulo": True,
                "tab": "config",
            },
            {
                "key": "cfg_horarios_plantilla",
                "titulo": "Horarios, Capacidad y Excepciones",
                "subtitulo": "Editar apertura/cierre, estilistas activos y bloqueos de calendario",
            },
            {
                "key": "cfg_catalogo_servicios",
                "titulo": "Catálogo de Servicios y Precios",
                "subtitulo": "Crear y actualizar servicios de estética, tiempos y tarifas base",
            },
            {
                "key": "cfg_gestion_personal",
                "titulo": "Administración de Colaboradores",
                "subtitulo": "Dar de alta usuarios, asignar perfil, cambiar contraseña o eliminar",
            },
            {
                "key": "cfg_perfiles_permisos",
                "titulo": "Matriz de Perfiles e Impersonate",
                "subtitulo": "Crear/editar perfiles, configurar esta tabla y simular vistas (Impersonate)",
            },
        ],
    },
]

TODAS_ACTIVIDADES_KEYS: List[str] = [
    act["key"]
    for mod in MODULOS_MATRIZ
    for act in mod.get("actividades", [])
]

# Catálogo plano de compatibilidad para consumidores que consulten permisos booleanos
CATALOGO_PERMISOS: List[Dict[str, str]] = [
    {"key": "ver_dashboard", "grupo": "ver", "titulo": "Ver módulo Dashboard", "descripcion": "Acceso a KPIs financieros y gráficas.", "tab": "dashboard"},
    {"key": "ver_agenda", "grupo": "ver", "titulo": "Ver módulo Agenda y Turnos", "descripcion": "Acceso al calendario diario y semanal.", "tab": "agenda"},
    {"key": "ver_clientes", "grupo": "ver", "titulo": "Ver módulo Clientes y Expedientes", "descripcion": "Acceso a la base de datos completa de clientes y mascotas.", "tab": "clientes"},
    {"key": "ver_inventario", "grupo": "ver", "titulo": "Ver módulo Inventario y Escáner", "descripcion": "Acceso al catálogo de productos y escáner.", "tab": "inventario"},
    {"key": "ver_caja", "grupo": "ver", "titulo": "Ver módulo Caja y Cobros", "descripcion": "Acceso al historial de cobros y movimientos.", "tab": "caja"},
    {"key": "ver_config", "grupo": "ver", "titulo": "Ver módulo Configuración y Personal", "descripcion": "Acceso a configuración, personal y perfiles.", "tab": "config"},
    {"key": "buscar_clientes", "grupo": "hacer", "titulo": "Buscar clientes y consultar expedientes", "descripcion": "Usar el buscador lateral para abrir perfiles."},
    {"key": "crear_clientes_mascotas", "grupo": "hacer", "titulo": "Registrar nuevos clientes y mascotas", "descripcion": "Dar de alta dueños y agregar mascotas."},
    {"key": "agendar_citas", "grupo": "hacer", "titulo": "Agendar nuevas citas", "descripcion": "Crear citas en bloques disponibles."},
    {"key": "gestionar_asistencia_citas", "grupo": "hacer", "titulo": "Marcar Asistió / No Asistió y cobrar", "descripcion": "Confirmar asistencia y registrar cobro."},
    {"key": "gestionar_inventario", "grupo": "hacer", "titulo": "Operar inventario y escáner", "descripcion": "Crear productos y usar escáner."},
    {"key": "registrar_caja", "grupo": "hacer", "titulo": "Registrar ingresos manuales en Caja", "descripcion": "Capturar movimientos manuales en caja."},
    {"key": "editar_configuracion", "grupo": "hacer", "titulo": "Modificar configuración, personal y perfiles", "descripcion": "Editar horarios, servicios, personal y perfiles."},
    {"key": "usar_impersonate", "grupo": "hacer", "titulo": "Usar Modo Impersonate", "descripcion": "Simular vistas de otros perfiles o usuarios."},
]

PERFILES_BASE_SISTEMA = {"Dueño", "Administrador", "Recepcionista", "Cajero", "Estilista"}


def _derivar_permisos_booleanos_desde_niveles(niveles: Dict[str, str], es_dueno: bool = False) -> Dict[str, bool]:
    """
    Calcula las banderas booleanas de compatibilidad (`ver_*` y acciones) a partir
    del diccionario de niveles por actividad (`sin_acceso`, `lectura`, `operacion`, `edicion_total`).
    """
    def tiene_visibilidad(key: str) -> bool:
        return niveles.get(key, "sin_acceso") in ("lectura", "operacion", "edicion_total")

    def tiene_operacion(key: str) -> bool:
        return niveles.get(key, "sin_acceso") in ("operacion", "edicion_total")

    permisos = {
        "ver_dashboard": tiene_visibilidad("dash_acceso_modulo"),
        "ver_agenda": tiene_visibilidad("agenda_acceso_modulo"),
        "ver_clientes": tiene_visibilidad("cli_acceso_padron_completo"),
        "ver_inventario": tiene_visibilidad("inv_acceso_modulo"),
        "ver_caja": tiene_visibilidad("caja_acceso_modulo"),
        "ver_config": tiene_visibilidad("cfg_acceso_modulo"),
        "buscar_clientes": tiene_visibilidad("cli_buscador_lateral") or tiene_visibilidad("cli_expediente_perfil"),
        "crear_clientes_mascotas": tiene_operacion("cli_alta_edicion_clientes") or tiene_operacion("cli_alta_edicion_mascotas"),
        "agendar_citas": tiene_operacion("agenda_crear_citas"),
        "gestionar_asistencia_citas": tiene_operacion("agenda_asistencia_cobro"),
        "gestionar_inventario": tiene_operacion("inv_catalogo_productos") or tiene_operacion("inv_escaner_descuento") or tiene_operacion("inv_escaner_venta"),
        "registrar_caja": tiene_operacion("caja_movimientos_manuales"),
        "editar_configuracion": (
            tiene_operacion("cfg_horarios_plantilla")
            or tiene_operacion("cfg_catalogo_servicios")
            or tiene_operacion("cfg_gestion_personal")
            or tiene_operacion("cfg_perfiles_permisos")
        ),
        "usar_impersonate": tiene_operacion("cfg_perfiles_permisos"),
    }
    if es_dueno:
        permisos["ver_config"] = True
        permisos["editar_configuracion"] = True
        permisos["usar_impersonate"] = True
    return permisos


def _derivar_niveles_desde_permisos_booleanos(permisos: Dict[str, Any]) -> Dict[str, str]:
    """Convierte un perfil legado basado solo en booleanos al mapa completo de niveles por actividad."""
    p = permisos or {}
    es_admin = bool(p.get("editar_configuracion"))
    nivel_act = "edicion_total" if es_admin else "operacion"

    return {
        # Agenda
        "agenda_acceso_modulo": nivel_act if p.get("ver_agenda", True) else "sin_acceso",
        "agenda_kpis_cobro_dia": "lectura" if (p.get("ver_caja") or p.get("ver_dashboard") or es_admin) else "sin_acceso",
        "agenda_crear_citas": nivel_act if p.get("agendar_citas") else ("lectura" if p.get("ver_agenda") else "sin_acceso"),
        "agenda_asistencia_cobro": nivel_act if p.get("gestionar_asistencia_citas") else ("lectura" if p.get("ver_agenda") else "sin_acceso"),
        "agenda_cancelar_editar": "edicion_total" if es_admin else ("operacion" if p.get("agendar_citas") else "lectura"),
        # Clientes
        "cli_acceso_padron_completo": ("edicion_total" if es_admin else "lectura") if p.get("ver_clientes") else "sin_acceso",
        "cli_buscador_lateral": nivel_act if p.get("buscar_clientes", True) else "sin_acceso",
        "cli_expediente_perfil": nivel_act if p.get("crear_clientes_mascotas") else ("lectura" if p.get("buscar_clientes", True) else "sin_acceso"),
        "cli_alta_edicion_clientes": nivel_act if p.get("crear_clientes_mascotas") else "sin_acceso",
        "cli_alta_edicion_mascotas": nivel_act if p.get("crear_clientes_mascotas") else ("lectura" if p.get("buscar_clientes") else "sin_acceso"),
        # Dashboard
        "dash_acceso_modulo": ("edicion_total" if es_admin else "lectura") if p.get("ver_dashboard") else "sin_acceso",
        "dash_kpis_financieros": ("edicion_total" if es_admin else "lectura") if p.get("ver_dashboard") else "sin_acceso",
        "dash_graficas_operativas": ("edicion_total" if es_admin else "lectura") if p.get("ver_dashboard") else "sin_acceso",
        "dash_alertas_stock": ("edicion_total" if es_admin else "lectura") if (p.get("ver_dashboard") or p.get("ver_inventario")) else "sin_acceso",
        # Inventario
        "inv_acceso_modulo": nivel_act if p.get("ver_inventario") else "sin_acceso",
        "inv_catalogo_productos": "edicion_total" if es_admin else ("operacion" if p.get("gestionar_inventario") else "lectura"),
        "inv_escaner_descuento": nivel_act if p.get("gestionar_inventario") else "sin_acceso",
        "inv_escaner_venta": nivel_act if (p.get("gestionar_inventario") and p.get("registrar_caja")) else ("operacion" if p.get("gestionar_inventario") else "sin_acceso"),
        # Caja
        "caja_acceso_modulo": nivel_act if p.get("ver_caja") else "sin_acceso",
        "caja_movimientos_manuales": nivel_act if p.get("registrar_caja") else ("lectura" if p.get("ver_caja") else "sin_acceso"),
        "caja_corte_turno": "edicion_total" if es_admin else ("operacion" if p.get("ver_caja") else "sin_acceso"),
        # Config
        "cfg_acceso_modulo": ("edicion_total" if es_admin else "lectura") if p.get("ver_config") else "sin_acceso",
        "cfg_horarios_plantilla": "edicion_total" if p.get("editar_configuracion") else "sin_acceso",
        "cfg_catalogo_servicios": "edicion_total" if p.get("editar_configuracion") else "sin_acceso",
        "cfg_gestion_personal": "edicion_total" if p.get("editar_configuracion") else "sin_acceso",
        "cfg_perfiles_permisos": "edicion_total" if (p.get("editar_configuracion") or p.get("usar_impersonate")) else "sin_acceso",
    }


def _construir_perfil_default(
    nombre: str,
    descripcion: str,
    es_sistema: bool,
    protegido: bool,
    niveles: Dict[str, str],
) -> Dict[str, Any]:
    es_dueno = nombre.lower() == "dueño"
    niveles_completos = {k: niveles.get(k, "sin_acceso") for k in TODAS_ACTIVIDADES_KEYS}
    if es_dueno:
        niveles_completos["cfg_acceso_modulo"] = "edicion_total"
        niveles_completos["cfg_perfiles_permisos"] = "edicion_total"
    permisos_bool = _derivar_permisos_booleanos_desde_niveles(niveles_completos, es_dueno=es_dueno)
    return {
        "nombre": nombre,
        "descripcion": descripcion,
        "es_sistema": es_sistema,
        "protegido": protegido,
        "niveles": niveles_completos,
        "permisos": permisos_bool,
    }


PERFILES_POR_DEFECTO: List[Dict[str, Any]] = [
    _construir_perfil_default(
        nombre="Dueño",
        descripcion="Control total de la organización, finanzas, padrón completo, configuración y perfiles.",
        es_sistema=True,
        protegido=True,
        niveles={k: "edicion_total" for k in TODAS_ACTIVIDADES_KEYS},
    ),
    _construir_perfil_default(
        nombre="Administrador",
        descripcion="Administración general de sucursal, clientes, agenda, inventario, personal y perfiles.",
        es_sistema=True,
        protegido=False,
        niveles={k: "edicion_total" for k in TODAS_ACTIVIDADES_KEYS},
    ),
    _construir_perfil_default(
        nombre="Recepcionista",
        descripcion="Atención en mostrador: búsqueda de clientes, alta de clientes/mascotas, agenda y cobros.",
        es_sistema=True,
        protegido=False,
        niveles={
            # Agenda
            "agenda_acceso_modulo": "operacion",
            "agenda_kpis_cobro_dia": "lectura",
            "agenda_crear_citas": "edicion_total",
            "agenda_asistencia_cobro": "operacion",
            "agenda_cancelar_editar": "operacion",
            # Clientes
            "cli_acceso_padron_completo": "sin_acceso",
            "cli_buscador_lateral": "operacion",
            "cli_expediente_perfil": "operacion",
            "cli_alta_edicion_clientes": "operacion",
            "cli_alta_edicion_mascotas": "operacion",
            # Dashboard
            "dash_acceso_modulo": "lectura",
            "dash_kpis_financieros": "lectura",
            "dash_graficas_operativas": "lectura",
            "dash_alertas_stock": "lectura",
            # Inventario
            "inv_acceso_modulo": "operacion",
            "inv_catalogo_productos": "lectura",
            "inv_escaner_descuento": "operacion",
            "inv_escaner_venta": "operacion",
            # Caja
            "caja_acceso_modulo": "operacion",
            "caja_movimientos_manuales": "operacion",
            "caja_corte_turno": "operacion",
            # Config
            "cfg_acceso_modulo": "sin_acceso",
            "cfg_horarios_plantilla": "sin_acceso",
            "cfg_catalogo_servicios": "sin_acceso",
            "cfg_gestion_personal": "sin_acceso",
            "cfg_perfiles_permisos": "sin_acceso",
        },
    ),
    _construir_perfil_default(
        nombre="Cajero",
        descripcion="Operación de cobros en caja, agenda del día, recepción y venta de productos con escáner.",
        es_sistema=True,
        protegido=False,
        niveles={
            # Agenda
            "agenda_acceso_modulo": "operacion",
            "agenda_kpis_cobro_dia": "lectura",
            "agenda_crear_citas": "operacion",
            "agenda_asistencia_cobro": "edicion_total",
            "agenda_cancelar_editar": "operacion",
            # Clientes
            "cli_acceso_padron_completo": "sin_acceso",
            "cli_buscador_lateral": "operacion",
            "cli_expediente_perfil": "lectura",
            "cli_alta_edicion_clientes": "operacion",
            "cli_alta_edicion_mascotas": "operacion",
            # Dashboard
            "dash_acceso_modulo": "lectura",
            "dash_kpis_financieros": "lectura",
            "dash_graficas_operativas": "lectura",
            "dash_alertas_stock": "lectura",
            # Inventario
            "inv_acceso_modulo": "operacion",
            "inv_catalogo_productos": "lectura",
            "inv_escaner_descuento": "operacion",
            "inv_escaner_venta": "edicion_total",
            # Caja
            "caja_acceso_modulo": "edicion_total",
            "caja_movimientos_manuales": "edicion_total",
            "caja_corte_turno": "edicion_total",
            # Config
            "cfg_acceso_modulo": "sin_acceso",
            "cfg_horarios_plantilla": "sin_acceso",
            "cfg_catalogo_servicios": "sin_acceso",
            "cfg_gestion_personal": "sin_acceso",
            "cfg_perfiles_permisos": "sin_acceso",
        },
    ),
    _construir_perfil_default(
        nombre="Estilista",
        descripcion="Operación en área de grooming: consulta de citas asignadas, expedientes técnicos e insumos.",
        es_sistema=True,
        protegido=False,
        niveles={
            # Agenda
            "agenda_acceso_modulo": "lectura",
            "agenda_kpis_cobro_dia": "sin_acceso",
            "agenda_crear_citas": "sin_acceso",
            "agenda_asistencia_cobro": "operacion",
            "agenda_cancelar_editar": "lectura",
            # Clientes
            "cli_acceso_padron_completo": "sin_acceso",
            "cli_buscador_lateral": "lectura",
            "cli_expediente_perfil": "lectura",
            "cli_alta_edicion_clientes": "sin_acceso",
            "cli_alta_edicion_mascotas": "lectura",
            # Dashboard
            "dash_acceso_modulo": "sin_acceso",
            "dash_kpis_financieros": "sin_acceso",
            "dash_graficas_operativas": "sin_acceso",
            "dash_alertas_stock": "lectura",
            # Inventario
            "inv_acceso_modulo": "operacion",
            "inv_catalogo_productos": "lectura",
            "inv_escaner_descuento": "operacion",
            "inv_escaner_venta": "sin_acceso",
            # Caja
            "caja_acceso_modulo": "sin_acceso",
            "caja_movimientos_manuales": "sin_acceso",
            "caja_corte_turno": "sin_acceso",
            # Config
            "cfg_acceso_modulo": "sin_acceso",
            "cfg_horarios_plantilla": "sin_acceso",
            "cfg_catalogo_servicios": "sin_acceso",
            "cfg_gestion_personal": "sin_acceso",
            "cfg_perfiles_permisos": "sin_acceso",
        },
    ),
]


class PerfilesPermisosService:
    """Gestiona la matriz modular de perfiles y niveles de acceso por actividad para cada organización."""

    @staticmethod
    def normalizar_perfil_completo(
        perfil_raw: Dict[str, Any],
        base_default: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        nombre = str(perfil_raw.get("nombre") or (base_default["nombre"] if base_default else "")).strip()
        es_dueno = nombre.lower() == "dueño"
        es_base = any(b.lower() == nombre.lower() for b in PERFILES_BASE_SISTEMA)

        niveles_raw = perfil_raw.get("niveles")
        permisos_raw = perfil_raw.get("permisos")

        base_niveles = (
            base_default["niveles"]
            if base_default and isinstance(base_default.get("niveles"), dict)
            else _derivar_niveles_desde_permisos_booleanos(permisos_raw or {})
        )

        niveles_limpios: Dict[str, str] = {}
        for k in TODAS_ACTIVIDADES_KEYS:
            val = None
            if isinstance(niveles_raw, dict) and k in niveles_raw:
                val = str(niveles_raw[k]).strip().lower()
            if val not in NIVELES_VALIDOS:
                val = base_niveles.get(k, "sin_acceso")
            niveles_limpios[k] = val

        # Si enviaron cambios en `permisos` booleanos pero no enviaron `niveles`, sincronizar
        if not isinstance(niveles_raw, dict) and isinstance(permisos_raw, dict) and permisos_raw:
            derivados = _derivar_niveles_desde_permisos_booleanos(permisos_raw)
            for k, v in derivados.items():
                if k in niveles_limpios:
                    niveles_limpios[k] = v

        if es_dueno:
            niveles_limpios["cfg_acceso_modulo"] = "edicion_total"
            niveles_limpios["cfg_perfiles_permisos"] = "edicion_total"

        permisos_bool = _derivar_permisos_booleanos_desde_niveles(niveles_limpios, es_dueno=es_dueno)

        # Si el cliente también mandó overrides booleanos explícitos, respetarlos donde aplique
        if isinstance(permisos_raw, dict) and not isinstance(niveles_raw, dict):
            for k_bool in permisos_bool:
                if k_bool in permisos_raw:
                    permisos_bool[k_bool] = bool(permisos_raw[k_bool])
            if es_dueno:
                permisos_bool["ver_config"] = True
                permisos_bool["editar_configuracion"] = True

        return {
            "nombre": base_default["nombre"] if base_default else nombre,
            "descripcion": (perfil_raw.get("descripcion") or "").strip()
            or (base_default["descripcion"] if base_default else "Perfil personalizado de la organización."),
            "es_sistema": es_base,
            "protegido": es_dueno,
            "niveles": niveles_limpios,
            "permisos": permisos_bool,
        }

    @staticmethod
    def _leer_archivo() -> Dict[str, List[Dict[str, Any]]]:
        try:
            if DATA_FILE.exists():
                return json.loads(DATA_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
        return {}

    @staticmethod
    def _escribir_archivo(data: Dict[str, List[Dict[str, Any]]]) -> None:
        try:
            DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
            DATA_FILE.write_text(
                json.dumps(data, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        except Exception:
            pass

    @classmethod
    def obtener_perfiles(cls, db: Any, org_id: str) -> List[Dict[str, Any]]:
        store = cls._leer_archivo()
        perfiles_guardados = store.get(org_id)

        if not perfiles_guardados and db is not None:
            try:
                res = (
                    db.table("bitacora_auditoria")
                    .select("detalle")
                    .eq("organizacion_id", org_id)
                    .eq("accion", "CONFIG_PERFILES_SNAPSHOT")
                    .order("fecha", desc=True)
                    .limit(1)
                    .execute()
                )
                if res.data and res.data[0].get("detalle"):
                    parsed = json.loads(res.data[0]["detalle"])
                    if isinstance(parsed, list) and parsed:
                        perfiles_guardados = parsed
                        store[org_id] = perfiles_guardados
                        cls._escribir_archivo(store)
            except Exception:
                pass

        defaults_map = {p["nombre"].lower(): copy.deepcopy(p) for p in PERFILES_POR_DEFECTO}
        resultado: List[Dict[str, Any]] = []
        vistos = set()

        if perfiles_guardados:
            for p in perfiles_guardados:
                nombre = str(p.get("nombre") or "").strip()
                if not nombre:
                    continue
                key_lower = nombre.lower()
                if key_lower in vistos:
                    continue
                vistos.add(key_lower)
                base_def = defaults_map.get(key_lower)
                resultado.append(cls.normalizar_perfil_completo(p, base_def))

        for def_p in PERFILES_POR_DEFECTO:
            if def_p["nombre"].lower() not in vistos:
                resultado.append(copy.deepcopy(def_p))
                vistos.add(def_p["nombre"].lower())

        return resultado

    @classmethod
    def guardar_perfiles(
        cls,
        db: Any,
        org_id: str,
        sucursal_id: Optional[str],
        perfiles: List[Dict[str, Any]],
    ) -> None:
        store = cls._leer_archivo()
        store[org_id] = perfiles
        cls._escribir_archivo(store)

        if db is not None:
            try:
                db.table("bitacora_auditoria").insert(
                    {
                        "organizacion_id": org_id,
                        "sucursal_id": sucursal_id,
                        "usuario_nombre": "Sistema",
                        "rol": "Dueño",
                        "accion": "CONFIG_PERFILES_SNAPSHOT",
                        "detalle": json.dumps(perfiles, ensure_ascii=False),
                    }
                ).execute()
            except Exception:
                pass
