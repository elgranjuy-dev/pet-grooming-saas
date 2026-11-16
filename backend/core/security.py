import hashlib
from typing import Any, Optional


class SecurityManager:
    """Utilidades de seguridad, generación de hashes de lealtad y auditoría."""

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
