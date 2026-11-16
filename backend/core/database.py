import os
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv
from supabase import create_client, Client

# Cargar variables de entorno desde backend/.env
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=_env_path)


class SupabaseClientManager:
    """Gestor Singleton para el cliente de Supabase."""

    _instance: Optional["SupabaseClientManager"] = None
    _client: Optional[Client] = None

    def __new__(cls) -> "SupabaseClientManager":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialize_client()
        return cls._instance

    def _initialize_client(self) -> None:
        url = os.getenv("SUPABASE_URL", "").strip()
        key = os.getenv("SUPABASE_KEY", "").strip()
        if not url or not key:
            raise RuntimeError(
                "Faltan las credenciales SUPABASE_URL o SUPABASE_KEY en backend/.env"
            )
        self._client = create_client(url, key)

    @property
    def client(self) -> Client:
        if self._client is None:
            self._initialize_client()
        return self._client

    @classmethod
    def get_client(cls) -> Client:
        return cls().client


def get_db() -> Client:
    """Dependencia FastAPI / helper para obtener el cliente Supabase."""
    return SupabaseClientManager.get_client()
