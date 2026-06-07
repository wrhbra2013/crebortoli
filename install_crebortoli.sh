#!/bin/sh
set -eu

# ==============================================================
# Script de instalação — API Crebortoli
# Uso: sudo bash install_crebortoli.sh          (instalar)
#       sudo bash install_crebortoli.sh uninstall (desinstalar)
#
# API REST com Fastify + PostgreSQL.
# ==============================================================

SCRIPT_DIR="$(dirname "$0")"
INSTALL_DIR="/var/www/crebortoli"
SRC_DIR="$INSTALL_DIR/api/src"
NGINX_CONF="/etc/nginx/sites-available/default"
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { printf "${GREEN}[INFO]${NC} %s\n" "$1"; }
warn()  { printf "${YELLOW}[WARN]${NC} %s\n" "$1" >&2; }
error() { printf "${RED}[ERRO]${NC} %s\n" "$1" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || error "Execute como root: sudo bash install_crebortoli.sh"

if [ -n "${SUDO_USER:-}" ]; then
  PM2_USER="$SUDO_USER"
else
  PM2_USER="root"
fi
PM2_AS_USER=""
[ "$PM2_USER" != "root" ] && PM2_AS_USER="sudo -u $PM2_USER"


# ==============================================================
# Uninstall
# ==============================================================
uninstall() {
  echo ""
  info "===== Iniciando desinstalação da API Crebortoli ====="
  echo ""

  [ -f "$INSTALL_DIR/.env" ] && . "$INSTALL_DIR/.env" || true

  upm2="${PM2_APP_NAME:-crebortoli}"
  db_name="${DB_NAME:-crebortoli_db}"

  echo ""
  info "[1/4] Parando e removendo app do PM2 ($upm2)..."
  if $PM2_AS_USER pm2 delete "$upm2" 2>/dev/null; then
    info "PM2: app $upm2 removido"
  else
    warn "PM2: app $upm2 não encontrado ou já removido"
  fi
  $PM2_AS_USER pm2 save --force 2>/dev/null || true

  echo ""
  info "[2/4] Restaurando nginx a partir do backup..."
  if [ -f "$NGINX_CONF.bkp" ]; then
    cp "$NGINX_CONF.bkp" "$NGINX_CONF" && info "Nginx restaurado de $NGINX_CONF.bkp" || warn "Falha ao restaurar nginx"
  else
    warn "Backup $NGINX_CONF.bkp não encontrado — removendo marcador manualmente"
    sed -i "/^# LOCATION_BEGIN $upm2\$/,/^# LOCATION_END $upm2\$/d" "$NGINX_CONF" 2>/dev/null || true
    sed -i "/^# BEGIN $upm2\$/,/^# END $upm2\$/d" "$NGINX_CONF" 2>/dev/null || true
  fi
  if nginx -t 2>/dev/null; then
    systemctl reload nginx.service 2>/dev/null && info "Nginx recarregado" || warn "Falha ao recarregar nginx"
  else
    warn "Configuração do nginx inválida — verifique manualmente"
  fi

  echo ""
  info "[3/4] Removendo banco de dados ($db_name)..."
  if sudo -u postgres psql -c "DROP DATABASE IF EXISTS \"$db_name\";" 2>/dev/null; then
    info "Banco $db_name removido (usuário mantido)"
  else
    warn "Banco $db_name não encontrado ou já removido"
  fi

  echo ""
  info "[4/4] Removendo diretório $INSTALL_DIR..."
  rm -rf "$INSTALL_DIR" && info "Diretório $INSTALL_DIR removido com sucesso" || warn "Falha ao remover diretório $INSTALL_DIR"

  echo ""
  info "Desinstalação concluída!"
}

case "${1:-}" in
  uninstall) uninstall; exit 0 ;;
esac

cleanup_on_error() {
  [ $? -eq 0 ] && return 0
  warn "ERRO: Instalação falhou — revertendo..."
  rm -rf "$INSTALL_DIR" 2>/dev/null && warn "Diretório $INSTALL_DIR removido durante rollback" || true
  exit 1
}
trap cleanup_on_error EXIT
trap 'error "Instalação interrompida pelo usuário"' INT TERM

echo ""
info "===== Iniciando instalação da API Crebortoli ====="
echo ""

command -v node >/dev/null 2>&1 || error "Node.js não encontrado"
command -v npm  >/dev/null 2>&1 || error "npm não encontrado"
command -v psql >/dev/null 2>&1 || warn "psql não encontrado"
command -v pm2  >/dev/null 2>&1 || warn "pm2 não encontrado — será instalado via npm"

