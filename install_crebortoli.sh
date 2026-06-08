#!/bin/sh
set -eu

# ==============================================================
# Script de instalação — API Crebortoli
# Uso: sudo bash install_crebortoli.sh          (instalar)
#       sudo bash install_crebortoli.sh uninstall (desinstalar)
#
# API REST com Fastify + PostgreSQL.
# ==============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
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

# --------------------------------------------------------------
# package.json
# --------------------------------------------------------------
info "Criando package.json"
cat > "$INSTALL_DIR/api/package.json" <<'JSONEOF'
{
  "name": "crebortoli-api",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js",
    "test": "node tests/api.test.js"
  },
  "dependencies": {
    "@fastify/cors": "^9.0.0",
    "@fastify/multipart": "^8.0.0",
    "@fastify/rate-limit": "^9.0.0",
    "@fastify/static": "^7.0.0",
    "dotenv": "^16.4.0",
    "fastify": "^4.28.0",
    "pg": "^8.12.0",
    "undici": "^5.28.4"
  }
}
JSONEOF

# --------------------------------------------------------------
# src/server.js
# --------------------------------------------------------------
info "Criando src/server.js"
cat > "$SRC_DIR/server.js" <<'SVREOF'
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import pg from 'pg';
import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const { Pool } = pg;

const fastify = Fastify({ logger: true });

const logOperations = (operation, details) => {
  const log = {
    timestamp: new Date().toISOString(),
    operation,
    ...details
  };
  fastify.log.info(log);
};

const PROJECTS = {
  crebortoli: {
    host: process.env.CREBORTOLI_DB_HOST,
    port: parseInt(process.env.CREBORTOLI_DB_PORT || '5432'),
    user: process.env.CREBORTOLI_DB_USER,
    password: process.env.CREBORTOLI_DB_PASS,
    database: process.env.CREBORTOLI_DB_NAME,
    root: PROJECT_ROOT,
  },
};

const TABLES = {
  default: [
    { name: 'agendamentos', columns: 'id UUID PRIMARY KEY, cliente TEXT, telefone TEXT, servico TEXT, servico_nome TEXT, valor DECIMAL(10,2), data TIMESTAMP, hora TEXT, status TEXT DEFAULT \'pendente\', pago BOOLEAN DEFAULT false, observacoes TEXT, created_at TIMESTAMP DEFAULT NOW()' },
    { name: 'servicos', columns: 'id UUID PRIMARY KEY, nome TEXT, descricao TEXT, preco DECIMAL(10,2), duracao_minutos INTEGER, ativo BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT NOW()' },
    { name: 'clientes', columns: 'id UUID PRIMARY KEY, nome TEXT, telefone TEXT, email TEXT, cpf TEXT, endereco TEXT, observacoes TEXT, created_at TIMESTAMP DEFAULT NOW()' },
    { name: 'receitas', columns: 'id UUID PRIMARY KEY, paciente TEXT, data TEXT, data_formatada TEXT, indicacao TEXT, medicamentos TEXT, observacoes TEXT, comentarios TEXT, nome_arquivo TEXT, cliente_id UUID, diagnostico TEXT, prescricao TEXT, validado BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT NOW()' },
    { name: 'contatos', columns: 'id UUID PRIMARY KEY, nome TEXT, email TEXT, telefone TEXT, mensagem TEXT, lido BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT NOW()' },
    { name: 'sessoes', columns: 'id UUID PRIMARY KEY, token TEXT UNIQUE, url_aprovacao TEXT, status TEXT DEFAULT \'pendente\', last_sync TIMESTAMP, created_at TIMESTAMP DEFAULT NOW()' },
    { name: 'usuarios', columns: 'id UUID PRIMARY KEY, email TEXT UNIQUE, senha TEXT, nome TEXT, nivel TEXT DEFAULT \'user\', created_at TIMESTAMP DEFAULT NOW()' },
  ]
};

const pools = {};
for (const [name, config] of Object.entries(PROJECTS)) {
  pools[name] = new Pool(config);
}

const API_TOKEN = process.env.API_TOKEN;

if (!API_TOKEN) {
  console.error('ERRO: API_TOKEN nao definido. Defina via variavel de ambiente.');
  process.exit(1);
}

const API_WRITE_KEY = process.env.API_WRITE_KEY || process.env.API_TOKEN;

