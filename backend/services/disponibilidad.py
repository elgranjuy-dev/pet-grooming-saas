from datetime import datetime, date, time, timedelta
from typing import Any, Dict, List, Optional
from supabase import Client
from backend.repositories.base import BranchRepository


class AvailabilityEngine:
    """
    Motor de cálculo de disponibilidad de agenda por sucursal.
    Cruza agenda_plantilla_semanal, agenda_excepciones y citas existentes,
    descontando estilistas en horario de comida y citas traslapadas.
    """

    DIAS_NOMBRES = {
        0: "Lunes",
        1: "Martes",
        2: "Miércoles",
        3: "Jueves",
        4: "Viernes",
        5: "Sábado",
        6: "Domingo",
    }

    def __init__(self, db: Client, organizacion_id: str, sucursal_id: str) -> None:
        self.db = db
        self.organizacion_id = organizacion_id
        self.sucursal_id = sucursal_id
        self.config_repo = BranchRepository(db, "agenda_config", organizacion_id, sucursal_id)
        self.plantilla_repo = BranchRepository(
            db, "agenda_plantilla_semanal", organizacion_id, sucursal_id
        )
        self.excepciones_repo = BranchRepository(
            db, "agenda_excepciones", organizacion_id, sucursal_id
        )
        self.citas_repo = BranchRepository(db, "citas", organizacion_id, sucursal_id)

    @staticmethod
    def _parse_time(val: Optional[str], default: time) -> time:
        if not val:
            return default
        partes = str(val).strip().split(":")
        try:
            h = int(partes[0])
            m = int(partes[1]) if len(partes) > 1 else 0
            return time(h, m)
        except Exception:
            return default

    @staticmethod
    def _overlaps(start_a: datetime, end_a: datetime, start_b: datetime, end_b: datetime) -> bool:
        return start_a < end_b and end_a > start_b

    def calcular_disponibilidad(
        self, fecha_str: str, duracion_minutos: int = 60
    ) -> Dict[str, Any]:
        try:
            fecha_obj: date = datetime.strptime(fecha_str[:10], "%Y-%m-%d").date()
        except ValueError:
            raise ValueError(f"Formato de fecha inválido: {fecha_str}. Use YYYY-MM-DD.")

        duracion = max(15, int(duracion_minutos or 60))
        dia_semana = fecha_obj.weekday()  # 0 = Lunes ... 6 = Domingo

        # 1. Configuración de agenda
        configs = self.config_repo.get_all(limit=1)
        config = configs[0] if configs else {"modo_asignacion": "global", "intervalo_minutos": 60}
        intervalo = max(15, int(config.get("intervalo_minutos") or 60))

        # 2. Plantilla semanal del día correspondiente
        plantillas = self.plantilla_repo.get_all(filters={"dia_semana": dia_semana}, limit=1)
        if plantillas:
            plantilla = plantillas[0]
        else:
            plantilla = {
                "dia_semana": dia_semana,
                "nombre_dia": self.DIAS_NOMBRES.get(dia_semana, ""),
                "activo": dia_semana < 6,
                "hora_apertura": "09:00:00",
                "hora_cierre": "18:00:00",
                "estilistas_activos": 2,
                "comida_inicio": "14:00:00",
                "comida_fin": "15:00:00",
                "estilistas_en_comida": 1,
            }

        ahora = datetime.now()
        hoy = ahora.date()

        if not plantilla.get("activo", True):
            return {
                "fecha": fecha_obj.isoformat(),
                "dia_semana": dia_semana,
                "nombre_dia": plantilla.get("nombre_dia") or self.DIAS_NOMBRES.get(dia_semana, ""),
                "abierto": False,
                "pasado": fecha_obj < hoy,
                "motivo_cierre": "Día inhábil en plantilla semanal",
                "duracion_minutos": duracion,
                "intervalo_minutos": intervalo,
                "horarios_disponibles": [],
                "slots": [],
            }

        # 3. Excepciones para la fecha
        excepciones = self.excepciones_repo.get_all(filters={"fecha": fecha_obj.isoformat()})
        for exc in excepciones:
            if exc.get("cerrado_todo_el_dia"):
                return {
                    "fecha": fecha_obj.isoformat(),
                    "dia_semana": dia_semana,
                    "nombre_dia": plantilla.get("nombre_dia") or self.DIAS_NOMBRES.get(dia_semana, ""),
                    "abierto": False,
                    "pasado": fecha_obj < hoy,
                    "motivo_cierre": exc.get("motivo") or "Cerrado por excepción de agenda",
                    "duracion_minutos": duracion,
                    "intervalo_minutos": intervalo,
                    "horarios_disponibles": [],
                    "slots": [],
                }

        # 4. Citas existentes en esa fecha
        inicio_dia_iso = f"{fecha_obj.isoformat()}T00:00:00"
        fin_dia_iso = f"{fecha_obj.isoformat()}T23:59:59"
        citas_res = (
            self.citas_repo.query("*")
            .gte("fecha_hora", inicio_dia_iso)
            .lte("fecha_hora", fin_dia_iso)
            .execute()
        )
        citas_dia = [
            c for c in (citas_res.data or [])
            if str(c.get("estado", "")).lower() not in ("cancelada", "cancelado")
        ]

        return self._evaluar_dia(
            fecha_obj=fecha_obj,
            dia_semana=dia_semana,
            duracion=duracion,
            intervalo=intervalo,
            config=config,
            plantilla=plantilla,
            excepciones=excepciones,
            citas_dia=citas_dia,
            ahora=ahora,
        )

    def _evaluar_dia(
        self,
        fecha_obj: date,
        dia_semana: int,
        duracion: int,
        intervalo: int,
        config: Dict[str, Any],
        plantilla: Dict[str, Any],
        excepciones: List[Dict[str, Any]],
        citas_dia: List[Dict[str, Any]],
        ahora: datetime,
    ) -> Dict[str, Any]:
        hoy = ahora.date()
        es_dia_pasado = fecha_obj < hoy

        if not plantilla.get("activo", True):
            return {
                "fecha": fecha_obj.isoformat(),
                "dia_semana": dia_semana,
                "nombre_dia": plantilla.get("nombre_dia") or self.DIAS_NOMBRES.get(dia_semana, ""),
                "abierto": False,
                "pasado": es_dia_pasado,
                "motivo_cierre": "Día inhábil en plantilla semanal",
                "duracion_minutos": duracion,
                "intervalo_minutos": intervalo,
                "horarios_disponibles": [],
                "slots": [],
            }

        for exc in excepciones:
            if exc.get("cerrado_todo_el_dia"):
                return {
                    "fecha": fecha_obj.isoformat(),
                    "dia_semana": dia_semana,
                    "nombre_dia": plantilla.get("nombre_dia") or self.DIAS_NOMBRES.get(dia_semana, ""),
                    "abierto": False,
                    "pasado": es_dia_pasado,
                    "motivo_cierre": exc.get("motivo") or "Cerrado por excepción de agenda",
                    "duracion_minutos": duracion,
                    "intervalo_minutos": intervalo,
                    "horarios_disponibles": [],
                    "slots": [],
                }

        citas_intervalos = []
        for c in citas_dia:
            raw_fh = str(c.get("fecha_hora", ""))
            try:
                dt_clean = raw_fh.replace("Z", "+00:00")
                dt_parsed = datetime.fromisoformat(dt_clean)
                cita_inicio = datetime.combine(
                    fecha_obj, time(dt_parsed.hour, dt_parsed.minute)
                )
                cita_dur = int(c.get("duracion_minutos") or 60)
                cita_fin = cita_inicio + timedelta(minutes=cita_dur)
                citas_intervalos.append((cita_inicio, cita_fin, c))
            except Exception:
                continue

        t_apertura = self._parse_time(plantilla.get("hora_apertura"), time(9, 0))
        t_cierre = self._parse_time(plantilla.get("hora_cierre"), time(18, 0))
        t_comida_ini = self._parse_time(plantilla.get("comida_inicio"), time(14, 0))
        t_comida_fin = self._parse_time(plantilla.get("comida_fin"), time(15, 0))

        estilistas_base = int(plantilla.get("estilistas_activos") or 1)
        estilistas_comida = int(plantilla.get("estilistas_en_comida") or 0)

        dt_apertura = datetime.combine(fecha_obj, t_apertura)
        dt_cierre = datetime.combine(fecha_obj, t_cierre)
        dt_comida_ini = datetime.combine(fecha_obj, t_comida_ini)
        dt_comida_fin = datetime.combine(fecha_obj, t_comida_fin)

        slots_detalle: List[Dict[str, Any]] = []
        horarios_disponibles: List[str] = []

        cursor = dt_apertura
        while cursor + timedelta(minutes=duracion) <= dt_cierre:
            slot_ini = cursor
            slot_fin = cursor + timedelta(minutes=duracion)
            hora_str = slot_ini.strftime("%H:%M")

            capacidad = estilistas_base

            en_horario_comida = False
            if dt_comida_ini < dt_comida_fin and self._overlaps(
                slot_ini, slot_fin, dt_comida_ini, dt_comida_fin
            ):
                en_horario_comida = True
                capacidad = max(0, capacidad - estilistas_comida)

            motivo_excepcion = None
            for exc in excepciones:
                exc_ini_str = exc.get("hora_inicio")
                exc_fin_str = exc.get("hora_fin")
                if exc_ini_str and exc_fin_str:
                    dt_exc_ini = datetime.combine(
                        fecha_obj, self._parse_time(exc_ini_str, time(0, 0))
                    )
                    dt_exc_fin = datetime.combine(
                        fecha_obj, self._parse_time(exc_fin_str, time(23, 59))
                    )
                    if self._overlaps(slot_ini, slot_fin, dt_exc_ini, dt_exc_fin):
                        capacidad = int(exc.get("estilistas_disponibles") or 0)
                        motivo_excepcion = exc.get("motivo") or "Excepción de horario"
                else:
                    capacidad = int(exc.get("estilistas_disponibles") or 0)
                    motivo_excepcion = exc.get("motivo") or "Excepción del día"

            traslapes = sum(
                1
                for c_ini, c_fin, _ in citas_intervalos
                if self._overlaps(slot_ini, slot_fin, c_ini, c_fin)
            )

            es_slot_pasado = es_dia_pasado or (fecha_obj == hoy and slot_ini < ahora)
            cupos_libres = max(0, capacidad - traslapes)
            disponible = (cupos_libres > 0) and (not es_slot_pasado)

            if disponible:
                horarios_disponibles.append(hora_str)

            slots_detalle.append(
                {
                    "hora": hora_str,
                    "hora_fin": slot_fin.strftime("%H:%M"),
                    "disponible": disponible,
                    "pasado": es_slot_pasado,
                    "cupos_disponibles": cupos_libres,
                    "capacidad_total": capacidad,
                    "citas_traslapadas": traslapes,
                    "en_horario_comida": en_horario_comida,
                    "motivo": "Horario en el pasado" if es_slot_pasado else motivo_excepcion,
                }
            )

            cursor += timedelta(minutes=intervalo)

        return {
            "fecha": fecha_obj.isoformat(),
            "dia_semana": dia_semana,
            "nombre_dia": plantilla.get("nombre_dia") or self.DIAS_NOMBRES.get(dia_semana, ""),
            "abierto": True,
            "pasado": es_dia_pasado,
            "duracion_minutos": duracion,
            "intervalo_minutos": intervalo,
            "modo_asignacion": config.get("modo_asignacion", "global"),
            "horarios_disponibles": horarios_disponibles,
            "slots": slots_detalle,
        }

    def calcular_disponibilidad_semana(
        self, fecha_str: str, duracion_minutos: int = 60
    ) -> Dict[str, Any]:
        """
        Calcula la disponibilidad de los 7 días de la semana (Lunes a Domingo)
        que contiene a fecha_str en una sola consulta por lote.
        """
        try:
            fecha_ref: date = datetime.strptime(fecha_str[:10], "%Y-%m-%d").date()
        except ValueError:
            raise ValueError(f"Formato de fecha inválido: {fecha_str}. Use YYYY-MM-DD.")

        duracion = max(15, int(duracion_minutos or 60))
        lunes = fecha_ref - timedelta(days=fecha_ref.weekday())
        domingo = lunes + timedelta(days=6)

        configs = self.config_repo.get_all(limit=1)
        config = configs[0] if configs else {"modo_asignacion": "global", "intervalo_minutos": 60}
        intervalo = max(15, int(config.get("intervalo_minutos") or 60))

        plantillas_all = self.plantilla_repo.get_all(order_by="dia_semana", desc=False)
        plantillas_map: Dict[int, Dict[str, Any]] = {
            int(p.get("dia_semana", 0)): p for p in plantillas_all
        }

        exc_res = (
            self.excepciones_repo.query("*")
            .gte("fecha", lunes.isoformat())
            .lte("fecha", domingo.isoformat())
            .execute()
        )
        excepciones_por_fecha: Dict[str, List[Dict[str, Any]]] = {}
        for exc in exc_res.data or []:
            f_str = str(exc.get("fecha", ""))[:10]
            excepciones_por_fecha.setdefault(f_str, []).append(exc)

        citas_res = (
            self.citas_repo.query("*")
            .gte("fecha_hora", f"{lunes.isoformat()}T00:00:00")
            .lte("fecha_hora", f"{domingo.isoformat()}T23:59:59")
            .execute()
        )
        citas_por_fecha: Dict[str, List[Dict[str, Any]]] = {}
        for c in citas_res.data or []:
            if str(c.get("estado", "")).lower() in ("cancelada", "cancelado"):
                continue
            f_str = str(c.get("fecha_hora", ""))[:10]
            citas_por_fecha.setdefault(f_str, []).append(c)

        ahora = datetime.now()
        dias_semana_resultado: List[Dict[str, Any]] = []
        horas_eje_set = set()

        for offset in range(7):
            dia_obj = lunes + timedelta(days=offset)
            dia_sem = dia_obj.weekday()
            plantilla = plantillas_map.get(
                dia_sem,
                {
                    "dia_semana": dia_sem,
                    "nombre_dia": self.DIAS_NOMBRES.get(dia_sem, ""),
                    "activo": dia_sem < 6,
                    "hora_apertura": "09:00:00",
                    "hora_cierre": "18:00:00",
                    "estilistas_activos": 2,
                    "comida_inicio": "14:00:00",
                    "comida_fin": "15:00:00",
                    "estilistas_en_comida": 1,
                },
            )
            info_dia = self._evaluar_dia(
                fecha_obj=dia_obj,
                dia_semana=dia_sem,
                duracion=duracion,
                intervalo=intervalo,
                config=config,
                plantilla=plantilla,
                excepciones=excepciones_por_fecha.get(dia_obj.isoformat(), []),
                citas_dia=citas_por_fecha.get(dia_obj.isoformat(), []),
                ahora=ahora,
            )
            for s in info_dia.get("slots", []):
                if s.get("hora"):
                    horas_eje_set.add(s["hora"])
            dias_semana_resultado.append(info_dia)

        horas_eje = sorted(horas_eje_set)
        if not horas_eje:
            horas_eje = [f"{h:02d}:00" for h in range(9, 18)]

        return {
            "fecha_referencia": fecha_ref.isoformat(),
            "fecha_inicio_semana": lunes.isoformat(),
            "fecha_fin_semana": domingo.isoformat(),
            "duracion_minutos": duracion,
            "intervalo_minutos": intervalo,
            "horas_eje": horas_eje,
            "dias": dias_semana_resultado,
        }

