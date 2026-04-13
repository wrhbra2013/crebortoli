#!/bin/bash
set -e

# ===========================================
# ATALHO - Instalar API na VM Magalu Cloud
# ===========================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "============================================"
echo "  INSTALAR API NA VM"
echo "============================================"
echo ""
echo "  VM: 201.23.76.59"
echo "  Usuário: debian"
echo ""

# Verificar se rsync está disponível
if ! command -v rsync &> /dev/null; then
    echo "Erro: rsync não está instalado"
    echo "sudo apt install rsync"
    exit 1
fi

# Verificar SSH
echo "Verificando conexão..."
if ! ssh -o ConnectTimeout=5 debian@201.23.76.59 "echo connected" 2>/dev/null; then
    echo "Erro: Não foi possível conectar via SSH"
    echo "Verifique se a VM está acessível"
    exit 1
fi
echo "Conexão OK!"

# Executar instalação
echo ""
echo "Iniciando instalação..."

# 1. Node.js
echo "1. Instalando Node.js..."
ssh debian@201.23.76.59 "curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash - && sudo apt install -y nodejs" 2>/dev/null

# 2. Diretórios
echo "2. Criando diretórios..."
ssh debian@201.23.76.59 "sudo mkdir -p /var/www/crebortoli/api /var/www/crebortoli/uploads && sudo chown -R www-data:www-data /var/www/crebortoli"

# 3. Copiar API
echo "3. Copiando API..."
rsync -avz --exclude='node_modules' --exclude='.env' $SCRIPT_DIR/api/ debian@201.23.76.59:/tmp/crebortoli-api/
ssh debian@201.23.76.59 "sudo cp -r /tmp/crebortoli-api/* /var/www/crebortoli/api/"

# 4. .env
echo "4. Criando .env..."
ssh debian@201.23.76.59 "sudo tee /var/www/crebortoli/api/.env > /dev/null << 'EOF'
CREBORTOLI_DB_HOST=127.0.0.1
CREBORTOLI_DB_PORT=5432
CREBORTOLI_DB_USER=postgres
CREBORTOLI_DB_PASS=wander
CREBORTOLI_DB_NAME=crebortoli
API_TOKEN=crebortoli-api-token-2024
ALLOWED_ORIGINS=*
UPLOAD_DIR=uploads
EOF
sudo chmod 600 /var/www/crebortoli/api/.env"

# 5. npm install
echo "5. Instalando dependências..."
ssh debian@201.23.76.59 "cd /var/www/crebortoli/api && npm install --production"

# 6. Systemd
echo "6. Criando serviço systemd..."
ssh debian@201.23.76.59 "sudo tee /etc/systemd/system/crebortoli-api.service > /dev/null << 'EOF'
[Unit]
Description=Crebortoli API Node.js
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/crebortoli/api
ExecStart=/usr/bin/node /var/www/crebortoli/api/src/server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=/var/www/crebortoli/api/.env

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable crebortoli-api
sudo systemctl start crebortoli-api"

echo ""
echo "============================================"
echo "  INSTALAÇÃO CONCLUÍDA!"
echo "============================================"
echo ""
echo "Testar:"
echo "  curl http://127.0.0.1:3000/health"
echo ""
echo "Acessar VM:"
echo "  ssh debian@201.23.76.59"
echo ""
echo "Logs:"
echo "  sudo journalctl -u crebortoli-api -f"