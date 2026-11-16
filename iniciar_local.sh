#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

# Detener instancias previas si existen (usando [c]haracter class para no coincidir con el propio shell)
pkill -f "[u]vicorn backend.main:app" 2>/dev/null || true
pkill -f "[h]ttp.server 3000" 2>/dev/null || true

nohup backend/venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &
BACKEND_PID=$!

echo "Servidor unificado FastAPI + Frontend iniciado (PID: $BACKEND_PID) -> http://127.0.0.1:8000 (log: backend.log)"
