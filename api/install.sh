#!/bin/bash

# Script de instalação da API Fastify na VM
# Execute na VM: bash install.sh

echo "=== Instalando API Fastify ==="

# Diretório da API no servidor
CREBORTOLI_DIR="/var/www/crebortoli"
API_DIR="$CREBORTOLI_DIR/api"

# Criar diretórios se não existirem
echo "Criando diretórios..."
mkdir -p "$CREBORTOLI_DIR"
mkdir -p "$API_DIR"

# Criar package.json se não existir
if [ ! -f "$API_DIR/package.json" ]; then
    echo "Criando package.json..."
    cat > "$API_DIR/package.json" << 'EOF'
{
  "name": "crebortoli-api",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js"
  },
  "dependencies": {
    "fastify": "^4.28.0",
    "@fastify/static": "^7.0.0",
    "@fastify/cors": "^9.0.0",
    "@fastify/multipart": "^8.0.0",
    "@fastify/rate-limit": "^9.0.0",
    "pg": "^8.12.0",
    "dotenv": "^16.4.0"
  }
}
EOF
fi

# Criar src se não existir
mkdir -p "$API_DIR/src"

# Criar server.js se não existir
if [ ! -f "$API_DIR/src/server.js" ]; then
    echo "Criando server.js..."
    cat > "$API_DIR/src/server.js" << 'SERVEREOF'
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

const PORT = process.env.PORT || 3001;

const fastify = Fastify({ logger: true });

const PROJECTS = {
  crebortoli: {
    host: process.env.CREBORTOLI_DB_HOST,
    port: parseInt(process.env.CREBORTOLI_DB_PORT || '5432'),
    user: process.env.CREBORTOLI_DB_USER,
    password: process.env.CREBORTOLI_DB_PASS,
    database: process.env.CREBORTOLI_DB_NAME,
    root: path.join(__dirname, '..'),
  },
};

