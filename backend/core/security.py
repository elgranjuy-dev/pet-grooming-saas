import hashlib
from typing import Any, Dict, Optional, Tuple


class SecurityManager:
    """Utilidades de seguridad, generación de hashes de lealtad, normalización de roles y auditoría."""

    RECEPCIONISTA_PREFIX = "REC::"

    @staticmethod
    def codificar_rol_y_pin(rol: str, pin: str) -> Tuple[str, str]:
        """
        Normaliza rol y pin para compatibilidad con el constraint SQL `usuarios_crm_rol_check`
        ('Dueño', 'Administrador', 'Cajero', 'Estilista') cuando el usuario elige 'Recepcionista'.
        """
        rol_limpio = (rol or "Estilista").strip()
        pin_limpio = str(pin or "").strip()
        if pin_limpio.startswith(SecurityManager.RECEPCIONISTA_PREFIX):
            pin_limpio = pin_limpio[len(SecurityManager.RECEPCIONISTA_PREFIX) :]

        if rol_limpio.lower() == "recepcionista":
            return "Cajero", f"{SecurityManager.RECEPCIONISTA_PREFIX}{pin_limpio}"
        return rol_limpio, pin_limpio

    @staticmethod
    def normalizar_usuario_crm(usuario: Dict[str, Any], ocultar_pin: bool = False) -> Dict[str, Any]:
        """
        Restaura el rol 'Recepcionista' si el campo pin tiene el prefijo REC::
        y opcionalmente elimina el campo pin antes de responder al cliente.
        """
        if not usuario:
            return {}
        copia = dict(usuario)
        raw_pin = str(copia.get("pin") or "")
        if raw_pin.startswith(SecurityManager.RECEPCIONISTA_PREFIX):
            copia["rol"] = "Recepcionista"
            copia["pin"] = raw_pin[len(SecurityManager.RECEPCIONISTA_PREFIX) :]
        if ocultar_pin:
            copia.pop("pin", None)
        return copia

    @staticmethod
    def generar_hash_lealtad(telefono: str, mascota_uuid: str) -> str:
        """
        Genera un código único de lealtad con formato PET-<12 CHARS SHA256 UPPERCASE>
        a partir del teléfono del cliente y el UUID real de la mascota.
        """
        limpio_tel = (telefono or "").strip()
        limpio_uuid = str(mascota_uuid or "").strip()
        raw = f"{limpio_tel}:{limpio_uuid}".encode("utf-8")
        digest = hashlib.sha256(raw).hexdigest()[:12].upper()
        return f"PET-{digest}"

    @staticmethod
    def registrar_auditoria(
        db: Any,
        org_id: str,
        suc_id: Optional[str],
        usuario: str,
        rol: str,
        accion: str,
        detalle: str = "",
    ) -> None:
        """Registra un evento en la tabla bitacora_auditoria."""
        try:
            payload = {
                "organizacion_id": org_id,
                "sucursal_id": suc_id,
                "usuario_nombre": usuario or "Sistema",
                "rol": rol or "Operativo",
                "accion": accion,
                "detalle": detalle or "",
            }
            db.table("bitacora_auditoria").insert(payload).execute()
        except Exception:
            # Evitar bloquear la operación principal si falla el log de auditoría
            pass