# --------------------------------------------------------------
# Inputs do usuário
# --------------------------------------------------------------
echo "============ Configuração da instalação ============"
_check_port() {
  local p=$1
  if command -v ss >/dev/null 2>&1; then
    ss -tlnp "sport = :$p" 2>/dev/null | grep -qv 'State.*Recv-Q' && return 0
  elif command -v lsof >/dev/null 2>&1; then
    lsof -i:"$p" 2>/dev/null | grep -q LISTEN && return 0
  fi
  return 1
}

while :; do
  printf "Porta do app [3001]: "; read -r APP_PORT
  APP_PORT=${APP_PORT:-3001}
  if _check_port "$APP_PORT"; then
    warn "Porta $APP_PORT já está em uso!"
    printf "  (M)atar processo, (T)rocar porta, (C)ancelar [M/t/c]: "; read -r PORT_ACT
    case "$PORT_ACT" in
      [Tt]) continue ;;
      [Cc]) error "Instalação cancelada pelo usuário" ;;
      *)
        fuser -k "$APP_PORT/tcp" 2>/dev/null && info "Processo na porta $APP_PORT encerrado" || warn "Não foi possível encerrar — tente trocar a porta"
        sleep 1
        ;;
    esac
  fi
  break
done
info "Porta definida: $APP_PORT"

printf "Nome do banco de dados PostgreSQL [crebortoli_db]: "; read -r DB_NAME
DB_NAME=${DB_NAME:-crebortoli_db}; info "DB_NAME: $DB_NAME"
printf "Nome do app no PM2 [crebortoli]: "; read -r PM2_APP_NAME
PM2_APP_NAME=${PM2_APP_NAME:-crebortoli}; info "PM2_APP_NAME: $PM2_APP_NAME"
APP_DOMAIN=api.projetosdinamicos.com.br

# --------------------------------------------------------------
# Criar diretórios e copiar projeto
# --------------------------------------------------------------
info "Criando diretórios..."
mkdir -p "$SRC_DIR" && info "Diretórios criados: $SRC_DIR" || warn "Erro ao criar diretórios"

info "Copiando arquivos do projeto..."
cp -r "$SCRIPT_DIR/api" "$INSTALL_DIR/" && info "API copiada para $INSTALL_DIR/api" || error "Falha ao copiar API"
cp -r "$SCRIPT_DIR/data" "$INSTALL_DIR/" 2>/dev/null || true

# --------------------------------------------------------------
# .env
# --------------------------------------------------------------
API_TOKEN=$(openssl rand -hex 16 2>/dev/null || echo "$(date +%s)$RANDOM" | md5sum | head -c 32)
info "Criando .env (PORT=$APP_PORT, API_TOKEN gerado)"
cat > "$INSTALL_DIR/.env" <<ENVEOF
PORT=$APP_PORT
CREBORTOLI_DB_HOST=localhost
CREBORTOLI_DB_PORT=5432
CREBORTOLI_DB_NAME=$DB_NAME
CREBORTOLI_DB_USER=postgres
CREBORTOLI_DB_PASS=wander
API_TOKEN=$API_TOKEN
PM2_APP_NAME=$PM2_APP_NAME
ENVEOF
chmod 600 "$INSTALL_DIR/.env" && info "Permissões do .env ajustadas (600)" || warn "Falha ao ajustar permissões"
chown "$PM2_USER" "$INSTALL_DIR/.env" && info "Proprietário do .env definido: $PM2_USER" || warn "Falha ao definir proprietário"

# --------------------------------------------------------------
# Nginx — gera config completa
# --------------------------------------------------------------
LOC_MARKER_BEGIN="# LOCATION_BEGIN $PM2_APP_NAME"
LOC_MARKER_END="# LOCATION_END $PM2_APP_NAME"

info "Configurando Nginx"
info "Criando backup do nginx atual..."
cp "$NGINX_CONF" "$NGINX_CONF.bkp" 2>/dev/null && info "Backup criado: $NGINX_CONF.bkp" || warn "Falha ao criar backup"

info "Gerando configuracao nginx..."

