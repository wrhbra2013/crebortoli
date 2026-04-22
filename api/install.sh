#!/bin/bash

# Script de instalação da API Fastify na VM
# Execute na VM: bash install.sh

echo "=== Instalando API Fastify ==="

# Diretório da API no servidor
API_DIR="/var/www/crebortoli/api"

cd $API_DIR

# Instalar dependências se necessário
if [ ! -d "node_modules" ]; then
    echo "Instalando dependências..."
    npm install
fi

# Criar arquivo .env se não existir
if [ ! -f .env ]; then
    cat > .env << 'EOF'
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

echo "=== Instalação concluída ==="
echo "Para iniciar a API: cd $API_DIR && npm start"
echo "Para testar: curl http://localhost:3001/health"
