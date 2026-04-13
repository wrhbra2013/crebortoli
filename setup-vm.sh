#!/bin/bash
set -e

# ===========================================
# Script de Configuração - Crebortoli API
# VM: 201.23.76.59
# PHP 8.4 + Nginx (integrado com Node.js) + PostgreSQL
# ===========================================

echo "============================================"
echo "  Configuração da API - Crebortoli"
echo "============================================"
echo ""

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Verificar se é root
if [ "$EUID" -ne 0 ]; then
    error "Execute como root: sudo $0"
    exit 1
fi

# Configurações Padrões
DB_NAME=${DB_NAME:-crebortoli}
DB_USER=${DB_USER:-postgres}
DB_PASS=${DB_PASS:-}
DOMAIN=${DOMAIN:-}

# 1. Atualizar sistema
echo ""
echo "1. Atualizando sistema..."
apt update && apt upgrade -y

# 2. Instalar PHP 8.4 e extensions (sem Nginx, sem PostgreSQL)
echo ""
echo "2. Instalando PHP 8.4..."
apt install -y php8.4 php8.4-fpm php8.4-pgsql php8.4-cli php8.4-curl php8.4-mbstring php8.4-xml php8.4-zip php8.4-gd

# 3. Criar diretórios necessários
echo ""
echo "3. Preparando diretórios..."
mkdir -p /etc/php/8.4/fpm/pool.d
mkdir -p /var/run/php
mkdir -p /var/log/php
mkdir -p /var/www/crebortoli/uploads

# 4. Configurar PHP-FPM
echo ""
echo "4. Configurando PHP-FPM..."

# PHP-FPM www pool
cat > /etc/php/8.4/fpm/pool.d/www.conf << 'EOF'
[www]
user = www-data
group = www-data
listen = /var/run/php/php8.4-fpm.sock
listen.owner = www-data
listen.group = www-data
listen.mode = 0660

pm = dynamic
pm.max_children = 10
pm.start_servers = 2
pm.min_spare_servers = 1
pm.max_spare_servers = 5
pm.max_requests = 500

php_admin_value[error_log] = /var/log/php/8.4-fpm-www.log
php_admin_flag[log_errors] = on
php_value[session.cookie_httponly] = 1
php_value[display_errors] = Off
php_value[expose_php] = Off
php_value[memory_limit] = 128M
php_value[upload_max_filesize] = 50M
php_value[post_max_size] = 50M
EOF

