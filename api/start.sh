#!/bin/bash

# Script para iniciar a API em background
# Execute: bash start.sh

API_DIR="/var/www/crebortoli/api"
cd $API_DIR

# Verificar se .env existe
if [ ! -f .env ]; then
    echo "Arquivo .env não encontrado. Execute primeiro: bash install.sh"
    exit 1
fi

# Verificar se já está rodando
if pgrep -f "node.*server.js" > /dev/null; then
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
