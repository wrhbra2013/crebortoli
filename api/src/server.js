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
    root: path.join(__dirname, '..'),
  },
};

const TABLES = {
  default: [
    { name: 'agendamentos', columns: 'id UUID PRIMARY KEY, cliente TEXT, telefone TEXT, servico TEXT, servico_nome TEXT, valor DECIMAL(10,2), data TIMESTAMP, hora TEXT, status TEXT DEFAULT \'pendente\', pago BOOLEAN DEFAULT false, observacoes TEXT, created_at TIMESTAMP DEFAULT NOW()' },
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

if (!API_TOKEN) {
  console.error('ERRO: API_TOKEN não definido. Defina via variável de ambiente.');
  process.exit(1);
}

const API_WRITE_KEY = process.env.API_WRITE_KEY || process.env.API_TOKEN;

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
    if (!origin) {
      cb(null, true);
      return;
    }
    if (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes('*') || isOriginAllowed(origin)) {
      cb(null, true);
    } else {
      cb(new Error('Origin not allowed'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
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

// Rotas GET para dados
fastify.get('/data/:table', async (req, res) => {
  const { table } = req.params;
  if (!['servicos', 'agendamentos', 'clientes', 'contatos', 'receitas'].includes(table)) {
    return res.code(400).send({ error: 'Tabela inválida' });
  }
  const result = await query('crebortoli', `SELECT * FROM "${table}" ORDER BY created_at DESC LIMIT 100`);
  return res.code(200).send(result.rows);
});

fastify.get('/crebortoli/data/:table', async (req, res) => {
  const { table } = req.params;
  if (!['servicos', 'agendamentos', 'clientes', 'contatos', 'receitas'].includes(table)) {
    return res.code(400).send({ error: 'Tabela inválida' });
  }
  const result = await query('crebortoli', `SELECT * FROM "${table}" ORDER BY created_at DESC LIMIT 100`);
  return res.code(200).send(result.rows);
});

fastify.get('/crebortoli/:table', async (req, res) => {
  const { table } = req.params;
  if (!['servicos', 'agendamentos', 'clientes', 'contatos', 'receitas'].includes(table)) {
    return res.code(400).send({ error: 'Tabela inválida' });
  }
  const result = await query('crebortoli', `SELECT * FROM "${table}" ORDER BY created_at DESC LIMIT 100`);
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
  const result = await query('crebortoli', `SELECT valor FROM configuracoes WHERE chave = $1`, [chave]);
  if (!result.rows.length) {
    return res.code(200).send({ data: null });
  }
  try {
    return res.code(200).send({ data: JSON.parse(result.rows[0].valor) });
  } catch {
    return res.code(200).send({ data: result.rows[0].valor });
  }
});

// Rota para compatibilidade com api.php
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
    case 'sync_timer': {
      const { token } = data;
      await query('crebortoli', `UPDATE "sessoes" SET last_sync = NOW() WHERE token = $1`, [token]);
      return { sucesso: true };
    }
    case 'login': {
      const { email, senha } = data;
      const result = await query('crebortoli', `SELECT * FROM "usuarios" WHERE email = $1 AND senha = $2`, [email, senha]);
      if (!result.rows.length) return { sucesso: false, erro: 'Credenciais inválidas' };
      return { sucesso: true, usuario: result.rows[0] };
    }
    default:
      return { erro: 'Ação desconhecida: ' + action };
  }
});

// Rotas protegidas por token
fastify.get('/api/projects', { preHandler: authMiddleware }, async () => 
  Object.keys(PROJECTS).map(name => ({ name, database: PROJECTS[name].database })));

fastify.get('/api/tables/:project', { preHandler: authMiddleware }, async (req) => {
  const { project } = req.params;
  const result = await query(project, `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`);
  return result.rows;
});

fastify.post('/api/project/create', { preHandler: authMiddleware }, async (req, res) => {
  const { name, tables = TABLES.default } = req.body || {};
  if (!name || !/^[a-z_][a-z0-9_]{0,63}$/.test(name)) {
    return res.code(400).send({ error: 'Nome de projeto inválido' });
  }

  const adminPool = new Pool({
    host: process.env.CREBORTOLI_DB_HOST,
    port: parseInt(process.env.CREBORTOLI_DB_PORT || '5432'),
    user: process.env.CREBORTOLI_DB_USER,
    password: process.env.CREBORTOLI_DB_PASS,
    database: 'postgres',
  });

  try {
    await adminPool.query(`CREATE DATABASE "${name}"`);
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
      await projectPool.query(`CREATE TABLE IF NOT EXISTS "${table.name}" (${table.columns})`);
    } catch (e) {
      console.error(`Erro ao criar tabela ${table.name}:`, e.message);
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
  const result = await query('crebortoli', `SELECT valor FROM configuracoes WHERE chave = $1`, [chave]);
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
  const result = await query('crebortoli', `
    INSERT INTO configuracoes (id, chave, valor, updated_at)
    VALUES (gen_random_uuid(), $1, $2, NOW())
    ON CONFLICT (chave) DO UPDATE SET valor = $2, updated_at = NOW()
    RETURNING *
  `, [chave, valorJson]);
  return { success: true, data: result.rows[0] };
});

fastify.post('/api/table/create', { preHandler: authMiddleware }, async (req, res) => {
  const { project, table_name, columns } = req.body || {};
  if (!project || !PROJECTS[project] || !table_name || !columns) {
    return res.code(400).send({ error: 'Invalid request' });
  }
  if (!validateTableName(table_name)) {
    return res.code(400).send({ error: 'Nome de tabela inválido' });
  }

  try {
    await query(project, `CREATE TABLE IF NOT EXISTS "${table_name}" (${columns})`);
    return { success: true, table: table_name };
  } catch (e) {
    return res.code(400).send({ error: e.message });
  }
});

// Rotas /crebortoli/api/* (para o frontend)
fastify.post('/crebortoli/api/read', async (req, res) => {
  const { project = 'crebortoli', table, filters = {}, columns = ['*'], order_by = 'created_at', order_dir = 'DESC', limit = 100, offset = 0 } = req.body || {};
  console.log('[READ]', { project, table, order_by, order_dir, limit });
  if (!PROJECTS[project] || !validateTableName(table)) {
    console.log('[READ] Invalid request', { project: !!PROJECTS[project], table });
    return res.code(400).send({ error: 'Invalid request' });
  }

  const colList = (!columns || (Array.isArray(columns) && columns.length === 1 && columns[0] === '*')) ? '*' : columns.map(c => `"${c}"`).join(', ');
  if (!validateTableName(order_by)) return res.code(400).send({ error: 'Invalid order_by' });
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

  console.log('[READ] Found', dataRes.rows.length, 'rows');
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

  const cols = Object.keys(sanitized).map(c => `"${c}"`).join(', ');
  const vals = Object.keys(sanitized).map((_, i) => `$${i + 1}`).join(', ');
  const result = await query(project, `INSERT INTO "${table}" (${cols}) VALUES (${vals}) RETURNING *`, Object.values(sanitized));
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
  const sets = Object.keys(sanitized).map((k, i) => `"${k}" = $${i + 1}`).join(', ');
  const result = await query(project, `UPDATE "${table}" SET ${sets} WHERE id = $${Object.keys(sanitized).length + 1} RETURNING *`, [...Object.values(sanitized), id]);
  if (!result.rows.length) return res.code(404).send({ error: 'Not found' });
  return { success: true, data: result.rows[0] };
});

fastify.post('/crebortoli/data/delete', { preHandler: writeAuthMiddleware }, async (req, res) => {
  const { project = 'crebortoli', table, id } = req.body || {};
  if (!PROJECTS[project] || !validateTableName(table) || !validateId(id)) {
    return res.code(400).send({ error: 'Invalid request' });
  }

  const result = await query(project, `DELETE FROM "${table}" WHERE id = $1 RETURNING id`, [id]);
  if (!result.rows.length) return res.code(404).send({ error: 'Not found' });
  return { success: true, deleted: true, id };
});

// Atalhos para /crebortoli/create, /crebortoli/update, /crebortoli/delete (usados pelo frontend)
fastify.post('/crebortoli/create', { preHandler: writeAuthMiddleware }, async (req, res) => {
  const { project = 'crebortoli', table, data } = req.body || {};
  console.log('[CREATE]', { project, table, dataKeys: data ? Object.keys(data) : null });
  if (!PROJECTS[project] || !validateTableName(table) || !data) {
    console.log('[CREATE] Invalid request', { project: !!PROJECTS[project], table: validateTableName(table), hasData: !!data });
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
  console.log('[CREATE] SQL: INSERT INTO', table, '(', cols, ')');
  try {
    const result = await query(project, `INSERT INTO "${table}" (${cols}) VALUES (${vals}) RETURNING *`, Object.values(sanitized));
    console.log('[CREATE] OK', result.rows[0]?.id);
    return { success: true, data: result.rows[0] };
  } catch (e) {
    console.log('[CREATE] ERROR', e.message);
    return res.code(500).send({ error: e.message });
  }
});

fastify.post('/crebortoli/update', { preHandler: writeAuthMiddleware }, async (req, res) => {
  const { project = 'crebortoli', table, id, data } = req.body || {};
  console.log('[UPDATE]', { project, table, id, dataKeys: data ? Object.keys(data) : null });
  if (!PROJECTS[project] || !validateTableName(table) || !validateId(id) || !data) {
    console.log('[UPDATE] Invalid request', { project: !!PROJECTS[project], table: validateTableName(table), idValid: validateId(id), hasData: !!data });
    return res.code(400).send({ error: 'Invalid request' });
  }
  const sanitized = {};
  for (const [k, v] of Object.entries(data)) {
    if (validateTableName(k) && !['id', 'created_at'].includes(k)) sanitized[k] = v;
  }
  if (!Object.keys(sanitized).length) return res.code(400).send({ error: 'No valid fields' });
  sanitized.updated_at = new Date().toISOString();
  const sets = Object.keys(sanitized).map((k, i) => `"${k}" = $${i + 1}`).join(', ');
  try {
    const result = await query(project, `UPDATE "${table}" SET ${sets} WHERE id = $${Object.keys(sanitized).length + 1} RETURNING *`, [...Object.values(sanitized), id]);
    if (!result.rows.length) return res.code(404).send({ error: 'Not found' });
    console.log('[UPDATE] OK', id);
    return { success: true, data: result.rows[0] };
  } catch (e) {
    console.log('[UPDATE] ERROR', e.message);
    return res.code(500).send({ error: e.message });
  }
});

fastify.post('/crebortoli/delete', { preHandler: writeAuthMiddleware }, async (req, res) => {
  const { project = 'crebortoli', table, id } = req.body || {};
  if (!PROJECTS[project] || !validateTableName(table) || !validateId(id)) {
    return res.code(400).send({ error: 'Invalid request' });
  }
  const result = await query(project, `DELETE FROM "${table}" WHERE id = $1 RETURNING id`, [id]);
  if (!result.rows.length) return res.code(404).send({ error: 'Not found' });
  return { success: true, deleted: true, id };
});

// Rotas /api/* protegidas
fastify.post('/api/read', { preHandler: authMiddleware }, async (req, res) => {
  const { project, table, filters = {}, columns = ['*'], order_by = 'created_at', order_dir = 'DESC', limit = 100, offset = 0 } = req.body || {};
  if (!project || !PROJECTS[project] || !validateTableName(table)) {
    return res.code(400).send({ error: 'Invalid request' });
  }
  if (!validateTableName(order_by)) {
    return res.code(400).send({ error: 'Invalid order_by' });
  }

  const colList = (!columns || (Array.isArray(columns) && columns.length === 1 && columns[0] === '*')) ? '*' : columns.map(c => `"${c}"`).join(', ');
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

  const cols = Object.keys(sanitized).map(c => `"${c}"`).join(', ');
  const vals = Object.keys(sanitized).map((_, i) => `$${i + 1}`).join(', ');
  const result = await query(project, `INSERT INTO "${table}" (${cols}) VALUES (${vals}) RETURNING *`, Object.values(sanitized));
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
  const sets = Object.keys(sanitized).map((k, i) => `"${k}" = $${i + 1}`).join(', ');
  const result = await query(project, `UPDATE "${table}" SET ${sets} WHERE id = $${Object.keys(sanitized).length + 1} RETURNING *`, [...Object.values(sanitized), id]);
  if (!result.rows.length) return res.code(404).send({ error: 'Not found' });
  return { success: true, data: result.rows[0] };
});

fastify.post('/api/delete', { preHandler: authMiddleware }, async (req, res) => {
  const { project, table, id } = req.body || {};
  logOperations('delete', { project, table, id });
  if (!project || !PROJECTS[project] || !validateTableName(table) || !validateId(id)) {
    return res.code(400).send({ error: 'Invalid request' });
  }
  const result = await query(project, `DELETE FROM "${table}" WHERE id = $1 RETURNING id`, [id]);
  if (!result.rows.length) return res.code(404).send({ error: 'Not found' });
  return { success: true, deleted: true, id };
});

fastify.post('/api/upload', { preHandler: authMiddleware }, async (req, res) => {
  const data = await req.file();
  if (!data) return res.code(400).send({ error: 'No file' });

  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
  if (!allowedTypes.includes(data.mimetype)) return res.code(400).send({ error: 'File type not allowed' });

  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'application/pdf': 'pdf' }[data.mimetype];
  const filename = `${crypto.randomUUID()}.${ext}`;
  const buffer = await data.toBuffer();
  
  const uploadDir = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
  await fs.promises.mkdir(uploadDir, { recursive: true });
  await fs.promises.writeFile(`${uploadDir}/${filename}`, buffer);

  return { success: true, filename, url: `/uploads/${filename}`, size: buffer.length };
});

fastify.get('/uploads/:name', async (req, res) => {
  const { name } = req.params;
  if (name.includes('..') || name.includes('/')) return res.code(400).send({ error: 'Invalid filename' });
  const filepath = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads', name);
  if (!fs.existsSync(filepath)) return res.code(404).send({ error: 'Not found' });
  return res.send(fs.createReadStream(filepath));
});

await fastify.register(fastifyStatic, {
  root: path.join(__dirname, '..'),
  prefix: '/',
  wildcard: false,
});

fastify.setNotFoundHandler(async (req, res) => {
  const indexPath = path.join(__dirname, '..', 'index.html');
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
        await pool.query(`CREATE TABLE IF NOT EXISTS "${table.name}" (${table.columns})`);
        console.log(`Tabela "${table.name}" verificada/criada em ${name}`);
      }

      const columns = await pool.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'agendamentos' AND table_schema = 'public'
      `);
      const existingCols = columns.rows.map(r => r.column_name);

      const newCols = [
        { name: 'telefone', sql: `ALTER TABLE "agendamentos" ADD COLUMN IF NOT EXISTS telefone TEXT` },
        { name: 'servico_nome', sql: `ALTER TABLE "agendamentos" ADD COLUMN IF NOT EXISTS servico_nome TEXT` },
        { name: 'valor', sql: `ALTER TABLE "agendamentos" ADD COLUMN IF NOT EXISTS valor DECIMAL(10,2)` },
        { name: 'pago', sql: `ALTER TABLE "agendamentos" ADD COLUMN IF NOT EXISTS pago BOOLEAN DEFAULT false` },
      ];

      for (const col of newCols) {
        if (!existingCols.includes(col.name)) {
          await pool.query(col.sql);
          console.log(`Coluna "${col.name}" adicionada à tabela agendamentos em ${name}`);
        }
      }
    } catch (e) {
      console.error(`Erro ao criar tabelas em ${name}:`, e.message);
    }
  }
  const PORT = process.env.PORT || 3001;
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`Server: http://0.0.0.0:${PORT}`);
};
start();