await fastify.register(cors, { origin: true, methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization', 'X-Write-Key'] });
await fastify.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });
await fastify.register(rateLimit, { max: 100, timeWindow: '1 minute', keyGenerator: (req) => req.ip });

function validateTableName(table) {
  return /^[a-z_][a-z0-9_]{0,63}$/.test(table);
}
function validateId(id) {
  return /^[a-zA-Z0-9_-]{1,128}$/.test(id);
}

async function query(project, sql, params = []) {
  const pool = pools[project];
  if (!pool) throw new Error('Projeto nao encontrado');
  const client = await pool.connect();
  try { return await client.query(sql, params); }
  finally { client.release(); }
}

const authMiddleware = async (req, reply) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || token !== API_TOKEN) {
    reply.code(401).send({ success: false, error: 'Unauthorized' });
    return;
  }
};

const writeAuthMiddleware = async (req, reply) => {
  const writeKey = req.headers['x-write-key'];
  const authToken = req.headers.authorization?.replace('Bearer ', '');

  if (!writeKey && !authToken) {
    reply.code(403).send({ success: false, error: 'Write access denied' });
    return;
  }

  if (writeKey && writeKey !== API_WRITE_KEY) {
    reply.code(403).send({ success: false, error: 'Invalid write key' });
    return;
  }

  if (authToken && authToken !== API_TOKEN) {
    reply.code(403).send({ success: false, error: 'Invalid token' });
    return;
  }
};

fastify.get('/health', async () => {
  const checks = {};
  for (const [name, pool] of Object.entries(pools)) {
    try { await pool.query('SELECT 1'); checks[name] = 'ok'; }
    catch (err) { checks[name] = 'error'; }
  }
  return { status: 'ok', projects: checks, timestamp: new Date().toISOString() };
});

fastify.get('/ping', async () => ({ pong: true }));

fastify.get('/data/:table', async (req, res) => {
  const { table } = req.params;
  if (!['servicos', 'agendamentos', 'clientes', 'contatos', 'receitas', 'sessoes'].includes(table)) {
    return res.code(400).send({ error: 'Tabela invalida' });
  }
  const result = await query('crebortoli', 'SELECT * FROM "' + table + '" ORDER BY created_at DESC LIMIT 100');
  return res.code(200).send(result.rows);
});

fastify.get('/crebortoli/data/:table', async (req, res) => {
  const { table } = req.params;
  if (!['servicos', 'agendamentos', 'clientes', 'contatos', 'receitas', 'sessoes'].includes(table)) {
    return res.code(400).send({ error: 'Tabela invalida' });
  }
  const result = await query('crebortoli', 'SELECT * FROM "' + table + '" ORDER BY created_at DESC LIMIT 100');
  return res.code(200).send(result.rows);
});

fastify.get('/crebortoli/:table', async (req, res) => {
  const { table } = req.params;
  if (!['servicos', 'agendamentos', 'clientes', 'contatos', 'receitas', 'sessoes'].includes(table)) {
    return res.code(400).send({ error: 'Tabela invalida' });
  }
  const result = await query('crebortoli', 'SELECT * FROM "' + table + '" ORDER BY created_at DESC LIMIT 100');
  const rows = result.rows.map(row => {
    if (row.data && typeof row.data === 'string') {
      row.data = row.data.split('T')[0];
    }
    return row;
  });
  return res.code(200).send(rows);
});

fastify.get('/config/:chave', async (req, res) => {
  const { chave } = req.params;
  const result = await query('crebortoli', 'SELECT valor FROM configuracoes WHERE chave = $1', [chave]);
  if (!result.rows.length) {
    return res.code(200).send({ data: null });
  }
  try {
    return res.code(200).send({ data: JSON.parse(result.rows[0].valor) });
  } catch {
    return res.code(200).send({ data: result.rows[0].valor });
  }
});

