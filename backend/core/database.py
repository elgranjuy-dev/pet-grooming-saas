import os
import re
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv
from supabase import create_client, Client

# Cargar variables de entorno desde backend/.env
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=_env_path)

# Normalizar formato IPv6 en NO_PROXY ([::1] -> ::1) para compatibilidad con httpx URLPattern
for _proxy_var in ("NO_PROXY", "no_proxy"):
    _val = os.environ.get(_proxy_var)
    if _val and "[::1]" in _val:
        os.environ[_proxy_var] = _val.replace("[::1]", "::1")

_JWT_REGEX = re.compile(r"^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$")
_PLACEHOLDER_JWT = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJyb2xlIjoic2VydmljZV9yb2xlIn0."
    "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
)


class SupabaseClientManager:
    """Gestor Singleton para el cliente de Supabase (compatible con claves JWT y sb_secret_)."""

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

        # Compatibilidad con llaves modernas de Supabase (sb_secret_ / sb_publishable_) en supabase-py 2.9.0
        init_key = key if _JWT_REGEX.match(key) else _PLACEHOLDER_JWT
        client = create_client(url, init_key)
        if init_key != key:
            client.supabase_key = key
            client.options.headers["apiKey"] = key
            client.options.headers["Authorization"] = f"Bearer {key}"
            client._postgrest = None

        self._client = client

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