# Corrigir permissões
chown -R root:root /etc/php/8.4/fpm/
chown root:www-data /etc/php/8.4/fpm/pool.d/*.conf

# Iniciar PHP-FPM
systemctl enable php8.4-fpm
systemctl restart php8.4-fpm

if systemctl is-active --quiet php8.4-fpm; then
    log "PHP-FPM rodando"
else
    warn "PHP-FPM falhou, verificando..."
    journalctl -u php8.4-fpm -n 10 --no-pager
fi

# 5. Criar site Nginx para API
echo ""
echo "5. Configurando Nginx (site api)..."

cat > /etc/nginx/sites-available/api << EOF
server {
    listen 80;
    server_name api.crebortoli.com.br _;
    root /var/www/crebortoli;
    index api.php;

    access_log /var/log/nginx/api_access.log;
    error_log /var/log/nginx/api_error.log;

    client_max_body_size 50M;

    location / {
        try_files \$uri \$uri/ /api.php?\$query_string;
    }

    location ~ \.php\$ {
        include fastcgi_params;
        fastcgi_pass unix:/var/run/php/php8.4-fpm.sock;
        fastcgi_index api.php;
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        fastcgi_read_timeout 60s;
    }

    location ~ /\. {
        deny all;
    }
}
EOF

# Ativar site
ln -sf /etc/nginx/sites-available/api /etc/nginx/sites-enabled/api
nginx -t && systemctl reload nginx
log "Nginx configurado"

# 6. Configurar PostgreSQL
echo ""
echo "6. Configurando PostgreSQL..."

# Se senha não foi passada, gerar uma aleatória
if [ -z "$DB_PASS" ]; then
    DB_PASS=$(openssl rand -base64 24)
    echo "Senha gerada: $DB_PASS"
fi

sudo -u postgres psql << PSQL
SELECT 'CREATE DATABASE $DB_NAME' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')\gexec

DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '$DB_USER') THEN
        CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';
    END IF;
END
\$\$;

GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
ALTER DATABASE $DB_NAME OWNER TO $DB_USER;
PSQL

log "PostgreSQL: banco=$DB_NAME, usuario=$DB_USER"

# 7. Arquivo .env
echo ""
echo "7. Criando arquivo .env..."
cat > /var/www/crebortoli/.env << EOF
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASS=$DB_PASS
EOF

chown www-data:www-data /var/www/crebortoli/.env
chmod 600 /var/www/crebortoli/.env
log ".env criado"

# 8. Permissões
echo ""
echo "8. Aplicando permissões..."
chown -R www-data:www-data /var/www/crebortoli
chmod -R 755 /var/www/crebortoli

# 9. Uploads
mkdir -p /var/www/crebortoli/uploads
chown -R www-data:www-data /var/www/crebortoli/uploads

# 10. Status
echo ""
echo "============================================"
echo "  Status dos Serviços"
echo "============================================"
systemctl status php8.4-fpm --no-pager | head -3
echo ""
systemctl status nginx --no-pager | head -3

# 11. Resumo
echo ""
echo "============================================"
echo "  Configuração Concluída!"
echo "============================================"
echo ""
echo "  Diretório:     /var/www/crebortoli"
echo "  Banco:         $DB_NAME"
echo "  Usuário:       $DB_USER"
echo "  Senha:         $DB_PASS"
echo ""
echo "  Próximos passos:"
echo "  1. scp api.php root@201.23.76.59:/var/www/crebortoli/"
echo "  2. curl -X POST 'http://201.23.76.59/api.php?action=status'"
echo ""
echo "  Para SSL com Let's Encrypt:"
echo "  DOMAIN=api.exemplo.com $0"
echo ""

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Verificar se é root
if [ "$EUID" -ne 0 ]; then
    error "Execute como root: sudo $0"
    exit 1
fi

# 1. Atualizar sistema
echo ""
echo "1. Atualizando sistema..."
apt update && apt upgrade -y

# 2. Instalar Nginx
echo ""
echo "2. Instalando Nginx..."
apt install -y nginx

# 3. Instalar PHP 8.4 e extensions
echo ""
echo "3. Instalando PHP 8.4..."
apt install -y php8.4 php8.4-fpm php8.4-pgsql php8.4-cli php8.4-curl php8.4-mbstring php8.4-xml php8.4-zip php8.4-gd

# 4. Instalar PostgreSQL
echo ""
echo "4. Instalando PostgreSQL..."
apt install -y postgresql postgresql-contrib

# 5. Iniciar serviços
echo ""
echo "5. Iniciando serviços..."
systemctl enable nginx php8.4-fpm postgresql
systemctl start nginx php8.4-fpm postgresql

# 6. Configurar PostgreSQL
echo ""
echo "6. Configurando PostgreSQL..."
echo ""
read -p "Nome do banco de dados [crebortoli]: " DB_NAME
DB_NAME=${DB_NAME:-crebortoli}

read -p "Usuário PostgreSQL [postgres]: " DB_USER
DB_USER=${DB_USER:-postgres}

read -s -p "Senha PostgreSQL: " DB_PASS
echo ""

# Criar banco e usuário
sudo -u postgres psql << EOF
-- Criar banco se não existir
SELECT 'CREATE DATABASE $DB_NAME' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')\gexec

-- Criar usuário se não existir
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '$DB_USER') THEN
        CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';
    END IF;
END
\$\$;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
ALTER DATABASE $DB_NAME OWNER TO $DB_USER;
EOF

log "PostgreSQL configurado: banco=$DB_NAME, usuario=$DB_USER"

# 7. Criar diretório da API
echo ""
echo "7. Criando diretório da API..."
mkdir -p /var/www/crebortoli
chown -R www-data:www-data /var/www/crebortoli
chmod -R 755 /var/www/crebortoli

# 8. Configurar Nginx
echo ""
echo "8. Configurando Nginx..."
cat > /etc/nginx/sites-available/crebortoli << 'EOF'
server {
    listen 80;
    server_name _;
    root /var/www/crebortoli;
    index api.php;

    # Logs
    access_log /var/log/nginx/crebortoli_access.log;
    error_log /var/log/nginx/crebortoli_error.log;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    location / {
        try_files $uri $uri/ /api.php?$query_string;
    }

    location ~ \.php$ {
        limit_req zone=api burst=20 nodelay;
        
        fastcgi_pass unix:/var/run/php/php8.4-fpm-api.sock;
        fastcgi_index api.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
        
        fastcgi_hide_header X-Powered-By;
        fastcgi_read_timeout 60s;
    }

    # Proteger arquivos sensíveis
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    # Cache estático
    location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Ativar site
ln -sf /etc/nginx/sites-available/crebortoli /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Testar e reload
nginx -t && systemctl reload nginx
log "Nginx configurado"

# 9. Configurar PHP-FPM
echo ""
echo "9. Configurando PHP-FPM..."

# Criar diretórios necessários
mkdir -p /etc/php/8.4/fpm/pool.d
mkdir -p /var/run/php
mkdir -p /var/log/php

# Criar configuração principal do FPM
cat > /etc/php/8.4/fpm/php.ini << 'EOF'
[PHP]
engine = On
short_open_tag = Off
precision = 14
output_buffering = 4096
zlib.output_compression = Off
implicit_flush = Off
serialize_precision = -1
disable_functions = 
disable_classes = 
zend.enable_gc = On
expose_php = Off
max_execution_time = 30
max_input_time = 60
memory_limit = 128M
error_reporting = E_ALL & ~E_DEPRECATED & ~E_STRICT
display_errors = Off
display_startup_errors = Off
log_errors = On
error_log = /var/log/php/8.4-fpm-error.log
post_max_size = 8M
default_mimetype = "application/octet-stream"
default_charset = "UTF-8"
file_uploads = On
upload_max_filesize = 10M
max_file_uploads = 20
allow_url_fopen = On
allow_url_include = Off
EOF

# Criar configuração do www pool (padrão)
cat > /etc/php/8.4/fpm/pool.d/www.conf << 'EOF'
[www]
user = www-data
group = www-data
listen = /var/run/php/php8.4-fpm.sock
listen.owner = www-data
listen.group = www-data
listen.mode = 0660

pm = dynamic
pm.max_children = 10
pm.start_servers = 2
pm.min_spare_servers = 1
pm.max_spare_servers = 5
pm.max_requests = 500

; Logs
php_admin_value[error_log] = /var/log/php/8.4-fpm-www.log
php_admin_flag[log_errors] = on

; Segurança
php_value[session.cookie_httponly] = 1
php_value[display_errors] = Off
php_value[expose_php] = Off
php_value[memory_limit] = 128M
php_value[upload_max_filesize] = 10M
php_value[post_max_size] = 10M
EOF

# Criar configuração do pool da API
cat > /etc/php/8.4/fpm/pool.d/api.conf << 'EOF'
[api]
user = www-data
group = www-data
listen = /var/run/php/php8.4-fpm-api.sock
listen.owner = www-data
listen.group = www-data
listen.mode = 0660

pm = dynamic
pm.max_children = 20
pm.start_servers = 4
pm.min_spare_servers = 2
pm.max_spare_servers = 10
pm.max_requests = 1000

; Logs
php_admin_value[error_log] = /var/log/php/8.4-fpm-api.log
php_admin_flag[log_errors] = on

; Segurança
php_value[session.cookie_httponly] = 1
php_value[display_errors] = Off
php_value[expose_php] = Off
php_value[memory_limit] = 256M
php_value[upload_max_filesize] = 50M
php_value[post_max_size] = 50M
php_value[max_execution_time] = 60
php_value[max_input_time] = 60
EOF

# Corrigir permissões
chown -R root:root /etc/php/8.4/fpm/
chown root:www-data /etc/php/8.4/fpm/pool.d/*.conf

# Reiniciar PHP-FPM
systemctl restart php8.4-fpm

# Verificar se iniciou
if systemctl is-active --quiet php8.4-fpm; then
    log "PHP-FPM configurado e rodando"
else
    warn "PHP-FPM não iniciou, verificando logs..."
    journalctl -u php8.4-fpm -n 20 --no-pager
fi

# 10. Variáveis de ambiente
echo ""
echo "10. Configurando variáveis de ambiente..."
cat > /etc/environment.d/crebortoli.conf << EOF
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASS=$DB_PASS
EOF

# Criar arquivo .env para a aplicação
cat > /var/www/crebortoli/.env << EOF
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASS=$DB_PASS
EOF

chown www-data:www-data /var/www/crebortoli/.env
chmod 600 /var/www/crebortoli/.env
log "Variáveis de ambiente configuradas"

# 11. Firewall
echo ""
echo "11. Configurando firewall..."
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable

# 12. SSL (Let's Encrypt)
echo ""
echo "12. Instalando SSL..."
read -p "Deseja configurar SSL com Let's Encrypt? (s/n): " SSL_CHOICE
if [ "$SSL_CHOICE" = "s" ]; then
    read -p "Domínio (ex: api.exemplo.com): " DOMAIN
    
    apt install -y certbot python3-certbot-nginx
    
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m admin@$DOMAIN
    
    # Auto-renewal
    systemctl enable certbot.timer
    systemctl start certbot.timer
    
    # Atualizar nginx com SSL
    cat > /etc/nginx/sites-available/crebortoli-ssl << 'SSLEOF'
server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name DOMAIN_PLACEHOLDER;
    root /var/www/crebortoli;
    index api.php;

    ssl_certificate /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/chain.pem;

    # SSL Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # Logs
    access_log /var/log/nginx/crebortoli_access.log;
    error_log /var/log/nginx/crebortoli_error.log;

    # Headers segurança
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    location / {
        try_files $uri $uri/ /api.php?$query_string;
    }

    location ~ \.php$ {
        limit_req zone=api burst=20 nodelay;
        
        fastcgi_pass unix:/var/run/php/php8.4-fpm-api.sock;
        fastcgi_index api.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
        
        fastcgi_read_timeout 60s;
    }

    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
SSLEOF
    
    sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" /etc/nginx/sites-available/crebortoli-ssl
    ln -sf /etc/nginx/sites-available/crebortoli-ssl /etc/nginx/sites-enabled/crebortoli
    rm -f /etc/nginx/sites-available/crebortoli
    nginx -t && systemctl reload nginx
    
    log "SSL configurado para $DOMAIN"
fi

# 13. Uploads
mkdir -p /var/www/crebortoli/uploads
chown -R www-data:www-data /var/www/crebortoli/uploads
chmod -R 755 /var/www/crebortoli/uploads

# 14. Permissões finais
chown -R www-data:www-data /var/www/crebortoli
find /var/www/crebortoli -type f -exec chmod 644 {} \;
find /var/www/crebortoli -type d -exec chmod 755 {} \;

# 15. Status dos serviços
echo ""
echo "============================================"
echo "  Status dos Serviços"
echo "============================================"
echo ""
systemctl status nginx --no-pager | head -5
echo ""
systemctl status php8.4-fpm --no-pager | head -5
echo ""
systemctl status postgresql --no-pager | head -5

# 16. Teste
echo ""
echo "============================================"
echo "  Teste da API"
echo "============================================"
echo ""

curl -s -X POST "http://localhost/api.php?action=status" | head -20

echo ""
echo ""
log "Configuração concluída!"
echo ""
echo "============================================"
echo "  Resumo"
echo "============================================"
echo "  Diretório:     /var/www/crebortoli"
echo "  Banco:         $DB_NAME"
echo "  Usuário:       $DB_USER"
echo "  URL:           http://201.23.76.59/api.php"
echo ""
echo "  Próximos passos:"
echo "  1. Copie api.php para /var/www/crebortoli/"
echo "  2. Acesse http://201.23.76.59/api.php?action=status"
echo ""