fastify.post('/api.php', async (req, res) => {
  const { action, ...data } = req.body || {};

  switch (action) {
    case 'criar_sessao': {
      const { token, urlAprovacao } = data;
      await query('crebortoli', "INSERT INTO sessoes (token, url_aprovacao, status, created_at) VALUES ($1, $2, 'aguardando', NOW()) ON CONFLICT (token) DO UPDATE SET url_aprovacao = $2, status = 'aguardando'", [token, urlAprovacao]);
      return { sucesso: true, token };
    }
    case 'verificar_sessao': {
      const { token } = data;
      const result = await query('crebortoli', 'SELECT status FROM sessoes WHERE token = $1', [token]);
      if (!result.rows.length) return { sucesso: false, erro: 'Token nao encontrado' };
      const row = result.rows[0];
      if (row.status === 'aprovado') {
        await query('crebortoli', "UPDATE sessoes SET status = 'usada' WHERE token = $1", [token]);
        return { sucesso: true, aprovado: true };
      }
      return { sucesso: true, aprovado: false };
    }
    case 'sync_timer': {
      const { token } = data;
      await query('crebortoli', 'UPDATE sessoes SET last_sync = NOW() WHERE token = $1', [token]);
      return { sucesso: true };
    }
    case 'login': {
      const { email, senha } = data;
      const result = await query('crebortoli', 'SELECT * FROM usuarios WHERE email = $1 AND senha = $2', [email, senha]);
      if (!result.rows.length) return { sucesso: false, erro: 'Credenciais invalidas' };
      return { sucesso: true, usuario: result.rows[0] };
    }
    default:
      return { erro: 'Acao desconhecida: ' + action };
  }
});

fastify.get('/api/projects', { preHandler: authMiddleware }, async () =>
  Object.keys(PROJECTS).map(name => ({ name, database: PROJECTS[name].database })));

fastify.get('/api/tables/:project', { preHandler: authMiddleware }, async (req) => {
  const { project } = req.params;
  const result = await query(project, "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name");
  return result.rows;
});

fastify.post('/api/project/create', { preHandler: authMiddleware }, async (req, res) => {
  const { name, tables = TABLES.default } = req.body || {};
  if (!name || !/^[a-z_][a-z0-9_]{0,63}$/.test(name)) {
    return res.code(400).send({ error: 'Nome de projeto invalido' });
  }

  const adminPool = new Pool({
    host: process.env.CREBORTOLI_DB_HOST,
    port: parseInt(process.env.CREBORTOLI_DB_PORT || '5432'),
    user: process.env.CREBORTOLI_DB_USER,
    password: process.env.CREBORTOLI_DB_PASS,
    database: 'postgres',
  });

  try {
    await adminPool.query('CREATE DATABASE "' + name + '"');
  } catch (e) {
    if (!e.message.includes('already exists')) throw e;
  }
  finally { await adminPool.end(); }

  const projectPool = new Pool({
    host: process.env.CREBORTOLI_DB_HOST,
    port: parseInt(process.env.CREBORTOLI_DB_PORT || '5432'),
    user: process.env.CREBORTOLI_DB_USER,
    password: process.env.CREBORTOLI_DB_PASS,
    database: name,
  });

  for (const table of tables) {
    try {
      await projectPool.query('CREATE TABLE IF NOT EXISTS "' + table.name + '" (' + table.columns + ')');
    } catch (e) {
      console.error('Erro ao criar tabela ' + table.name + ':', e.message);
    }
  }
  await projectPool.end();

  PROJECTS[name] = {
    host: process.env.CREBORTOLI_DB_HOST,
    port: parseInt(process.env.CREBORTOLI_DB_PORT || '5432'),
    user: process.env.CREBORTOLI_DB_USER,
    password: process.env.CREBORTOLI_DB_PASS,
    database: name,
    root: path.join(__dirname, '..'),
  };
  pools[name] = new Pool(PROJECTS[name]);

  return { success: true, project: name, tables: tables.map(t => t.name) };
});

fastify.post('/api/config/get', { preHandler: authMiddleware }, async (req, res) => {
  const { chave } = req.body || {};
  if (!chave) {
    return res.code(400).send({ error: 'Chave requerida' });
  }
  const result = await query('crebortoli', 'SELECT valor FROM configuracoes WHERE chave = $1', [chave]);
  if (!result.rows.length) {
    return { data: null };
  }
  try {
    return { data: JSON.parse(result.rows[0].valor) };
  } catch {
    return { data: result.rows[0].valor };
  }
});

fastify.post('/api/config/set', { preHandler: authMiddleware }, async (req, res) => {
  const { chave, valor } = req.body || {};
  if (!chave) {
    return res.code(400).send({ error: 'Chave requerida' });
  }
  const valorJson = typeof valor === 'object' ? JSON.stringify(valor) : valor;
  const result = await query('crebortoli', "INSERT INTO configuracoes (id, chave, valor, updated_at) VALUES (gen_random_uuid(), $1, $2, NOW()) ON CONFLICT (chave) DO UPDATE SET valor = $2, updated_at = NOW() RETURNING *", [chave, valorJson]);
  return { success: true, data: result.rows[0] };
});

