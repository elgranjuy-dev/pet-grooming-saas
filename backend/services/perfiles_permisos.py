import copy
import json
from pathlib import Path
from typing import Any, Dict, List, Optional

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "perfiles_permisos.json"

CATALOGO_PERMISOS: List[Dict[str, str]] = [
    # Permisos de Visualización de Módulos (VER)
    {
        "key": "ver_dashboard",
        "grupo": "ver",
        "titulo": "Ver módulo Dashboard",
        "descripcion": "Acceso a KPIs financieros, gráficas e indicadores de la sucursal.",
        "tab": "dashboard",
    },
    {
        "key": "ver_agenda",
        "grupo": "ver",
        "titulo": "Ver módulo Agenda y Turnos",
        "descripcion": "Acceso al calendario diario/semanal, bloques de horario y tarjetas de citas.",
        "tab": "agenda",
    },
    {
        "key": "ver_clientes",
        "grupo": "ver",
        "titulo": "Ver módulo Clientes y Expedientes (Base de Datos)",
        "descripcion": "Acceso a la tabla completa de clientes y mascotas con filtros por columna.",
        "tab": "clientes",
    },
    {
        "key": "ver_inventario",
        "grupo": "ver",
        "titulo": "Ver módulo Inventario y Escáner",
        "descripcion": "Acceso al catálogo de productos, existencias y terminal de códigos de barras.",
        "tab": "inventario",
    },
    {
        "key": "ver_caja",
        "grupo": "ver",
        "titulo": "Ver módulo Caja y Cobros",
        "descripcion": "Acceso al registro de ingresos del día, cobros por método y movimientos.",
        "tab": "caja",
    },
    {
        "key": "ver_config",
        "grupo": "ver",
        "titulo": "Ver módulo Configuración y Personal",
        "descripcion": "Acceso a horarios, catálogo de servicios, personal, perfiles y bitácora.",
        "tab": "config",
    },
    # Permisos de Acciones Operativas (HACER)
    {
        "key": "buscar_clientes",
        "grupo": "hacer",
        "titulo": "Buscar clientes y consultar expedientes",
        "descripcion": "Usar la barra de búsqueda del menú lateral para abrir perfiles de clientes y mascotas.",
    },
    {
        "key": "crear_clientes_mascotas",
        "grupo": "hacer",
        "titulo": "Registrar nuevos clientes y agregar mascotas",
        "descripcion": "Dar de alta dueños desde el menú lateral y agregar mascotas dentro de su perfil.",
    },
    {
        "key": "agendar_citas",
        "grupo": "hacer",
        "titulo": "Agendar nuevas citas",
        "descripcion": "Crear citas haciendo clic en bloques disponibles o desde la ficha de una mascota.",
    },
    {
        "key": "gestionar_asistencia_citas",
        "grupo": "hacer",
        "titulo": "Marcar Asistió / No Asistió y cobrar citas",
        "descripcion": "Confirmar asistencia de mascotas en la agenda, registrar cobro o marcar inasistencia.",
    },
    {
        "key": "gestionar_inventario",
        "grupo": "hacer",
        "titulo": "Agregar productos y operar escáner de inventario",
        "descripcion": "Registrar nuevos productos/insumos y descontar o vender con código de barras.",
    },
    {
        "key": "registrar_caja",
        "grupo": "hacer",
        "titulo": "Registrar ingresos manuales en Caja",
        "descripcion": "Capturar cobros manuales y conceptos adicionales en el módulo de Caja.",
    },
    {
        "key": "editar_configuracion",
        "grupo": "hacer",
        "titulo": "Modificar configuración, personal y perfiles",
        "descripcion": "Editar horarios, servicios, excepciones, colaboradores y permisos de perfiles.",
    },
    {
        "key": "usar_impersonate",
        "grupo": "hacer",
        "titulo": "Usar Modo Impersonate (Simular perfiles/usuarios)",
        "descripcion": "Cambiar temporalmente de vista para auditar cómo opera otro perfil o colaborador.",
    },
]

PERFILES_BASE_SISTEMA = {"Dueño", "Administrador", "Recepcionista", "Cajero", "Estilista"}

