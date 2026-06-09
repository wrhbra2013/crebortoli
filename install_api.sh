#!/bin/sh
set -eu

# ==============================================================
# Script de instalação — API Genérica (Docker)
# Uso: sudo bash install_api.sh          (instalar)
#       sudo bash install_api.sh uninstall (desinstalar)
#
# API REST genérica com Express + PostgreSQL em containers Docker.
# Requer: Debian 11+ (sudo apt para dependências)
# ==============================================================

SCRIPT_DIR="$(dirname "$0")"
INSTALL_DIR=""
SRC_DIR=""
NGINX_AVAILABLE="/etc/nginx/sites-available"
NGINX_CONF="$NGINX_AVAILABLE/default"
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { printf "${GREEN}[INFO]${NC} %s\n" "$1"; }
warn()  { printf "${YELLOW}[WARN]${NC} %s\n" "$1" >&2; }
error() { printf "${RED}[ERRO]${NC} %s\n" "$1" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || error "Execute como root: sudo bash install_api.sh"


# ==============================================================
# Uninstall
# ==============================================================
uninstall() {
  echo ""
  info "===== Iniciando desinstalação (Docker) ====="
  echo ""

  . "$INSTALL_DIR/.env" 2>/dev/null || true

  dname="${COMPOSE_PROJECT_NAME:-app}"

  _dc_cmd="docker compose"
  docker compose version >/dev/null 2>&1 || _dc_cmd="docker-compose"

  info "[1/4] Parando e removendo containers Docker ($dname)..."
  if [ -f "$INSTALL_DIR/docker-compose.yml" ]; then
    $_dc_cmd -f "$INSTALL_DIR/docker-compose.yml" down -v 2>/dev/null && \
      info "Containers e volumes removidos" || \
      warn "Falha ao derrubar containers"
  else
    warn "docker-compose.yml não encontrado"
  fi

  info "[2/4] Restaurando nginx..."
  if [ -f "$NGINX_CONF.bkp" ]; then
    cp "$NGINX_CONF.bkp" "$NGINX_CONF" && info "Nginx restaurado" || warn "Falha ao restaurar nginx"
  else
    warn "Backup não encontrado — removendo location manualmente"
    sed -i "/^# LOCATION_BEGIN $dname\$/,/^# LOCATION_END $dname\$/d" "$NGINX_CONF" 2>/dev/null || true
  fi
  if nginx -t 2>/dev/null; then
    systemctl reload nginx.service 2>/dev/null && info "Nginx recarregado" || true
  fi

  info "[3/4] Removendo imagens Docker do projeto..."
  docker images "${dname}-api:latest" -q 2>/dev/null | xargs -r docker rmi 2>/dev/null || true

  info "[4/4] Removendo diretório $INSTALL_DIR..."
  rm -rf "$INSTALL_DIR" && info "Diretório removido" || warn "Falha ao remover diretório"

  info "Desinstalação concluída!"
}

case "${1:-}" in
  uninstall) uninstall; exit 0 ;;
esac

echo ""
info "===== Instalação de API Genérica (Docker) ====="
echo ""


# --------------------------------------------------------------
# Docker Engine + Docker Compose — instala via apt
# --------------------------------------------------------------
info "Verificando/instalando Docker Engine e Docker Compose..."
if ! command -v docker >/dev/null 2>&1; then
  info "Docker não encontrado — instalando docker.io via apt..."
  apt-get update -qq
  apt-get install -y -qq docker.io
  systemctl enable --now docker
  info "Docker Engine instalado"
else
  info "Docker já instalado"
fi

DOCKER_COMPOSE_CMD=""
if docker compose version >/dev/null 2>&1; then
  DOCKER_COMPOSE_CMD="docker compose"
  info "Docker Compose (plugin) disponível"
elif docker-compose --version >/dev/null 2>&1; then
  DOCKER_COMPOSE_CMD="docker-compose"
  info "Docker Compose (standalone) disponível"