fastify.post('/api/table/create', { preHandler: authMiddleware }, async (req, res) => {
  const { project, table_name, columns } = req.body || {};
  if (!project || !PROJECTS[project] || !table_name || !columns) {
    return res.code(400).send({ error: 'Invalid request' });
  }
  if (!validateTableName(table_name)) {
    return res.code(400).send({ error: 'Nome de tabela invalido' });
  }

  try {
    await query(project, 'CREATE TABLE IF NOT EXISTS "' + table_name + '" (' + columns + ')');
    return { success: true, table: table_name };
  } catch (e) {
    return res.code(400).send({ error: e.message });
  }
});

fastify.post('/crebortoli/api/read', async (req, res) => {
  const { project = 'crebortoli', table, filters = {}, columns = ['*'], order_by = 'created_at', order_dir = 'DESC', limit = 100, offset = 0 } = req.body || {};
  if (!PROJECTS[project] || !validateTableName(table)) {
    return res.code(400).send({ error: 'Invalid request' });
  }
  const colList = (!columns || (Array.isArray(columns) && columns.length === 1 && columns[0] === '*')) ? '*' : columns.map(c => '"' + c + '"').join(', ');
  if (!validateTableName(order_by)) return res.code(400).send({ error: 'Invalid order_by' });
  const conditions = Object.keys(filters).map((k, i) => {
    if (!validateTableName(k)) return null;
    return Array.isArray(filters[k])
      ? '"' + k + '" IN (' + filters[k].map((_, j) => '$' + (i + j + 1)).join(',') + ')'
      : '"' + k + '" = $' + (i + 1);
  }).filter(Boolean).join(' AND ');
  const params = Object.values(filters).flat();
  const lim = Math.min(parseInt(limit) || 100, 1000);

  const [countRes, dataRes] = await Promise.all([
    query(project, 'SELECT COUNT(*) FROM "' + table + '"' + (conditions ? ' WHERE ' + conditions : ''), params),
    query(project, 'SELECT ' + colList + ' FROM "' + table + '"' + (conditions ? ' WHERE ' + conditions : '') + ' ORDER BY "' + order_by + '" ' + (order_dir.toUpperCase() === 'ASC' ? 'ASC' : 'DESC') + ' LIMIT ' + lim + ' OFFSET ' + offset, params),
  ]);

  return { data: dataRes.rows, pagination: { total: parseInt(countRes.rows[0].count), limit: lim, offset } };
});

fastify.post('/crebortoli/data/create', { preHandler: writeAuthMiddleware }, async (req, res) => {
  const { project = 'crebortoli', table, data } = req.body || {};
  if (!PROJECTS[project] || !validateTableName(table) || !data) {
    return res.code(400).send({ error: 'Invalid request' });
  }
  const sanitized = {};
  for (const [k, v] of Object.entries(data)) {
    if (validateTableName(k)) sanitized[k] = v;
  }
  sanitized.id = sanitized.id || crypto.randomUUID();
  sanitized.created_at = sanitized.created_at || new Date().toISOString();
  const cols = Object.keys(sanitized).map(c => '"' + c + '"').join(', ');
  const vals = Object.keys(sanitized).map((_, i) => '$' + (i + 1)).join(', ');
  const result = await query(project, 'INSERT INTO "' + table + '" (' + cols + ') VALUES (' + vals + ') RETURNING *', Object.values(sanitized));
  return { success: true, data: result.rows[0] };
});

fastify.post('/crebortoli/data/update', { preHandler: writeAuthMiddleware }, async (req, res) => {
  const { project = 'crebortoli', table, id, data } = req.body || {};
  if (!PROJECTS[project] || !validateTableName(table) || !validateId(id) || !data) {
    return res.code(400).send({ error: 'Invalid request' });
  }
  const sanitized = {};
  for (const [k, v] of Object.entries(data)) {
    if (validateTableName(k) && !['id', 'created_at'].includes(k)) sanitized[k] = v;
  }
  if (!Object.keys(sanitized).length) return res.code(400).send({ error: 'No valid fields' });
  sanitized.updated_at = new Date().toISOString();
  const sets = Object.keys(sanitized).map((k, i) => '"' + k + '" = $' + (i + 1)).join(', ');
  const result = await query(project, 'UPDATE "' + table + '" SET ' + sets + ' WHERE id = $' + (Object.keys(sanitized).length + 1) + ' RETURNING *', [...Object.values(sanitized), id]);
  if (!result.rows.length) return res.code(404).send({ error: 'Not found' });
  return { success: true, data: result.rows[0] };
});