cat > "$NGINX_CONF" <<NGINXEOF
# BEGIN crebortoli
server {
    listen 80;
    listen [::]:80;
    server_name $APP_DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www;
    }

    location /crebortoli/ {
        add_header Access-Control-Allow-Origin \$http_origin always;
        add_header Access-Control-Allow-Methods 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header Access-Control-Allow-Headers 'Content-Type, Authorization' always;

        if (\$request_method = OPTIONS) {
            add_header Access-Control-Allow-Origin \$http_origin always;
            add_header Access-Control-Allow-Methods 'GET, POST, PUT, DELETE, OPTIONS' always;
            add_header Access-Control-Allow-Headers 'Content-Type, Authorization' always;
            return 204;
        }

        proxy_pass http://127.0.0.1:$APP_PORT/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name $APP_DOMAIN;

    ssl_certificate /etc/letsencrypt/live/$APP_DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$APP_DOMAIN/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;

    location /.well-known/acme-challenge/ {
        root /var/www;
    }

    location /crebortoli/ {
        add_header Access-Control-Allow-Origin \$http_origin always;
        add_header Access-Control-Allow-Methods 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header Access-Control-Allow-Headers 'Content-Type, Authorization' always;

        if (\$request_method = OPTIONS) {
            add_header Access-Control-Allow-Origin \$http_origin always;
            add_header Access-Control-Allow-Methods 'GET, POST, PUT, DELETE, OPTIONS' always;
            add_header Access-Control-Allow-Headers 'Content-Type, Authorization' always;
            return 204;
        }

        proxy_pass http://127.0.0.1:$APP_PORT/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

$LOC_MARKER_BEGIN
    location /$PM2_APP_NAME/ {
        add_header Access-Control-Allow-Origin \$http_origin always;
        add_header Access-Control-Allow-Methods 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header Access-Control-Allow-Headers 'Content-Type, Authorization' always;

        if (\$request_method = OPTIONS) {
            add_header Access-Control-Allow-Origin \$http_origin always;
            add_header Access-Control-Allow-Methods 'GET, POST, PUT, DELETE, OPTIONS' always;
            add_header Access-Control-Allow-Headers 'Content-Type, Authorization' always;
            return 204;
        }

        proxy_pass http://127.0.0.1:3002/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
$LOC_MARKER_END

    client_max_body_size 15M;
}

server {
    listen 80;
    listen [::]:80;
    server_name www.crebortoli.com.br crebortoli.com.br;

    location /.well-known/acme-challenge/ {
        root /var/www;
    }

    location / {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
# END crebortoli

# BEGIN amoranimal_site
server {
    listen 80;
    listen [::]:80;
    server_name 201.54.22.122;

    location /.well-known/acme-challenge/ {
        root /var/www;
    }

    location / {
        return 301 https://www.amoranimal.ong.br\$request_uri;
    }
}

server {
    listen 80;
    listen [::]:80;
    server_name www.amoranimal.ong.br amoranimal.ong.br;

    location /.well-known/acme-challenge/ {
        root /var/www;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name www.amoranimal.ong.br amoranimal.ong.br 201.54.22.122;

    ssl_certificate /etc/letsencrypt/live/amoranimal.ong.br-0001/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/amoranimal.ong.br-0001/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location /.well-known/acme-challenge/ {
        root /var/www;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    client_max_body_size 15M;
}
# END amoranimal_site
NGINXEOF

info "Configuracao nginx gerada em $NGINX_CONF"

# --------------------------------------------------------------
# PostgreSQL — criar banco
# --------------------------------------------------------------
info "Criando banco PostgreSQL ($DB_NAME)..."
if command -v sudo >/dev/null 2>&1 && sudo -u postgres psql -c "SELECT 1" >/dev/null 2>&1; then
  info "PostgreSQL acessível via sudo -u postgres"
  if sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER postgres;" 2>&1; then
    info "Banco $DB_NAME criado"
  else
    warn "Banco $DB_NAME já existe ou erro ao criar"
  fi
else
  warn "Não foi possível acessar o PostgreSQL como superusuário (postgres)"
  warn "Crie manualmente: sudo -u postgres createdb $DB_NAME -O postgres"
fi

# --------------------------------------------------------------
# Migration — criar todas as tabelas do projeto
# --------------------------------------------------------------
info "Executando migration — criando tabelas..."
MIGRATION_FILE="$INSTALL_DIR/migrations/001_create_tables.sql"
mkdir -p "$INSTALL_DIR/migrations" && info "Diretório de migrations criado" || warn "Erro ao criar diretório de migrations"

# Lê vars de conexão do .env
[ -f "$INSTALL_DIR/.env" ] && . "$INSTALL_DIR/.env"

cat > "$MIGRATION_FILE" <<SQLEOF
-- ============================================================
-- Migration 001: Cria todas as tabelas do sistema Crebortoli
-- Execute com: psql -h HOST -p PORT -U USER -d DB -f migrations/001_create_tables.sql
-- ============================================================

-- agendamentos: agendamentos de serviços
CREATE TABLE IF NOT EXISTS agendamentos (
    id UUID PRIMARY KEY,
    cliente TEXT,
    telefone TEXT,
    servico TEXT,
    servico_nome TEXT,
    valor DECIMAL(10,2),
    data TIMESTAMP,
    hora TEXT,
    status TEXT DEFAULT 'pendente',
    pago BOOLEAN DEFAULT false,
    observacoes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- servicos: serviços oferecidos
CREATE TABLE IF NOT EXISTS servicos (
    id UUID PRIMARY KEY,
    nome TEXT,
    descricao TEXT,
    preco DECIMAL(10,2),
    duracao_minutos INTEGER,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- clientes: clientes cadastrados
CREATE TABLE IF NOT EXISTS clientes (
    id UUID PRIMARY KEY,
    nome TEXT,
    telefone TEXT,
    email TEXT,
    cpf TEXT,
    endereco TEXT,
    observacoes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- receitas: receitas médicas
CREATE TABLE IF NOT EXISTS receitas (
    id UUID PRIMARY KEY,
    paciente TEXT,
    data TEXT,
    data_formatada TEXT,
    indicacao TEXT,
    medicamentos TEXT,
    observacoes TEXT,
    comentarios TEXT,
    nome_arquivo TEXT,
    cliente_id UUID,
    diagnostico TEXT,
    prescricao TEXT,
    validado BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- contatos: formulário de contato
CREATE TABLE IF NOT EXISTS contatos (
    id UUID PRIMARY KEY,
    nome TEXT,
    email TEXT,
    telefone TEXT,
    mensagem TEXT,
    lido BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- sessoes: sessões de autenticação do financeiro
CREATE TABLE IF NOT EXISTS sessoes (
    id UUID PRIMARY KEY,
    token TEXT UNIQUE,
    url_aprovacao TEXT,
    status TEXT DEFAULT 'pendente',
    last_sync TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- usuarios: usuários do sistema
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE,
    senha TEXT,
    nome TEXT,
    nivel TEXT DEFAULT 'user',
    created_at TIMESTAMP DEFAULT NOW()
);

-- configuracoes: armazenamento chave-valor
CREATE TABLE IF NOT EXISTS configuracoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chave TEXT UNIQUE,
    valor TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);
SQLEOF

info "Arquivo de migration gerado: $MIGRATION_FILE"

# Executar migration
info "Executando migration ($MIGRATION_FILE)..."
if PGPASSWORD="$CREBORTOLI_DB_PASS" psql -h "$CREBORTOLI_DB_HOST" -p "$CREBORTOLI_DB_PORT" -U "$CREBORTOLI_DB_USER" -d "$DB_NAME" -f "$MIGRATION_FILE" 2>&1; then
  info "Migration executada com sucesso!"
else
  warn "Erro ao executar migration — execute manualmente: psql -h $CREBORTOLI_DB_HOST -p $CREBORTOLI_DB_PORT -U $CREBORTOLI_DB_USER -d $DB_NAME -f $MIGRATION_FILE"
fi

# --------------------------------------------------------------
# Instalar dependências
# --------------------------------------------------------------
info "Instalando dependências npm..."
if npm install --prefix "$INSTALL_DIR/api" --production 2>&1; then
  info "Dependências npm instaladas com sucesso"
else
  warn "Erro ao instalar dependências — execute manualmente: npm install --prefix $INSTALL_DIR/api"
fi

# --------------------------------------------------------------
# PM2
# --------------------------------------------------------------
info "Registrando app no PM2 (usuário: $PM2_USER)"
$PM2_AS_USER pm2 delete "$PM2_APP_NAME" 2>/dev/null || true
if $PM2_AS_USER pm2 start "$SRC_DIR/server.js" --name "$PM2_APP_NAME" 2>&1; then
  $PM2_AS_USER pm2 save --force 2>&1
  info "PM2: app registrado e salvo"
else
  warn "Erro ao iniciar app no PM2 — execute manualmente: pm2 start $SRC_DIR/server.js --name $PM2_APP_NAME"
fi

# --------------------------------------------------------------
# Nginx reload
# --------------------------------------------------------------
info "Testando e recarregando Nginx"
if nginx -t 2>&1; then
  info "Nginx: configuração válida"
  if systemctl reload nginx.service 2>&1; then
    info "Nginx recarregado com sucesso!"
  else
    warn "Erro ao recarregar nginx — execute manualmente: sudo systemctl reload nginx.service"
  fi
else
  warn "Configuração do nginx inválida — execute manualmente: sudo nginx -t"
fi

# --------------------------------------------------------------
# Final
# --------------------------------------------------------------
echo ""
info "===== Instalação concluída! ====="
echo ""
echo "  Domínio: $APP_DOMAIN  |  Location: /crebortoli/  |  Porta: $APP_PORT"
echo "  PM2:     $PM2_APP_NAME ($PM2_USER)"
echo "  .env:    $INSTALL_DIR/.env"
echo ""

info "Testando API..." && sleep 2
resp=$(curl -s "http://127.0.0.1:$APP_PORT/" 2>/dev/null) || resp=""
echo "$resp" | grep -q '"status":"OK"\|"ok"' && info "API:       ✓" || warn "API:       ✗ $resp"

echo && info "Testes concluídos!"
echo ""
echo "  PM2:     pm2 {status|logs|restart} $PM2_APP_NAME"
echo "  .env:    $INSTALL_DIR/.env"
echo ""