PERFILES_POR_DEFECTO: List[Dict[str, Any]] = [
    {
        "nombre": "Dueño",
        "descripcion": "Control total de la organización, finanzas, padrón completo, configuración y perfiles.",
        "es_sistema": True,
        "protegido": True,
        "permisos": {
            "ver_dashboard": True,
            "ver_agenda": True,
            "ver_clientes": True,
            "ver_inventario": True,
            "ver_caja": True,
            "ver_config": True,
            "buscar_clientes": True,
            "crear_clientes_mascotas": True,
            "agendar_citas": True,
            "gestionar_asistencia_citas": True,
            "gestionar_inventario": True,
            "registrar_caja": True,
            "editar_configuracion": True,
            "usar_impersonate": True,
        },
    },
    {
        "nombre": "Administrador",
        "descripcion": "Administración general de sucursal, clientes, agenda, inventario, personal y perfiles.",
        "es_sistema": True,
        "protegido": False,
        "permisos": {
            "ver_dashboard": True,
            "ver_agenda": True,
            "ver_clientes": True,
            "ver_inventario": True,
            "ver_caja": True,
            "ver_config": True,
            "buscar_clientes": True,
            "crear_clientes_mascotas": True,
            "agendar_citas": True,
            "gestionar_asistencia_citas": True,
            "gestionar_inventario": True,
            "registrar_caja": True,
            "editar_configuracion": True,
            "usar_impersonate": True,
        },
    },
    {
        "nombre": "Recepcionista",
        "descripcion": "Atención en mostrador: búsqueda de clientes, alta de clientes/mascotas, agenda y cobros.",
        "es_sistema": True,
        "protegido": False,
        "permisos": {
            "ver_dashboard": True,
            "ver_agenda": True,
            "ver_clientes": False,
            "ver_inventario": True,
            "ver_caja": True,
            "ver_config": False,
            "buscar_clientes": True,
            "crear_clientes_mascotas": True,
            "agendar_citas": True,
            "gestionar_asistencia_citas": True,
            "gestionar_inventario": True,
            "registrar_caja": True,
            "editar_configuracion": False,
            "usar_impersonate": False,
        },
    },
    {
        "nombre": "Cajero",
        "descripcion": "Operación de cobros en caja, agenda del día, recepción y venta de productos con escáner.",
        "es_sistema": True,
        "protegido": False,
        "permisos": {
            "ver_dashboard": True,
            "ver_agenda": True,
            "ver_clientes": False,
            "ver_inventario": True,
            "ver_caja": True,
            "ver_config": False,
            "buscar_clientes": True,
            "crear_clientes_mascotas": True,
            "agendar_citas": True,
            "gestionar_asistencia_citas": True,
            "gestionar_inventario": True,
            "registrar_caja": True,
            "editar_configuracion": False,
            "usar_impersonate": False,
        },
    },
    {
        "nombre": "Estilista",
        "descripcion": "Operación en área de grooming: consulta de citas asignadas, expedientes técnicos e insumos.",
        "es_sistema": True,
        "protegido": False,
        "permisos": {
            "ver_dashboard": False,
            "ver_agenda": True,
            "ver_clientes": False,
            "ver_inventario": True,
            "ver_caja": False,
            "ver_config": False,
            "buscar_clientes": True,
            "crear_clientes_mascotas": False,
            "agendar_citas": False,
            "gestionar_asistencia_citas": True,
            "gestionar_inventario": True,
            "registrar_caja": False,
            "editar_configuracion": False,
            "usar_impersonate": False,
        },
    },
]


class PerfilesPermisosService:
    """Gestiona la lectura y escritura de perfiles y sus casillas de permisos por organización."""

    @staticmethod
    def _normalizar_permisos(permisos_raw: Optional[Dict[str, Any]], base_default: Optional[Dict[str, bool]] = None) -> Dict[str, bool]:
        todas_keys = [item["key"] for item in CATALOGO_PERMISOS]
        resultado: Dict[str, bool] = {}
        for k in todas_keys:
            if permisos_raw is not None and k in permisos_raw:
                resultado[k] = bool(permisos_raw[k])
            elif base_default is not None and k in base_default:
                resultado[k] = bool(base_default[k])
            else:
                resultado[k] = False
        return resultado

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
        """
        Obtiene la lista de perfiles y sus permisos para la organización.
        Si no existe en el archivo local, intenta recuperarla del último snapshot en bitacora_auditoria
        o inicializa los perfiles por defecto.
        """
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
                es_dueno = key_lower == "dueño"
                permisos_norm = cls._normalizar_permisos(
                    p.get("permisos"),
                    base_def["permisos"] if base_def else None,
                )
                if es_dueno:
                    # Garantizar que Dueño conserve acceso a configuración y perfiles para evitar bloqueo
                    permisos_norm["ver_config"] = True
                    permisos_norm["editar_configuracion"] = True

                resultado.append(
                    {
                        "nombre": base_def["nombre"] if base_def else nombre,
                        "descripcion": p.get("descripcion")
                        or (base_def["descripcion"] if base_def else "Perfil personalizado de la organización."),
                        "es_sistema": bool(base_def is not None),
                        "protegido": es_dueno,
                        "permisos": permisos_norm,
                    }
                )

        # Asegurar que todos los perfiles por defecto existan
        for def_p in PERFILES_POR_DEFECTO:
            if def_p["nombre"].lower() not in vistos:
                resultado.append(copy.deepcopy(def_p))
                vistos.add(def_p["nombre"].lower())

        return resultado

    @classmethod
    def guardar_perfiles(cls, db: Any, org_id: str, sucursal_id: Optional[str], perfiles: List[Dict[str, Any]]) -> None:
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
