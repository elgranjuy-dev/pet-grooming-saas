from typing import Any, Dict, List, Optional
from supabase import Client


class OrganizationRepository:
    """
    Repositorio base multi-tenant que filtra automáticamente todas las consultas
    por organizacion_id.
    """

    def __init__(self, db: Client, table_name: str, organizacion_id: str) -> None:
        if not organizacion_id:
            raise ValueError("organizacion_id es obligatorio para OrganizationRepository")
        self.db = db
        self.table_name = table_name
        self.organizacion_id = organizacion_id

    def query(self, columns: str = "*"):
        """Inicia un SELECT filtrado por organizacion_id."""
        return (
            self.db.table(self.table_name)
            .select(columns)
            .eq("organizacion_id", self.organizacion_id)
        )

    def get_all(
        self,
        columns: str = "*",
        filters: Optional[Dict[str, Any]] = None,
        order_by: Optional[str] = None,
        desc: bool = False,
        limit: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        q = self.query(columns)
        if filters:
            for k, v in filters.items():
                if v is not None:
                    q = q.eq(k, v)
        if order_by:
            q = q.order(order_by, desc=desc)
        if limit:
            q = q.limit(limit)
        res = q.execute()
        return res.data or []

    def get_by_id(self, record_id: str, id_column: str = "id", columns: str = "*") -> Optional[Dict[str, Any]]:
        res = (
            self.query(columns)
            .eq(id_column, record_id)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None

    def insert(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        data = {**payload, "organizacion_id": self.organizacion_id}
        res = self.db.table(self.table_name).insert(data).execute()
        return res.data[0] if res.data else data

    def update(
        self,
        record_id: str,
        payload: Dict[str, Any],
        id_column: str = "id",
    ) -> Optional[Dict[str, Any]]:
        clean_payload = {
            k: v
            for k, v in payload.items()
            if k not in ("id", "organizacion_id")
        }
        res = (
            self.db.table(self.table_name)
            .update(clean_payload)
            .eq("organizacion_id", self.organizacion_id)
            .eq(id_column, record_id)
            .execute()
        )
        return res.data[0] if res.data else None

    def delete(self, record_id: str, id_column: str = "id") -> bool:
        res = (
            self.db.table(self.table_name)
            .delete()
            .eq("organizacion_id", self.organizacion_id)
            .eq(id_column, record_id)
            .execute()
        )
        return bool(res.data)


class BranchRepository(OrganizationRepository):
    """
    Repositorio multi-sucursal que hereda de OrganizationRepository y filtra
    estrictamente por organizacion_id y sucursal_id.
    """

    def __init__(
        self,
        db: Client,
        table_name: str,
        organizacion_id: str,
        sucursal_id: str,
    ) -> None:
        super().__init__(db, table_name, organizacion_id)
        if not sucursal_id:
            raise ValueError("sucursal_id es obligatorio para BranchRepository")
        self.sucursal_id = sucursal_id

    def query(self, columns: str = "*"):
        """Inicia un SELECT filtrado por organizacion_id y sucursal_id."""
        return (
            super()
            .query(columns)
            .eq("sucursal_id", self.sucursal_id)
        )

    def insert(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        data = {
            **payload,
            "organizacion_id": self.organizacion_id,
            "sucursal_id": self.sucursal_id,
        }
        res = self.db.table(self.table_name).insert(data).execute()
        return res.data[0] if res.data else data

    def update(
        self,
        record_id: str,
        payload: Dict[str, Any],
        id_column: str = "id",
    ) -> Optional[Dict[str, Any]]:
        clean_payload = {
            k: v
            for k, v in payload.items()
            if k not in ("id", "organizacion_id", "sucursal_id")
        }
        res = (
            self.db.table(self.table_name)
            .update(clean_payload)
            .eq("organizacion_id", self.organizacion_id)
            .eq("sucursal_id", self.sucursal_id)
            .eq(id_column, record_id)
            .execute()
        )
        return res.data[0] if res.data else None

    def delete(self, record_id: str, id_column: str = "id") -> bool:
        res = (
            self.db.table(self.table_name)
            .delete()
            .eq("organizacion_id", self.organizacion_id)
            .eq("sucursal_id", self.sucursal_id)
            .eq(id_column, record_id)
            .execute()
        )
        return bool(res.data)
