#!/bin/bash

set -e

echo "=============================================="
echo "  Setup VM Debian: Node.js + PostgreSQL + Nginx + PM2"
echo "=============================================="

echo ""
echo "--- INSTALAÇÃO BASE ---"

echo "1. Atualizando pacotes..."
sudo apt update && sudo apt upgrade -y

echo "2. Instalando Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

echo "3. Instalando PostgreSQL..."
sudo apt install -y postgresql postgresql-contrib

echo "4. Instalando Nginx e PM2..."
sudo apt install -y nginx
sudo npm install -g pm2

echo "5. Verificando instalações..."
node -v
nginx -v
psql --version
pm2 --version

echo ""
echo "=============================================="
echo "  CONFIGURAÇÃO DO PROJETO"
echo "=============================================="

read -p "Nome do projeto (ex: meu-site): " PROJECT_NAME
read -p "Domínio (ex: api.meusite.com ou vazio para localhost): " DOMAIN

PROJECT_DIR="/var/www/$PROJECT_NAME"

read -p "Nome do banco de dados [${PROJECT_NAME}_db]: " DB_NAME
DB_NAME="${DB_NAME:-${PROJECT_NAME}_db}"

read -p "Usuário do banco [${PROJECT_NAME}_user]: " DB_USER
DB_USER="${DB_USER:-${PROJECT_NAME}_user}"

read -p "Senha do banco: " DB_PASS

echo ""
echo "=============================================="
echo "  CONFIGURANDO POSTGRESQL"
echo "=============================================="

sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || echo "Usuário já existe"
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || echo "Banco já existe"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

echo ""
echo "=============================================="
echo "  CRIANDO PROJETO"
echo "=============================================="

sudo mkdir -p "$PROJECT_DIR"
sudo mkdir -p "$PROJECT_DIR/src"

sudo tee "$PROJECT_DIR/package.json" > /dev/null <<EOF
{
  "name": "$PROJECT_NAME",
  "version": "1.0.0",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "node src/server.js"
  },
  "dependencies": {
    "express": "^4.18.0",
    "dotenv": "^16.0.0",
    "pg": "^8.11.0",
    "cors": "^2.8.5"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF

sudo tee "$PROJECT_DIR/.env" > /dev/null <<EOF
PORT=3000
NODE_ENV=production

DB_HOST=localhost
DB_PORT=5432
DB_NAME=$DB_NAME
DB_USER=$DB_USER
PASSWORD=$DB_PASS
EOF

sudo tee "$PROJECT_DIR/src/server.js" > /dev/null <<'SERVEREOF'
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.PASSWORD
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.json({ 
        message: 'API Running', 
        status: 'OK',
        project: process.env.npm_package_name || 'api',
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

app.post('/api/tables', async (req, res) => {
    const { tableName, columns } = req.body;
    
    if (!tableName || !columns || !Array.isArray(columns)) {
        return res.status(400).json({ error: 'tableName e columns (array) são obrigatórios' });
    }

    try {
        const columnDefs = columns.map(col => {
            if (typeof col === 'string') return `"${col}" TEXT`;
            return `"${col.name}" ${col.type || 'TEXT'}${col.primary ? ' PRIMARY KEY' : ''}${col.notnull ? ' NOT NULL' : ''}`;
        }).join(', ');

        await pool.query(`CREATE TABLE IF NOT EXISTS "${tableName}" (${columnDefs});`);
        res.json({ success: true, message: `Tabela "${tableName}" criada com sucesso` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/tables/:tableName', async (req, res) => {
    const { tableName } = req.params;
    try {
        await pool.query(`DROP TABLE IF EXISTS "${tableName}";`);
        res.json({ success: true, message: `Tabela "${tableName}" excluída` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/tables', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        `);
        res.json({ tables: result.rows.map(r => r.table_name) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/tables/:tableName', async (req, res) => {
    const { tableName } = req.params;
    try {
        const result = await pool.query(`SELECT * FROM "${tableName}" LIMIT 100;`);
        res.json({ table: tableName, data: result.rows, columns: result.fields.map(f => f.name) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/tables/:tableName', async (req, res) => {
    const { tableName } = req.params;
    const data = req.body;
    
    try {
        const keys = Object.keys(data).map(k => `"${k}"`).join(', ');
        const values = Object.keys(data).map((_, i) => `$${i + 1}`).join(', ');
        const result = await pool.query(
            `INSERT INTO "${tableName}" (${keys}) VALUES (${values}) RETURNING *;`,
            Object.values(data)
        );
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/tables/:tableName/:id', async (req, res) => {
    const { tableName, id } = req.params;
    const data = req.body;
    
    try {
        const keys = Object.keys(data).map((k, i) => `"${k}" = $${i + 1}`).join(', ');
        const result = await pool.query(
            `UPDATE "${tableName}" SET ${keys} WHERE id = $${Object.keys(data).length + 1} RETURNING *;`,
            [...Object.values(data), id]
        );
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/tables/:tableName/:id', async (req, res) => {
    const { tableName, id } = req.params;
    try {
        await pool.query(`DELETE FROM "${tableName}" WHERE id = $1;`, [id]);
        res.json({ success: true, message: 'Registro excluído' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
SERVEREOF

cd "$PROJECT_DIR"
sudo npm install

echo ""
echo "=============================================="
echo "  CONFIGURANDO PM2"
echo "=============================================="

sudo pm2 delete "$PROJECT_NAME" 2>/dev/null || true
sudo pm2 start "$PROJECT_DIR/src/server.js" --name "$PROJECT_NAME"
sudo pm2 save
sudo pm2 startup | tail -1 | sudo bash

echo ""
echo "=============================================="
echo "  CONFIGURANDO NGINX"
echo "=============================================="

NGINX_CONF="/etc/nginx/sites-available/$PROJECT_NAME"

if [ -n "$DOMAIN" ]; then
    sudo tee "$NGINX_CONF" > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
else
    sudo tee "$NGINX_CONF" > /dev/null <<EOF
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
fi

sudo ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "=============================================="
echo "  RESUMO"
echo "=============================================="
echo ""
echo "Projeto: $PROJECT_NAME"
echo "Diretório: $PROJECT_DIR"
echo "Banco: $DB_NAME (usuário: $DB_USER)"
echo "API: http://localhost:3000"
if [ -n "$DOMAIN" ]; then
    echo "Domínio: $DOMAIN"
fi
echo ""
echo "--- Endpoints ---"
echo "GET  /              - Status da API"
echo "GET  /health        - Health check"
echo "GET  /api/tables    - Listar tabelas"
echo "POST /api/tables    - Criar tabela"
echo "GET  /api/tables/:tableName - Listar dados"
echo "POST /api/tables/:tableName - Inserir registro"
echo "PUT  /api/tables/:tableName/:id - Atualizar"
echo "DELETE /api/tables/:tableName/:id - Excluir"
echo ""
echo "--- Comandos ---"
echo "Logs: sudo pm2 logs $PROJECT_NAME"
echo "Reiniciar: sudo pm2 restart $PROJECT_NAME"
echo "Parar: sudo pm2 stop $PROJECT_NAME"
echo ""
echo "=== Setup completo! ==="