else
  info "Instalando Docker Compose plugin..."
  apt-get install -y -qq docker-compose-plugin 2>/dev/null || \
    apt-get install -y -qq docker-compose 2>/dev/null || \
    error "Falha ao instalar Docker Compose — instale manualmente"
  if docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="docker compose"
  elif docker-compose --version >/dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="docker-compose"
  else
    error "Docker Compose não disponível após instalação"
  fi
fi

# Verifica nginx
if ! command -v nginx >/dev/null 2>&1; then
  info "Instalando nginx..."
  apt-get install -y -qq nginx
fi


# --------------------------------------------------------------
# Inputs do usuário
# --------------------------------------------------------------
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
  printf "Porta do app (host) [3000]: "; read -r APP_PORT
  APP_PORT=${APP_PORT:-3000}
  if _check_port "$APP_PORT"; then
    warn "Porta $APP_PORT já está em uso!"
    printf "  (M)atar, (T)rocar, (C)ancelar [M/t/c]: "; read -r PORT_ACT
    case "$PORT_ACT" in
      [Tt]) continue ;;
      [Cc]) error "Cancelado" ;;
      *)
        fuser -k "$APP_PORT/tcp" 2>/dev/null && info "Porta liberada" || warn "Não foi possível liberar"
        sleep 1 ;;
    esac
  fi
  break
done

printf "Nome do app (usado na URL, Docker e PM2) [app]: "; read -r COMPOSE_PROJECT_NAME
COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-app}

printf "Nome do banco PostgreSQL [${COMPOSE_PROJECT_NAME}_db]: "; read -r DB_NAME
DB_NAME=${DB_NAME:-${COMPOSE_PROJECT_NAME}_db}

printf "Nome de exibição do projeto [$COMPOSE_PROJECT_NAME]: "; read -r PROJECT_NAME
PROJECT_NAME=${PROJECT_NAME:-$COMPOSE_PROJECT_NAME}

INSTALL_DIR="/var/www/$COMPOSE_PROJECT_NAME"
SRC_DIR="$INSTALL_DIR/src"

info "Porta: $APP_PORT"
info "Docker: $COMPOSE_PROJECT_NAME"
info "Banco: $DB_NAME"
info "Pasta: $INSTALL_DIR"

DB_USER=postgres
DB_PASS=wander
APP_DOMAIN=api.projetosdinamicos.com.br
APP_LOCATION=/$COMPOSE_PROJECT_NAME/


# --------------------------------------------------------------
# Diretórios
# --------------------------------------------------------------
info "Criando diretórios..."
mkdir -p "$SRC_DIR" && info "Diretório $SRC_DIR criado"


# --------------------------------------------------------------
# .env  (usado pelo docker-compose)
# --------------------------------------------------------------
info "Criando .env"
cat > "$INSTALL_DIR/.env" <<ENVEOF
PORT=$APP_PORT
DB_HOST=db
DB_PORT=5432
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASS=$DB_PASS
COMPOSE_PROJECT_NAME=$COMPOSE_PROJECT_NAME
PROJECT_NAME=$PROJECT_NAME
APP_DOMAIN=$APP_DOMAIN
APP_LOCATION=$APP_LOCATION
ENVEOF
chmod 600 "$INSTALL_DIR/.env"


# --------------------------------------------------------------
# package.json
# --------------------------------------------------------------
info "Criando package.json"
cat > "$INSTALL_DIR/package.json" <<'JSONEOF'
{
  "name": "api-generica",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js"
  },
  "dependencies": {
    "dotenv": "^16.4.5",
    "express": "^4.21.0",
    "pg": "^8.12.0"
  }
}
JSONEOF


# --------------------------------------------------------------
# src/server.js
# --------------------------------------------------------------
info "Criando src/server.js"
cat > "$SRC_DIR/server.js" <<'SVREOF'
const { Pool } = require('pg');
const express = require('express');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS
});

