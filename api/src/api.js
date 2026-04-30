import Fastify from 'fastify';
import cors from '@fastify/cors';
import pg from 'pg';
import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

const fastify = Fastify({ logger: true });

// Configuração do banco de dados
const dbConfig = {
  host: process.env.CREBORTOLI_DB_HOST || 'localhost',
  port: parseInt(process.env.CREBORTOLI_DB_PORT || '5432'),
  user: process.env.CREBORTOLI_DB_USER || 'postgres',
  password: process.env.CREBORTOLI_DB_PASS || 'wander',
  database: process.env.CREBORTOLI_DB_NAME || 'crebortoli_db',
};

const pool = new Pool(dbConfig);

// CORS - aceitar todas as origens (GitHub Pages e domínio)
await fastify.register(cors, {
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
});

// Função auxiliar para queries
async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

// Health check
fastify.get('/health', async () => {
  try {
    await pool.query('SELECT 1');
    return { status: 'ok', timestamp: new Date().toISOString() };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
});

// Ping
fastify.get('/ping', async () => ({ pong: true }));

// Rota GET para listar dados da tabela (usado pelo storage.js)
fastify.get('/crebortoli/data/:table', async (req, res) => {
  const { table } = req.params;
  
  const tabelasPermitidas = ['agendamentos', 'servicos', 'clientes', 'contatos', 'receitas', 'sessoes', 'usuarios'];
  if (!tabelasPermitidas.includes(table)) {
    return res.code(400).send({ error: 'Tabela inválida' });
  }
  
  try {
    const result = await query(`SELECT * FROM "${table}" ORDER BY created_at DESC LIMIT 100`);
    return res.code(200).send(result.rows);
  } catch (err) {
    fastify.log.error(err);
    return res.code(500).send({ error: 'Erro interno', details: err.message });
  }
});

// Rota POST para criar dados (usado pelo storage.js - data/create)
fastify.post('/crebortoli/data/create', async (req, res) => {
  const { table, data } = req.body || {};
  
  if (!table || !data) {
    return res.code(400).send({ error: 'Invalid request: table e data são obrigatórios' });
  }
  
  const tabelasPermitidas = ['agendamentos', 'servicos', 'clientes', 'contatos', 'receitas'];
  if (!tabelasPermitidas.includes(table)) {
    return res.code(400).send({ error: 'Tabela inválida' });
  }
  
  try {
    // Sanitizar dados - apenas campos válidos
    const sanitized = {};
    for (const [k, v] of Object.entries(data)) {
      // Aceitar apenas campos alfanuméricos e underscore
      if (/^[a-z0-9_]+$/.test(k)) {
        sanitized[k] = v;
      }
    }
    
    // Garantir ID e created_at
    sanitized.id = sanitized.id || crypto.randomUUID();
    sanitized.created_at = sanitized.created_at || new Date().toISOString();
    
    // Construir query
    const cols = Object.keys(sanitized).map(c => `"${c}"`).join(', ');
    const vals = Object.keys(sanitized).map((_, i) => `$${i + 1}`).join(', ');
    const result = await query(
      `INSERT INTO "${table}" (${cols}) VALUES (${vals}) RETURNING *`,
      Object.values(sanitized)
    );
    
    return { success: true, data: result.rows[0] };
  } catch (err) {
    fastify.log.error(err);
    return res.code(500).send({ error: 'Erro ao criar registro', details: err.message });
  }
});

// Rota POST para atualizar dados (usado pelo storage.js - data/update)
fastify.post('/crebortoli/data/update', async (req, res) => {
  const { table, id, data } = req.body || {};
  
  if (!table || !id || !data) {
    return res.code(400).send({ error: 'Invalid request: table, id e data são obrigatórios' });
  }
  
  const tabelasPermitidas = ['agendamentos', 'servicos', 'clientes', 'contatos', 'receitas'];
  if (!tabelasPermitidas.includes(table)) {
    return res.code(400).send({ error: 'Tabela inválida' });
  }
  
  try {
    const sanitized = {};
    for (const [k, v] of Object.entries(data)) {
      if (/^[a-z0-9_]+$/.test(k) && !['id', 'created_at'].includes(k)) {
        sanitized[k] = v;
      }
    }
    
    if (!Object.keys(sanitized).length) {
      return res.code(400).send({ error: 'No valid fields' });
    }
    
    sanitized.updated_at = new Date().toISOString();
    
    const sets = Object.keys(sanitized).map((k, i) => `"${k}" = $${i + 1}`).join(', ');
    const result = await query(
      `UPDATE "${table}" SET ${sets} WHERE id = $${Object.keys(sanitized).length + 1} RETURNING *`,
      [...Object.values(sanitized), id]
    );
    
    if (!result.rows.length) {
      return res.code(404).send({ error: 'Not found' });
    }
    
    return { success: true, data: result.rows[0] };
  } catch (err) {
    fastify.log.error(err);
    return res.code(500).send({ error: 'Erro ao atualizar registro', details: err.message });
  }
});

// Rota POST para deletar dados (usado pelo storage.js - data/delete)
fastify.post('/crebortoli/data/delete', async (req, res) => {
  const { table, id } = req.body || {};
  
  if (!table || !id) {
    return res.code(400).send({ error: 'Invalid request: table e id são obrigatórios' });
  }
  
  const tabelasPermitidas = ['agendamentos', 'servicos', 'clientes', 'contatos', 'receitas'];
  if (!tabelasPermitidas.includes(table)) {
    return res.code(400).send({ error: 'Tabela inválida' });
  }
  
  try {
    const result = await query(
      `DELETE FROM "${table}" WHERE id = $1 RETURNING id`,
      [id]
    );
    
    if (!result.rows.length) {
      return res.code(404).send({ error: 'Not found' });
    }
    
    return { success: true, deleted: true, id };
  } catch (err) {
    fastify.log.error(err);
    return res.code(500).send({ error: 'Erro ao deletar registro', details: err.message });
  }
});

// Rota GET para ler dados via POST (compatibilidade com api-client.js)
fastify.post('/crebortoli/api/read', async (req, res) => {
  const { table, filters = {}, columns = ['*'], order_by = 'created_at', order_dir = 'DESC', limit = 100, offset = 0 } = req.body || {};
  
  if (!table) {
    return res.code(400).send({ error: 'Invalid request: table é obrigatório' });
  }
  
  const tabelasPermitidas = ['agendamentos', 'servicos', 'clientes', 'contatos', 'receitas'];
  if (!tabelasPermitidas.includes(table)) {
    return res.code(400).send({ error: 'Tabela inválida' });
  }
  
  try {
    const colList = (!columns || columns === ['*'] || (Array.isArray(columns) && columns.length === 1 && columns[0] === '*')) 
      ? '*' 
      : columns.map(c => `"${c}"`).join(', ');
    
    let queryText = `SELECT ${colList} FROM "${table}"`;
    const params = [];
    let paramCount = 0;
    
    // Processar filtros
    const conditions = Object.keys(filters).map((k, i) => {
      if (!/^[a-z0-9_]+$/.test(k)) return null;
      
      if (Array.isArray(filters[k])) {
        paramCount++;
        return `"${k}" IN (${filters[k].map(() => `$${paramCount++}`).join(', ')})`;
      } else {
        paramCount++;
        return `"${k}" = $${paramCount}`;
      }
    }).filter(Boolean);
    
    if (conditions.length > 0) {
      queryText += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    queryText += ` ORDER BY "${order_by}" ${order_dir.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'}`;
    queryText += ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    
    params.push(...Object.values(filters).flat(), Math.min(parseInt(limit) || 100, 1000), offset || 0);
    
    const result = await query(queryText, params);
    return { data: result.rows };
  } catch (err) {
    fastify.log.error(err);
    return res.code(500).send({ error: 'Erro ao ler dados', details: err.message });
  }
});

// Rota POST para criar dados via POST (compatibilidade com api-client.js)
fastify.post('/crebortoli/api/create', async (req, res) => {
  const { table, data } = req.body || {};
  
  if (!table || !data) {
    return res.code(400).send({ error: 'Invalid request' });
  }
  
  const tabelasPermitidas = ['agendamentos', 'servicos', 'clientes', 'contatos', 'receitas'];
  if (!tabelasPermitidas.includes(table)) {
    return res.code(400).send({ error: 'Tabela inválida' });
  }
  
  try {
    const sanitized = {};
    for (const [k, v] of Object.entries(data)) {
      if (/^[a-z0-9_]+$/.test(k)) {
        sanitized[k] = v;
      }
    }
    
    sanitized.id = sanitized.id || crypto.randomUUID();
    sanitized.created_at = sanitized.created_at || new Date().toISOString();
    
    const cols = Object.keys(sanitized).map(c => `"${c}"`).join(', ');
    const vals = Object.keys(sanitized).map((_, i) => `$${i + 1}`).join(', ');
    const result = await query(
      `INSERT INTO "${table}" (${cols}) VALUES (${vals}) RETURNING *`,
      Object.values(sanitized)
    );
    
    return { success: true, data: result.rows[0] };
  } catch (err) {
    fastify.log.error(err);
    return res.code(500).send({ error: 'Erro ao criar', details: err.message });
  }
});

// Inicializar tabelas se não existirem
const start = async () => {
  const tables = [
    { name: 'agendamentos', columns: 'id UUID PRIMARY KEY, cliente TEXT, servico TEXT, data TIMESTAMP, hora TEXT, status TEXT DEFAULT \'pendente\', observacoes TEXT, created_at TIMESTAMP DEFAULT NOW()' },
    { name: 'servicos', columns: 'id UUID PRIMARY KEY, nome TEXT, descricao TEXT, preco DECIMAL(10,2), duracao_minutos INTEGER, ativo BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT NOW()' },
    { name: 'clientes', columns: 'id UUID PRIMARY KEY, nome TEXT, telefone TEXT, email TEXT, cpf TEXT, endereco TEXT, observacoes TEXT, created_at TIMESTAMP DEFAULT NOW()' },
    { name: 'receitas', columns: 'id UUID PRIMARY KEY, cliente_id UUID, diagnostico TEXT, prescricao TEXT, validado BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT NOW()' },
    { name: 'contatos', columns: 'id UUID PRIMARY KEY, nome TEXT, email TEXT, telefone TEXT, mensagem TEXT, lido BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT NOW()' },
  ];
  
  for (const table of tables) {
    try {
      await query(`CREATE TABLE IF NOT EXISTS "${table.name}" (${table.columns})`);
      fastify.log.info(`Tabela "${table.name}" verificada/criada`);
    } catch (e) {
      fastify.log.error(`Erro ao criar tabela ${table.name}:`, e.message);
    }
  }
  
  const PORT = process.env.PORT || 3001;
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
  fastify.log.info(`Server rodando em http://0.0.0.0:${PORT}`);
};

start();
