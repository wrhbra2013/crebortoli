#!/bin/bash

# Script para iniciar a API em background
# Execute: bash start.sh

API_DIR="/var/www/crebortoli/api"
cd $API_DIR

# Criar .env se não existir
if [ ! -f .env ]; then
    echo "Criando arquivo .env..."
    cat > .env <<EOF
CREBORTOLI_DB_HOST=201.54.22.122
CREBORTOLI_DB_PORT=5432
CREBORTOLI_DB_USER=postgres
CREBORTOLI_DB_PASS=wander
CREBORTOLI_DB_NAME=crebortoli_db

API_TOKEN=crebortoli-api-token-2024
ALLOWED_ORIGINS=*
PORT=3001
EOF
fi

# Verificar se já está rodando
if pgrep -f "crebortoli-api" > /dev/null; then
    echo "API já está rodando!"
    curl -s http://localhost:3001/health
    exit 0
fi

# Iniciar em background
nohup npm start > api.log 2>&1 &
echo "API iniciada em background"

# Aguardar 3 segundos e verificar
sleep 3
curl -s http://localhost:3001/health || echo "Verifique os logs: cat api.log"