fastify.post('/crebortoli/data/delete', { preHandler: writeAuthMiddleware }, async (req, res) => {
  const { project = 'crebortoli', table, id } = req.body || {};
  if (!PROJECTS[project] || !validateTableName(table) || !validateId(id)) {
    return res.code(400).send({ error: 'Invalid request' });
  }
  const result = await query(project, 'DELETE FROM "' + table + '" WHERE id = $1 RETURNING id', [id]);
  if (!result.rows.length) return res.code(404).send({ error: 'Not found' });
  return { success: true, deleted: true, id };
});

fastify.post('/crebortoli/create', { preHandler: writeAuthMiddleware }, async (req, res) => {
  const { project = 'crebortoli', table, data } = req.body || {};
  if (!PROJECTS[project] || !validateTableName(table) || !data) {
    return res.code(400).send({ error: 'Invalid request' });
  }
  const item = {};
  for (const [k, v] of Object.entries(data)) {
    if (validateTableName(k)) item[k] = v;
  }
  item.id = item.id || crypto.randomUUID();
  item.created_at = item.created_at || new Date().toISOString();
  const cols = Object.keys(item).map(c => '"' + c + '"').join(', ');
  const vals = Object.keys(item).map((_, i) => '$' + (i + 1)).join(', ');
  try {
    const result = await query(project, 'INSERT INTO "' + table + '" (' + cols + ') VALUES (' + vals + ') RETURNING *', Object.values(item));
    return { success: true, data: result.rows[0] };
  } catch (e) {
    return res.code(500).send({ error: e.message });
  }
});

fastify.post('/crebortoli/update', { preHandler: writeAuthMiddleware }, async (req, res) => {
  const { project = 'crebortoli', table, id, data } = req.body || {};
  if (!PROJECTS[project] || !validateTableName(table) || !validateId(id) || !data) {
    return res.code(400).send({ error: 'Invalid request' });
  }
  const item = {};
  for (const [k, v] of Object.entries(data)) {
    if (validateTableName(k) && !['id', 'created_at'].includes(k)) item[k] = v;
  }
  if (!Object.keys(item).length) return res.code(400).send({ error: 'No valid fields' });
  item.updated_at = new Date().toISOString();
  const sets = Object.keys(item).map((k, i) => '"' + k + '" = $' + (i + 1)).join(', ');
  try {
    const result = await query(project, 'UPDATE "' + table + '" SET ' + sets + ' WHERE id = $' + (Object.keys(item).length + 1) + ' RETURNING *', [...Object.values(item), id]);
    if (!result.rows.length) return res.code(404).send({ error: 'Not found' });
    return { success: true, data: result.rows[0] };
  } catch (e) {
    return res.code(500).send({ error: e.message });
  }
});

fastify.post('/crebortoli/delete', { preHandler: writeAuthMiddleware }, async (req, res) => {
  const { project = 'crebortoli', table, id } = req.body || {};
  if (!PROJECTS[project] || !validateTableName(table) || !validateId(id)) {
    return res.code(400).send({ error: 'Invalid request' });
  }
  const result = await query(project, 'DELETE FROM "' + table + '" WHERE id = $1 RETURNING id', [id]);
  if (!result.rows.length) return res.code(404).send({ error: 'Not found' });
  return { success: true, deleted: true, id };
});