const TABLES = {
  default: [
    { name: 'agendamentos', columns: 'id UUID PRIMARY KEY, cliente TEXT, servico TEXT, data TIMESTAMP, hora TEXT, status TEXT DEFAULT \'pendente\', observacoes TEXT, created_at TIMESTAMP DEFAULT NOW()' },
    { name: 'servicos', columns: 'id UUID PRIMARY KEY, nome TEXT, descricao TEXT, preco DECIMAL(10,2), duracao_minutos INTEGER, ativo BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT NOW()' },
    { name: 'clientes', columns: 'id UUID PRIMARY KEY, nome TEXT, telefone TEXT, email TEXT, cpf TEXT, endereco TEXT, observacoes TEXT, created_at TIMESTAMP DEFAULT NOW()' },
    { name: 'receitas', columns: 'id UUID PRIMARY KEY, cliente_id UUID, diagnostico TEXT, prescricao TEXT, validado BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT NOW()' },
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

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const isOriginAllowed = (origin) => {
  if (!ALLOWED_ORIGINS.length) return false;
  if (ALLOWED_ORIGINS.includes('*')) return true;
  return ALLOWED_ORIGINS.includes(origin);
};

await fastify.register(cors, { 
  origin: (origin, cb) => {
    if (!origin) { cb(null, true); return; }
    if (isOriginAllowed(origin)) { cb(null, true); }
    else { cb(new Error('Origin not allowed'), false); }
  },
  credentials: true 
});

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
  if (!pool) throw new Error('Projeto não encontrado');
  const client = await pool.connect();
  try { return await client.query(sql, params); }
  finally { client.release(); }
}

const authMiddleware = async (req, reply) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || token !== API_TOKEN) {
    reply.code(401).send({ success: false, error: 'Unauthorized' });
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

fastify.post('/api.php', async (req, res) => {
  const { action, ...data } = req.body || {};
  
  switch (action) {
    case 'criar_sessao': {
      const { token, urlAprovacao } = data;
      await query('crebortoli', `INSERT INTO "sessoes" (token, url_aprovacao, status, created_at) VALUES ($1, $2, 'aguardando', NOW()) ON CONFLICT (token) DO UPDATE SET url_aprovacao = $2, status = 'aguardando'`, [token, urlAprovacao]);
      return { sucesso: true, token };
    }
    case 'verificar_sessao': {
      const { token } = data;
      const result = await query('crebortoli', `SELECT status FROM "sessoes" WHERE token = $1`, [token]);
      if (!result.rows.length) return { sucesso: false, erro: 'Token não encontrado' };
      const row = result.rows[0];
      if (row.status === 'aprovado') {
        await query('crebortoli', `UPDATE "sessoes" SET status = 'usada' WHERE token = $1`, [token]);
        return { sucesso: true, aprovado: true };
      }
      return { sucesso: true, aprovado: false };
    }
    default:
      return { erro: 'Ação desconhecida: ' + action };
  }
});

fastify.get('/api/projects', { preHandler: authMiddleware }, async () => 
  Object.keys(PROJECTS).map(name => ({ name, database: PROJECTS[name].database })));

fastify.get('/api/tables/:project', { preHandler: authMiddleware }, async (req) => {
  const { project } = req.params;
  if (!PROJECTS[project]) return { error: 'Projeto não encontrado' };
  return { tables: TABLES.default.map(t => t.name) };
});

fastify.post('/api/project/create', { preHandler: authMiddleware }, async (req, res) => {
  const { project, tables = [] } = req.body || {};
  if (!project) return res.code(400).send({ error: 'Nome do projeto é obrigatório' });
  if (PROJECTS[project]) return res.code(400).send({ error: 'Projeto já existe' });
  return { success: true, message: 'Projeto criado', project };
});

fastify.post('/api/config/get', { preHandler: authMiddleware }, async (req, res) => {
  const { key } = req.body || {};
  return { success: true, data: process.env[key] || null };
});

fastify.post('/api/config/set', { preHandler: authMiddleware }, async (req, res) => {
  const { key, value } = req.body || {};
  process.env[key] = value;
  return { success: true };
});

fastify.post('/api/table/create', { preHandler: authMiddleware }, async (req, res) => {
  const { project, table_name, columns } = req.body || {};
  if (!project || !PROJECTS[project] || !validateTableName(table_name)) {
    return res.code(400).send({ error: 'Invalid request' });
  }
  try {
    await query(project, `CREATE TABLE IF NOT EXISTS "${table_name}" (${columns})`);
    return { success: true, table: table_name };
  } catch (e) {
    return res.code(400).send({ error: e.message });
  }
});

fastify.post('/api/read', { preHandler: authMiddleware }, async (req, res) => {
  const { project, table, filters = {}, columns = ['*'], order_by = 'created_at', order_dir = 'DESC', limit = 100, offset = 0 } = req.body || {};
  if (!project || !PROJECTS[project] || !validateTableName(table)) {
    return res.code(400).send({ error: 'Invalid request' });
  }

  const colList = columns === ['*'] ? '*' : columns.map(c => `"${c}"`).join(', ');
  const conditions = Object.keys(filters).map((k, i) => {
    if (!validateTableName(k)) return null;
    return Array.isArray(filters[k]) 
      ? `"${k}" IN (${filters[k].map((_, j) => `$${i + j + 1}`).join(',')})` 
      : `"${k}" = $${i + 1}`;
  }).filter(Boolean).join(' AND ');
  const params = Object.values(filters).flat();
  const lim = Math.min(parseInt(limit) || 100, 1000);

  const [countRes, dataRes] = await Promise.all([
    query(project, `SELECT COUNT(*) FROM "${table}" ${conditions ? 'WHERE ' + conditions : ''}`, params),
    query(project, `SELECT ${colList} FROM "${table}" ${conditions ? 'WHERE ' + conditions : ''} ORDER BY "${order_by}" ${order_dir.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'} LIMIT ${lim} OFFSET ${offset}`, params),
  ]);

  return { data: dataRes.rows, pagination: { total: parseInt(countRes.rows[0].count), limit: lim, offset } };
});

fastify.post('/api/create', { preHandler: authMiddleware }, async (req, res) => {
  const { project, table, data } = req.body || {};
  if (!project || !PROJECTS[project] || !validateTableName(table) || !data) {
    return res.code(400).send({ error: 'Invalid request' });
  }

  const sanitized = {};
  for (const [k, v] of Object.entries(data)) {
    if (validateTableName(k)) sanitized[k] = v;
  }
  sanitized.id = sanitized.id || crypto.randomUUID();
  sanitized.created_at = sanitized.created_at || new Date().toISOString();

  const cols = Object.keys(sanitized).map(c => `"${c}"`).join(', ');
  const vals = Object.keys(sanitized).map((_, i) => `$${i + 1}`).join(', ');
  const result = await query(project, `INSERT INTO "${table}" (${cols}) VALUES (${vals}) RETURNING *`, Object.values(sanitized));
  return { success: true, data: result.rows[0] };
});

fastify.post('/api/update', { preHandler: authMiddleware }, async (req, res) => {
  const { project, table, id, data } = req.body || {};
  if (!project || !PROJECTS[project] || !validateTableName(table) || !validateId(id) || !data) {
    return res.code(400).send({ error: 'Invalid request' });
  }

  const sanitized = {};
  for (const [k, v] of Object.entries(data)) {
    if (validateTableName(k)) sanitized[k] = v;
  }
  sanitized.updated_at = new Date().toISOString();

  const sets = Object.keys(sanitized).map((k, i) => `"${k}" = $${i + 1}`).join(', ');
  const result = await query(project, `UPDATE "${table}" SET ${sets} WHERE id = $${Object.keys(sanitized).length + 1} RETURNING *`, [...Object.values(sanitized), id]);

  if (result.rows.length === 0) {
    return res.code(404).send({ error: 'Registro não encontrado' });
  }
  return { success: true, data: result.rows[0] };
});

fastify.post('/api/delete', { preHandler: authMiddleware }, async (req, res) => {
  const { project, table, id } = req.body || {};
  if (!project || !PROJECTS[project] || !validateTableName(table) || !validateId(id)) {
    return res.code(400).send({ error: 'Invalid request' });
  }

  await query(project, `DELETE FROM "${table}" WHERE id = $1`, [id]);
  return { success: true };
});

fastify.post('/api/upload', { preHandler: authMiddleware }, async (req, res) => {
  return { success: true, message: 'Upload endpoint - implementar se necessário' };
});

const start = async () => {
  for (const [name, pool] of Object.entries(pools)) {
    try {
      await pool.query('SELECT 1');
      console.log(`Banco ${name} conectado`);
      for (const table of TABLES.default) {
        await pool.query(`CREATE TABLE IF NOT EXISTS "${table.name}" (${table.columns})`);
        console.log(`Tabela "${table.name}" verificada/criada em ${name}`);
      }
    } catch (e) {
      console.error(`Erro ao conectar/criar tabelas em ${name}:`, e.message);
    }
  }
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`Server: http://0.0.0.0:${PORT}`);
};
start();
SERVEREOF
fi

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