pool.on('error', (err) => console.error('DB Error:', err));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowedOrigins = [
        'https://www.projetosdinamicos.com.br',
        'https://api.projetosdinamicos.com.br',
        'https://www.crebortoli.com.br',
        'https://crebortoli.com.br'
    ];
    if (origin) {
        const match = allowedOrigins.find(o => origin === o || origin.endsWith('://' + o.split('://')[1]));
        if (match) {
            res.header('Access-Control-Allow-Origin', match);
            res.header('Vary', 'Origin');
        }
    }
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

const autoCreateTable = async (req, res, next) => {
    if (!['POST', 'PUT'].includes(req.method)) return next();
    const table = req.params.tabela || req.params.table || req.body?.table;
    if (!table || !/^[a-z_][a-z0-9_]{0,63}$/.test(table)) return next();
    try {
        const exists = await pool.query(
            "SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename=$1)",
            [table]
        );
        if (exists.rows[0].exists) return next();
        const data = req.method === 'PUT' ? Object.keys(req.body).filter(k => !['id','table','project'].includes(k)) : Object.keys(req.body).filter(k => !['table','project'].includes(k));
        if (!data.length) return next();
        const cols = data.map(k => `"${k}" TEXT`).join(', ');
        const idCol = req.body.id ? '' : ', id SERIAL PRIMARY KEY';
        await pool.query(`CREATE TABLE "${table}" (_id SERIAL PRIMARY KEY${cols ? ', ' + cols : ''})`);
        console.log(`Tabela "${table}" criada automaticamente`);
    } catch (e) {
        console.error('Erro ao criar tabela:', e.message);
    }
    next();
};

app.use(autoCreateTable);

app.get('/', (req, res) => {
    res.json({
        message: 'API Running',
        status: 'OK',
        project: process.env.PROJECT_NAME || 'API',
        timestamp: new Date().toISOString()
    });
});

app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'healthy', database: 'connected', timestamp: new Date().toISOString() });
    } catch (err) {
        res.json({ status: 'unhealthy', database: 'disconnected', error: err.message });
    }
});