fastify.post('/api/read', { preHandler: authMiddleware }, async (req, res) => {
  const { project, table, filters = {}, columns = ['*'], order_by = 'created_at', order_dir = 'DESC', limit = 100, offset = 0 } = req.body || {};
  if (!project || !PROJECTS[project] || !validateTableName(table)) {
    return res.code(400).send({ error: 'Invalid request' });
  }
  if (!validateTableName(order_by)) {
    return res.code(400).send({ error: 'Invalid order_by' });
  }
  const colList = (!columns || (Array.isArray(columns) && columns.length === 1 && columns[0] === '*')) ? '*' : columns.map(c => '"' + c + '"').join(', ');
  const conditions = Object.keys(filters).map((k, i) => {
    if (!validateTableName(k)) return null;
    return Array.isArray(filters[k])
      ? '"' + k + '" IN (' + filters[k].map((_, j) => '$' + (i + j + 1)).join(',') + ')'
      : '"' + k + '" = $' + (i + 1);
  }).filter(Boolean).join(' AND ');
  const params = Object.values(filters).flat();
  const lim = Math.min(parseInt(limit) || 100, 1000);

  const [countRes, dataRes] = await Promise.all([
    query(project, 'SELECT COUNT(*) FROM "' + table + '"' + (conditions ? ' WHERE ' + conditions : ''), params),
    query(project, 'SELECT ' + colList + ' FROM "' + table + '"' + (conditions ? ' WHERE ' + conditions : '') + ' ORDER BY "' + order_by + '" ' + (order_dir.toUpperCase() === 'ASC' ? 'ASC' : 'DESC') + ' LIMIT ' + lim + ' OFFSET ' + offset, params),
  ]);

  return { data: dataRes.rows, pagination: { total: parseInt(countRes.rows[0].count), limit: lim, offset } };
});

fastify.post('/api/create', { preHandler: authMiddleware }, async (req, res) => {
  const { project, table, data } = req.body || {};
  logOperations('create', { project, table, data });
  if (!project || !PROJECTS[project] || !validateTableName(table) || !data) {
    return res.code(400).send({ error: 'Invalid request' });
  }
  const sanitized = {};
  for (const [k, v] of Object.entries(data)) {
    if (validateTableName(k)) sanitized[k] = v;
  }
  sanitized.id = sanitized.id || crypto.randomUUID();
  sanitized.created_at = sanitized.created_at || new Date().toISOString();
  const cols = Object.keys(sanitized).map(c => '"' + c + '"').join(', ');
  const vals = Object.keys(sanitized).map((_, i) => '$' + (i + 1)).join(', ');
  const result = await query(project, 'INSERT INTO "' + table + '" (' + cols + ') VALUES (' + vals + ') RETURNING *', Object.values(sanitized));
  return { success: true, data: result.rows[0] };
});

fastify.post('/api/update', { preHandler: authMiddleware }, async (req, res) => {
  const { project, table, id, data } = req.body || {};
  logOperations('update', { project, table, id });
  if (!project || !PROJECTS[project] || !validateTableName(table) || !validateId(id) || !data) {
    return res.code(400).send({ error: 'Invalid request' });
  }
  const sanitized = {};
  for (const [k, v] of Object.entries(data)) {
    if (validateTableName(k) && !['id', 'created_at'].includes(k)) sanitized[k] = v;
  }
  if (!Object.keys(sanitized).length) return res.code(400).send({ error: 'No valid fields' });
  sanitized.updated_at = new Date().toISOString();
  const sets = Object.keys(sanitized).map((k, i) => '"' + k + '" = $' + (i + 1)).join(', ');
  const result = await query(project, 'UPDATE "' + table + '" SET ' + sets + ' WHERE id = $' + (Object.keys(sanitized).length + 1) + ' RETURNING *', [...Object.values(sanitized), id]);
  if (!result.rows.length) return res.code(404).send({ error: 'Not found' });
  return { success: true, data: result.rows[0] };
});

fastify.post('/api/delete', { preHandler: authMiddleware }, async (req, res) => {
  const { project, table, id } = req.body || {};
  logOperations('delete', { project, table, id });
  if (!project || !PROJECTS[project] || !validateTableName(table) || !validateId(id)) {
    return res.code(400).send({ error: 'Invalid request' });
  }
  const result = await query(project, 'DELETE FROM "' + table + '" WHERE id = $1 RETURNING id', [id]);
  if (!result.rows.length) return res.code(404).send({ error: 'Not found' });
  return { success: true, deleted: true, id };
});

fastify.post('/api/upload', { preHandler: authMiddleware }, async (req, res) => {
  const data = await req.file();
  if (!data) return res.code(400).send({ error: 'No file' });

  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
  if (!allowedTypes.includes(data.mimetype)) return res.code(400).send({ error: 'File type not allowed' });

  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'application/pdf': 'pdf' }[data.mimetype];
  const filename = crypto.randomUUID() + '.' + ext;
  const buffer = await data.toBuffer();

  const uploadDir = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
  await fs.promises.mkdir(uploadDir, { recursive: true });
  await fs.promises.writeFile(uploadDir + '/' + filename, buffer);

  return { success: true, filename, url: '/uploads/' + filename, size: buffer.length };
});

