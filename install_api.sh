#!/bin/sh
set -eu

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

if [ -n "${SUDO_USER:-}" ]; then
  PM2_USER="$SUDO_USER"
else
  PM2_USER="root"
fi
PM2_AS_USER=""
[ "$PM2_USER" != "root" ] && PM2_AS_USER="sudo -u $PM2_USER"

uninstall() {
  echo ""
  info "===== Iniciando desinstalação ====="
  echo ""

  . "$INSTALL_DIR/.env" 2>/dev/null || true

  upm2="${PM2_APP_NAME:-app}"
  db_name="${DB_NAME:-app_db}"
  db_user="${DB_USER:-postgres}"
  db_pass="${DB_PASS:-}"
  db_host="${DB_HOST:-localhost}"
  db_port="${DB_PORT:-5432}"

  info "[1/4] Parando e removendo app do PM2 ($upm2)..."
  $PM2_AS_USER pm2 delete "$upm2" 2>/dev/null && info "PM2: app $upm2 removido" || warn "PM2: app $upm2 não encontrado"
  $PM2_AS_USER pm2 save --force 2>/dev/null || true

  info "[2/4] Restaurando nginx..."
  if [ -f "$NGINX_CONF.bkp" ]; then
    cp "$NGINX_CONF.bkp" "$NGINX_CONF" && info "Nginx restaurado" || warn "Falha ao restaurar nginx"
  else
    warn "Backup não encontrado — removendo location manualmente"
    sed -i "/^# LOCATION_BEGIN $upm2\$/,/^# LOCATION_END $upm2\$/d" "$NGINX_CONF" 2>/dev/null || true
  fi
  if nginx -t 2>/dev/null; then
    systemctl reload nginx.service 2>/dev/null && info "Nginx recarregado" || true
  fi

  info "[3/4] Removendo banco de dados ($db_name)..."
  export PGPASSWORD="$db_pass"
  psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" \
    -t -c "SELECT tablename FROM pg_tables WHERE schemaname='public';" 2>/dev/null | while read -r tbl; do
    [ -n "$tbl" ] && psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" \
      -c "DROP TABLE IF EXISTS \"$tbl\" CASCADE;" 2>/dev/null || true
  done
  unset PGPASSWORD
  sudo -u postgres psql -c "DROP DATABASE IF EXISTS \"$db_name\";" 2>/dev/null && info "Banco removido" || warn "Banco não encontrado"

  info "[4/4] Removendo diretório $INSTALL_DIR..."
  rm -rf "$INSTALL_DIR" && info "Diretório removido" || warn "Falha ao remover diretório"

  info "Desinstalação concluída!"
}

case "${1:-}" in
  uninstall) uninstall; exit 0 ;;
esac

trap 'error "Instalação interrompida"' INT TERM

command -v node >/dev/null 2>&1 || error "Node.js não encontrado"
command -v npm  >/dev/null 2>&1 || error "npm não encontrado"
command -v psql >/dev/null 2>&1 || warn "psql não encontrado"
command -v pm2  >/dev/null 2>&1 || warn "pm2 não encontrado"

echo ""
info "===== Instalação de API Genérica ====="
echo ""

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
  printf "Porta do app [3000]: "; read -r APP_PORT
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

printf "Nome do app (usado na URL e PM2) [app]: "; read -r PM2_APP_NAME
PM2_APP_NAME=${PM2_APP_NAME:-app}

printf "Nome do banco PostgreSQL [${PM2_APP_NAME}_db]: "; read -r DB_NAME
DB_NAME=${DB_NAME:-${PM2_APP_NAME}_db}

printf "Nome de exibição do projeto [$PM2_APP_NAME]: "; read -r PROJECT_NAME
PROJECT_NAME=${PROJECT_NAME:-$PM2_APP_NAME}

INSTALL_DIR="/var/www/$PM2_APP_NAME"
SRC_DIR="$INSTALL_DIR/src"

info "Porta: $APP_PORT"
info "PM2:   $PM2_APP_NAME"
info "Banco: $DB_NAME"
info "Pasta: $INSTALL_DIR"

DB_USER=postgres
DB_PASS=wander
DB_HOST=localhost
DB_PORT=5432
APP_DOMAIN=api.projetosdinamicos.com.br
APP_LOCATION=/$PM2_APP_NAME/

info "Criando diretórios..."
mkdir -p "$SRC_DIR" && info "Diretório $SRC_DIR criado"

info "Criando .env"
cat > "$INSTALL_DIR/.env" <<ENVEOF
PORT=$APP_PORT
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASS=$DB_PASS
PM2_APP_NAME=$PM2_APP_NAME
PROJECT_NAME=$PROJECT_NAME
APP_DOMAIN=$APP_DOMAIN
APP_LOCATION=$APP_LOCATION
ENVEOF
chmod 600 "$INSTALL_DIR/.env"

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

info "Configurando Nginx"
cp "$NGINX_CONF" "$NGINX_CONF.bkp" 2>/dev/null && info "Backup criado: $NGINX_CONF.bkp" || warn "Falha ao criar backup"

LOC_MARKER_BEGIN="# LOCATION_BEGIN $PM2_APP_NAME"
LOC_MARKER_END="# LOCATION_END $PM2_APP_NAME"

if grep -q "$LOC_MARKER_BEGIN" "$NGINX_CONF" 2>/dev/null; then
    info "Location ja existe no nginx — apenas atualizando porta"
    sed -i "s|proxy_pass http://127.0.0.1:[0-9]*/;|proxy_pass http://127.0.0.1:$APP_PORT/;|" "$NGINX_CONF"
else
    cat >> "$NGINX_CONF" <<NGINXEOF

$LOC_MARKER_BEGIN
server {
    listen 80;
    listen [::]:80;
    server_name $APP_DOMAIN;

    location /$PM2_APP_NAME/ {
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

    location /$PM2_APP_NAME/ {
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
    warn "Configuracao nginx invalida — verifique manualmente"
fi

info "Criando banco PostgreSQL ($DB_NAME)..."
if command -v sudo >/dev/null 2>&1 && sudo -u postgres psql -c "SELECT 1" >/dev/null 2>&1; then
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>&1 && info "Banco criado" || warn "Banco ja existe"
else
    warn "Crie manualmente: sudo -u postgres createdb $DB_NAME -O $DB_USER"
fi

info "Instalando dependencias npm..."
npm install --prefix "$INSTALL_DIR" --production 2>&1 && info "Dependencias instaladas" || warn "Erro ao instalar dependencias"

info "Registrando app no PM2 ($PM2_USER)..."
$PM2_AS_USER pm2 delete "$PM2_APP_NAME" 2>/dev/null || true
$PM2_AS_USER pm2 start "$SRC_DIR/server.js" --name "$PM2_APP_NAME" 2>&1 && $PM2_AS_USER pm2 save --force 2>&1 && info "PM2: app registrado" || warn "Erro no PM2"

echo ""
info "===== Instalação concluída! ====="
echo ""
echo "  URL:     https://$APP_DOMAIN/$PM2_APP_NAME/"
echo "  Porta:   $APP_PORT"
echo "  PM2:     $PM2_APP_NAME"
echo "  Banco:   $DB_NAME"
echo "  Pasta:   $INSTALL_DIR"
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
echo "  CRUD:    https://$APP_DOMAIN/$PM2_APP_NAME/{tabela}"
echo "  PM2:     pm2 {status|logs|restart} $PM2_APP_NAME"
echo "  .env:    $INSTALL_DIR/.env"
echo ""