app.get('/:tabela', async (req, res) => {
    const { tabela } = req.params;
    if (!/^[a-z_][a-z0-9_]{0,63}$/.test(tabela)) return res.status(400).json({ error: 'Nome invalido' });
    try {
        const exists = await pool.query("SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename=$1)", [tabela]);
        if (!exists.rows[0].exists) return res.json([]);
        const result = await pool.query(`SELECT * FROM "${tabela}" ORDER BY _id DESC LIMIT 500`);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/:tabela', async (req, res) => {
    const { tabela } = req.params;
    if (!/^[a-z_][a-z0-9_]{0,63}$/.test(tabela)) return res.status(400).json({ error: 'Nome invalido' });
    const data = { ...req.body };
    delete data.table;
    const keys = Object.keys(data);
    if (!keys.length) return res.status(400).json({ error: 'Dados obrigatorios' });
    try {
        const cols = keys.map(k => `"${k}"`).join(', ');
        const vals = keys.map((_, i) => `$${i + 1}`).join(', ');
        const result = await pool.query(
            `INSERT INTO "${tabela}" (${cols}) VALUES (${vals}) RETURNING *`,
            keys.map(k => data[k])
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/:tabela/:id', async (req, res) => {
    const { tabela, id } = req.params;
    if (!/^[a-z_][a-z0-9_]{0,63}$/.test(tabela)) return res.status(400).json({ error: 'Nome invalido' });
    const idNum = parseInt(id);
    if (isNaN(idNum)) return res.status(400).json({ error: 'ID invalido' });
    const data = { ...req.body };
    delete data.table;
    delete data.id;
    const keys = Object.keys(data);
    if (!keys.length) return res.status(400).json({ error: 'Dados obrigatorios' });
    try {
        const sets = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
        const result = await pool.query(
            `UPDATE "${tabela}" SET ${sets} WHERE _id = $${keys.length + 1} RETURNING *`,
            [...keys.map(k => data[k]), idNum]
        );
        res.json(result.rows[0] || { error: 'Registro nao encontrado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/:tabela/:id', async (req, res) => {
    const { tabela, id } = req.params;
    if (!/^[a-z_][a-z0-9_]{0,63}$/.test(tabela)) return res.status(400).json({ error: 'Nome invalido' });
    const idNum = parseInt(id);
    if (isNaN(idNum)) return res.status(400).json({ error: 'ID invalido' });
    try {
        await pool.query(`DELETE FROM "${tabela}" WHERE _id = $1`, [idNum]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
SVREOF


# --------------------------------------------------------------
# Dockerfile
# --------------------------------------------------------------
info "Criando Dockerfile"
cat > "$INSTALL_DIR/Dockerfile" <<'DOCKEREOF'
FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY src/ ./src/

EXPOSE 3000

CMD ["node", "src/server.js"]
DOCKEREOF


# --------------------------------------------------------------
# docker-compose.yml
# --------------------------------------------------------------
info "Criando docker-compose.yml"
cat > "$INSTALL_DIR/docker-compose.yml" <<'COMPOSEEOF'
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASS}
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks:
      - app-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 30s

  api:
    build: .
    ports:
      - "127.0.0.1:${PORT}:${PORT}"
    environment:
      PORT: ${PORT}
      DB_HOST: db
      DB_PORT: 5432
      DB_NAME: ${DB_NAME}
      DB_USER: ${DB_USER}
      DB_PASS: ${DB_PASS}
      PROJECT_NAME: ${PROJECT_NAME}
    depends_on:
      db:
        condition: service_healthy
    networks:
      - app-network
    restart: unless-stopped

networks:
  app-network:
    driver: bridge

volumes:
  pgdata:
COMPOSEEOF


# --------------------------------------------------------------
# Nginx
# --------------------------------------------------------------
info "Configurando Nginx"
cp "$NGINX_CONF" "$NGINX_CONF.bkp" 2>/dev/null && info "Backup criado: $NGINX_CONF.bkp" || warn "Falha ao criar backup"

LOC_MARKER_BEGIN="# LOCATION_BEGIN $COMPOSE_PROJECT_NAME"
LOC_MARKER_END="# LOCATION_END $COMPOSE_PROJECT_NAME"

if grep -q "$LOC_MARKER_BEGIN" "$NGINX_CONF" 2>/dev/null; then
    info "Location já existe no nginx — apenas atualizando porta"
    sed -i "s|proxy_pass http://127.0.0.1:[0-9]*/;|proxy_pass http://127.0.0.1:$APP_PORT/;|" "$NGINX_CONF"
else
    cat >> "$NGINX_CONF" <<NGINXEOF

$LOC_MARKER_BEGIN
server {
    listen 80;
    listen [::]:80;
    server_name $APP_DOMAIN;

    location /$COMPOSE_PROJECT_NAME/ {
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

    location /$COMPOSE_PROJECT_NAME/ {
        proxy_pass http://127.0.0.1:$APP_PORT/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    client_max_body_size 15M;
}
$LOC_MARKER_END
NGINXEOF
    info "Location adicionada ao nginx"
fi

if nginx -t 2>/dev/null; then
    systemctl reload nginx.service 2>/dev/null && info "Nginx recarregado" || warn "Falha ao recarregar nginx"
else
    warn "Configuração nginx inválida — verifique manualmente"
fi


# --------------------------------------------------------------
# Docker Compose — build e start
# --------------------------------------------------------------
info "Fazendo build da imagem Docker..."
if $DOCKER_COMPOSE_CMD -f "$INSTALL_DIR/docker-compose.yml" build 2>&1; then
  info "Build concluído com sucesso!"
else
  error "Falha no build da imagem Docker — verifique o Dockerfile e logs acima"
fi

info "Iniciando containers com Docker Compose..."
if $DOCKER_COMPOSE_CMD -f "$INSTALL_DIR/docker-compose.yml" --project-name "$COMPOSE_PROJECT_NAME" up -d 2>&1; then
  info "Containers iniciados!"
else
  error "Falha ao iniciar containers — verifique docker-compose.yml e logs"
fi

info "Aguardando API ficar saudável..."
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:$APP_PORT/health" >/dev/null 2>&1; then
    info "API saudável após ${i}s!"
    break
  fi
  if [ "$i" -eq 30 ]; then
    warn "API não respondeu após 30s — verifique logs: $DOCKER_COMPOSE_CMD logs api"
  fi
  sleep 1
done


# --------------------------------------------------------------
# Final
# --------------------------------------------------------------
echo ""
info "===== Instalação concluída! ====="
echo ""
echo "  URL:     https://$APP_DOMAIN/$COMPOSE_PROJECT_NAME/"
echo "  Porta:   $APP_PORT"
echo "  Docker:  $COMPOSE_PROJECT_NAME"
echo "  Banco:   $DB_NAME"
echo "  Pasta:   $INSTALL_DIR"
echo ""
echo "  Comandos úteis:"
echo "    Logs:     $DOCKER_COMPOSE_CMD -f $INSTALL_DIR/docker-compose.yml logs -f"
echo "    Restart:  $DOCKER_COMPOSE_CMD -f $INSTALL_DIR/docker-compose.yml restart"
echo "    Stop:     $DOCKER_COMPOSE_CMD -f $INSTALL_DIR/docker-compose.yml down"
echo ""

info "Testando API..." && sleep 2
BASE="http://127.0.0.1:$APP_PORT/"
resp=$(curl -s "$BASE" 2>/dev/null) || resp=""
echo "$resp" | grep -q '"OK"' && info "Root:      ✓" || warn "Root:      ✗ $resp"
resp=$(curl -s "${BASE}health" 2>/dev/null) || resp=""
echo "$resp" | grep -q '"healthy"' && info "Health:    ✓" || warn "Health:    ✗ $resp"

TEST_DATA='{"nome":"Teste","descricao":"Registro inicial"}'
resp=$(curl -s -X POST "${BASE}dados" -H "Content-Type: application/json" -d "$TEST_DATA" 2>/dev/null) || resp=""
echo "$resp" | grep -q '"nome"' && info "Create:    ✓" || warn "Create:    ✗ $resp"

if echo "$resp" | grep -q '"_id"'; then
    ID=$(echo "$resp" | sed 's/.*"_id":\([0-9]*\).*/\1/')
    resp=$(curl -s "${BASE}dados" 2>/dev/null) || resp=""
    echo "$resp" | grep -q '"Teste"' && info "Read:      ✓" || warn "Read:      ✗ $resp"
    resp=$(curl -s -X PUT "${BASE}dados/$ID" -H "Content-Type: application/json" -d '{"descricao":"Atualizado"}' 2>/dev/null) || resp=""
    echo "$resp" | grep -q '"Atualizado"' && info "Update:    ✓" || warn "Update:    ✗ $resp"
    resp=$(curl -s -X DELETE "${BASE}dados/$ID" 2>/dev/null) || resp=""
    echo "$resp" | grep -q '"success"' && info "Delete:    ✓" || warn "Delete:    ✗ $resp"
fi

echo ""
echo "  CRUD:    https://$APP_DOMAIN/$COMPOSE_PROJECT_NAME/{tabela}"
echo "  Logs:    $DOCKER_COMPOSE_CMD -f $INSTALL_DIR/docker-compose.yml logs -f"
echo "  .env:    $INSTALL_DIR/.env"
echo ""