fastify.get('/uploads/:name', async (req, res) => {
  const { name } = req.params;
  if (name.includes('..') || name.includes('/')) return res.code(400).send({ error: 'Invalid filename' });
  const filepath = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads', name);
  if (!fs.existsSync(filepath)) return res.code(404).send({ error: 'Not found' });
  return res.send(fs.createReadStream(filepath));
});

const SQL_TOKEN_PREFIX = 'st_';
const SQL_TOKEN_EXPIRY_MS = 30 * 60 * 1000;
const sqlTokenStore = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of sqlTokenStore) {
    if (now - entry.created > SQL_TOKEN_EXPIRY_MS) sqlTokenStore.delete(token);
  }
}, 5 * 60 * 1000);

function sqlTokenize(value) {
  if (value == null || value === '') return value;
  const strVal = String(value);
  for (const [token, entry] of sqlTokenStore) {
    if (entry.value === strVal && Date.now() - entry.created < SQL_TOKEN_EXPIRY_MS) {
      entry.created = Date.now();
      return token;
    }
  }
  const buf = crypto.randomBytes(16);
  const token = SQL_TOKEN_PREFIX + buf.toString('base64url').slice(0, 12);
  sqlTokenStore.set(token, { value: strVal, created: Date.now() });
  return token;
}

function sqlResolve(token) {
  if (!token || typeof token !== 'string' || !token.startsWith(SQL_TOKEN_PREFIX)) return token;
  const entry = sqlTokenStore.get(token);
  if (!entry) return token;
  if (Date.now() - entry.created > SQL_TOKEN_EXPIRY_MS) {
    sqlTokenStore.delete(token);
    return token;
  }
  entry.created = Date.now();
  return entry.value;
}

function sqlSanitizeForLog(sql, params = []) {
  if (!params || !Array.isArray(params)) return sql;
  let s = sql;
  for (let i = 0; i < params.length; i++) {
    const p = params[i];
    const r = typeof p === 'string' ? "'" + p.slice(0, 3) + "..[REDACTED]'" : '[REDACTED]';
    s = s.split('$' + (i + 1)).join(r);
  }
  return s;
}

const EXTERNAL_API = process.env.EXTERNAL_API || 'https://api.projetosdinamicos.com.br/crebortoli';

fastify.post('/api/sql/resolve', { preHandler: authMiddleware }, async (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.code(400).send({ error: 'Token required' });
  return { value: sqlResolve(token) };
});

async function proxyHandler(req, reply) {
  const rawProject = req.query.project || 'crebortoli';
  const rawTable = req.query.table || 'agendamentos';
  const action = req.query.action || 'read';
  const rawId = req.query.id;
  const { limit, offset, order_by, order_dir } = req.query;

  const project = sqlResolve(rawProject);
  const table = sqlResolve(rawTable);
  const id = rawId ? sqlResolve(rawId) : null;

  const body = { project, table: sqlTokenize(table) };
  if (action === 'read') {
    if (limit) body.limit = parseInt(limit);
    if (offset) body.offset = parseInt(offset);
    if (order_by) body.order_by = order_by;
    if (order_dir) body.order_dir = order_dir;
  }
  if (action === 'update' || action === 'delete') body.id = id ? sqlTokenize(id) : null;
  if (req.body && typeof req.body === 'object') {
    const safe = {};
    for (const [k, v] of Object.entries(req.body)) {
      safe[k] = ['table', 'id', 'project'].includes(k) ? sqlTokenize(v) : v;
    }
    Object.assign(body, safe);
  }

  try {
    const res = await fetch(EXTERNAL_API + '/api/' + action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_TOKEN },
      body: JSON.stringify(body),
    });
    return reply.code(res.status).send(await res.json());
  } catch (err) {
    return reply.code(502).send({ error: 'External API unavailable', details: err.message });
  }
}

fastify.all('/api', proxyHandler);
fastify.all('/api/*', proxyHandler);

await fastify.register(fastifyStatic, {
  root: PROJECT_ROOT,
  prefix: '/',
  wildcard: false,
  setHeaders: (res, filePath) => {
    if (filePath.match(/\.html$/)) {
      res.setHeader('X-Robots-Tag', 'noindex');
    }
  },
});

