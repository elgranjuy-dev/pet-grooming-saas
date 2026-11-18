import hashlib
from typing import Any, Dict, Optional, Tuple


class SecurityManager:
    """Utilidades de seguridad, generación de hashes de lealtad, normalización de roles y auditoría."""

    RECEPCIONISTA_PREFIX = "REC::"
    CUSTOM_ROL_PREFIX = "ROL::"
    ROLES_DB_NATIVOS = {"Dueño", "Administrador", "Cajero", "Estilista"}

    @staticmethod
    def _limpiar_pin_codificado(raw_pin: str) -> Tuple[Optional[str], str]:
        """Extrae el rol personalizado codificado (si existe) y devuelve (rol_extraido, pin_limpio)."""
        pin_str = str(raw_pin or "").strip()
        if pin_str.startswith(SecurityManager.RECEPCIONISTA_PREFIX):
            return "Recepcionista", pin_str[len(SecurityManager.RECEPCIONISTA_PREFIX) :]
        if pin_str.startswith(SecurityManager.CUSTOM_ROL_PREFIX):
            resto = pin_str[len(SecurityManager.CUSTOM_ROL_PREFIX) :]
            if "::" in resto:
                rol_custom, pin_real = resto.split("::", 1)
                return rol_custom.strip() or "Estilista", pin_real
        return None, pin_str

    @staticmethod
    def codificar_rol_y_pin(rol: str, pin: str) -> Tuple[str, str]:
        """
        Normaliza rol y pin para compatibilidad con el constraint SQL `usuarios_crm_rol_check`
        ('Dueño', 'Administrador', 'Cajero', 'Estilista') cuando el usuario elige 'Recepcionista'
        o cualquier perfil personalizado creado en el módulo de Perfiles y Permisos.
        """
        rol_limpio = (rol or "Estilista").strip()
        _, pin_limpio = SecurityManager._limpiar_pin_codificado(pin)

        # Coincidencia insensible a mayúsculas con los 4 roles nativos del constraint SQL
        for nativo in SecurityManager.ROLES_DB_NATIVOS:
            if rol_limpio.lower() == nativo.lower():
                return nativo, pin_limpio

        if rol_limpio.lower() == "recepcionista":
            return "Cajero", f"{SecurityManager.RECEPCIONISTA_PREFIX}{pin_limpio}"

        # Cualquier otro perfil personalizado se almacena bajo 'Cajero' en DB con prefijo ROL::<Perfil>::
        rol_seguro = rol_limpio.replace("::", "-")
        return "Cajero", f"{SecurityManager.CUSTOM_ROL_PREFIX}{rol_seguro}::{pin_limpio}"

    @staticmethod
    def normalizar_usuario_crm(usuario: Dict[str, Any], ocultar_pin: bool = False) -> Dict[str, Any]:
        """
        Restaura el rol personalizado o 'Recepcionista' si el campo pin tiene prefijo codificado
        y opcionalmente elimina el campo pin antes de responder al cliente.
        """
        if not usuario:
            return {}
        copia = dict(usuario)
        raw_pin = str(copia.get("pin") or "")
        rol_extraido, pin_limpio = SecurityManager._limpiar_pin_codificado(raw_pin)
        if rol_extraido:
            copia["rol"] = rol_extraido
            copia["pin"] = pin_limpio
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