fastify.setNotFoundHandler(async (req, res) => {
  const indexPath = path.join(PROJECT_ROOT, 'index.html');
  if (fs.existsSync(indexPath)) {
    const content = await fs.promises.readFile(indexPath, 'utf-8');
    res.type('text/html').send(content);
  } else {
    res.code(404).send('Not Found');
  }
});

const start = async () => {
  for (const [name, config] of Object.entries(PROJECTS)) {
    const pool = pools[name];
    try {
      for (const table of TABLES.default) {
        await pool.query('CREATE TABLE IF NOT EXISTS "' + table.name + '" (' + table.columns + ')');
        console.log('Tabela "' + table.name + '" verificada/criada em ' + name);
      }

      const agendamentosColumns = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'agendamentos' AND table_schema = 'public'");
      const existingAgendamentosCols = agendamentosColumns.rows.map(r => r.column_name);

      const agendamentosNewCols = [
        { name: 'telefone', sql: 'ALTER TABLE "agendamentos" ADD COLUMN IF NOT EXISTS telefone TEXT' },
        { name: 'servico_nome', sql: 'ALTER TABLE "agendamentos" ADD COLUMN IF NOT EXISTS servico_nome TEXT' },
        { name: 'valor', sql: 'ALTER TABLE "agendamentos" ADD COLUMN IF NOT EXISTS valor DECIMAL(10,2)' },
        { name: 'pago', sql: 'ALTER TABLE "agendamentos" ADD COLUMN IF NOT EXISTS pago BOOLEAN DEFAULT false' },
      ];

      for (const col of agendamentosNewCols) {
        if (!existingAgendamentosCols.includes(col.name)) {
          await pool.query(col.sql);
          console.log('Coluna "' + col.name + '" adicionada a tabela agendamentos em ' + name);
        }
      }

      const receitasColumns = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'receitas' AND table_schema = 'public'");
      const existingReceitasCols = receitasColumns.rows.map(r => r.column_name);

      const receitasNewCols = [
        { name: 'paciente', sql: 'ALTER TABLE "receitas" ADD COLUMN IF NOT EXISTS paciente TEXT' },
        { name: 'data', sql: 'ALTER TABLE "receitas" ADD COLUMN IF NOT EXISTS data TEXT' },
        { name: 'data_formatada', sql: 'ALTER TABLE "receitas" ADD COLUMN IF NOT EXISTS data_formatada TEXT' },
        { name: 'indicacao', sql: 'ALTER TABLE "receitas" ADD COLUMN IF NOT EXISTS indicacao TEXT' },
        { name: 'medicamentos', sql: 'ALTER TABLE "receitas" ADD COLUMN IF NOT EXISTS medicamentos TEXT' },
        { name: 'observacoes', sql: 'ALTER TABLE "receitas" ADD COLUMN IF NOT EXISTS observacoes TEXT' },
        { name: 'comentarios', sql: 'ALTER TABLE "receitas" ADD COLUMN IF NOT EXISTS comentarios TEXT' },
        { name: 'nome_arquivo', sql: 'ALTER TABLE "receitas" ADD COLUMN IF NOT EXISTS nome_arquivo TEXT' },
      ];

      for (const col of receitasNewCols) {
        if (!existingReceitasCols.includes(col.name)) {
          await pool.query(col.sql);
          console.log('Coluna "' + col.name + '" adicionada a tabela receitas em ' + name);
        }
      }
    } catch (e) {
      console.error('Erro ao criar tabelas em ' + name + ':', e.message);
    }
  }
  const PORT = process.env.PORT || 3001;
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
  console.log('Server: http://0.0.0.0:' + PORT);
};
start();
SVREOF
info "src/server.js criado"

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
chmod 600 "$INSTALL_DIR/.env" && info "Permissoes do .env ajustadas (600)" || warn "Falha ao ajustar permissoes"
chown "$PM2_USER" "$INSTALL_DIR/.env" && info "Proprietario do .env definido: $PM2_USER" || warn "Falha ao definir proprietario"

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

    location /.well-known/acme-challenge/ {
        root /var/www;
    }

    location /crebortoli/ {
        proxy_pass http://127.0.0.1:$APP_PORT/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

$LOC_MARKER_BEGIN
    location /$PM2_APP_NAME/ {
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
