#!/bin/bash

set -e

CONFIG_FILE="/var/www/.setup-api-config"

save_config() {
    echo "$PROJECT_NAME|$DB_NAME|$DB_USER|$PORT|$DOMAIN" >> "$CONFIG_FILE"
}

list_projects() {
    if [ -f "$CONFIG_FILE" ]; then
        echo ""
        echo "Projetos existentes:"
        cat "$CONFIG_FILE" | while IFS='|' read -r name dbname dbuser port domain; do
            echo "  - $name (banco: $dbname, porta: $port)"
        done
    fi
}

rollback_project() {
    echo ""
    echo "=============================================="
    echo "  REVERTENDO PROJETO"
    echo "=============================================="

    read -p "Nome do projeto a remover: " ROLLBACK_NAME

    if [ -z "$ROLLBACK_NAME" ]; then
        echo "Nome não pode ser vazio"
        return 1
    fi

    PROJECT_DIR="/var/www/$ROLLBACK_NAME"

    echo ""
    echo "ATENÇÃO: Isso irá remover:"
    echo "  - Diretório: $PROJECT_DIR"
    echo "  - Banco de dados PostgreSQL"
    echo "  - Usuário PostgreSQL"
    echo "  - Configuração Nginx"
    echo "  - Processo PM2"
    echo ""
    read -p "Confirmar? (sim/não): " CONFIRM
    if [ "$CONFIRM" != "sim" ]; then
        echo "Cancelado"
        return 0
    fi

    DB_NAME="${ROLLBACK_NAME}_db"
    DB_USER="${ROLLBACK_NAME}_user"

    echo ""
    echo "1. Parando PM2..."
    sudo pm2 stop "$ROLLBACK_NAME" 2>/dev/null || true
    sudo pm2 delete "$ROLLBACK_NAME" 2>/dev/null || true

    echo "2. Removendo Nginx..."
    sudo rm -f /etc/nginx/sites-enabled/"$ROLLBACK_NAME"
    sudo rm -f /etc/nginx/sites-available/"$ROLLBACK_NAME"
    sudo nginx -t && sudo systemctl reload nginx

    echo "3. Removendo banco de dados..."
    sudo -u postgres psql -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || true
    sudo -u postgres psql -c "DROP USER IF EXISTS $DB_USER;" 2>/dev/null || true

    echo "4. Removendo diretório..."
    sudo rm -rf "$PROJECT_DIR"

    echo "5. Atualizando config..."
    if [ -f "$CONFIG_FILE" ]; then
        grep -v "^$ROLLBACK_NAME|" "$CONFIG_FILE" > "${CONFIG_FILE}.tmp" && mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"
    fi

    echo ""
    echo "=== Projeto $ROLLBACK_NAME removido com sucesso! ==="
}

restore_backup() {
    echo ""
    echo "=============================================="
    echo "  RESTAURAR BACKUP"
    echo "=============================================="

    read -p "Caminho do arquivo de backup: " BACKUP_FILE

    if [ ! -f "$BACKUP_FILE" ]; then
        echo "Arquivo não encontrado: $BACKUP_FILE"
        return 1
    fi

    read -p "Nome do projeto no backup: " BACKUP_NAME

    TEMP_DIR="/tmp/restore_$$"
    mkdir -p "$TEMP_DIR"

    echo "Extraindo backup..."
    if file "$BACKUP_FILE" | grep -q "gzip"; then
        tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"
    else
        tar -xf "$BACKUP_FILE" -C "$TEMP_DIR"
    fi

    echo ""
    echo "Arquivos extraídos:"
    ls -la "$TEMP_DIR"

    read -p "Confirmar restauração? (sim/não): " CONFIRM
    if [ "$CONFIRM" != "sim" ]; then
        rm -rf "$TEMP_DIR"
        echo "Cancelado"
        return 0
    fi

    RESTORE_DIR="$TEMP_DIR/$BACKUP_NAME"

    if [ -d "$RESTORE_DIR" ]; then
        sudo cp -r "$RESTORE_DIR" /var/www/
        cd "/var/www/$BACKUP_NAME"
        sudo npm install
        sudo pm2 start "/var/www/$BACKUP_NAME/src/server.js" --name "$BACKUP_NAME"
        echo "Backup restaurado!"
    else
        echo "Pasta do projeto não encontrada no backup"
    fi

    rm -rf "$TEMP_DIR"
}

create_backup() {
    echo ""
    echo "=============================================="
    echo "  CRIAR BACKUP"
    echo "=============================================="

    read -p "Nome do projeto: " BACKUP_NAME

    PROJECT_DIR="/var/www/$BACKUP_NAME"
    if [ ! -d "$PROJECT_DIR" ]; then
        echo "Projeto não encontrado: $PROJECT_DIR"
        return 1
    fi

    BACKUP_FILE="/tmp/${BACKUP_NAME}_backup_$(date +%Y%m%d_%H%M%S).tar.gz"

    echo "Criando backup de $PROJECT_DIR..."
    sudo tar -czf "$BACKUP_FILE" -C "$(dirname "$PROJECT_DIR")" "$(basename "$PROJECT_DIR")"

    if [ -f "$PROJECT_DIR/.env" ]; then
        echo "备份 criado: $BACKUP_FILE"
        ls -lh "$BACKUP_FILE"
    else
        echo "Erro ao criar backup"
        rm -f "$BACKUP_FILE"
    fi
}

install_base() {
    echo ""
    echo "--- INSTALAÇÃO BASE ---"

    echo "1. Atualizando pacotes..."
    sudo apt update && sudo apt upgrade -y

    echo "2. Instalando Node.js 20..."
    if ! command -v node &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt install -y nodejs
    fi

    echo "3. Instalando PostgreSQL..."
    if ! command -v psql &> /dev/null; then
        sudo apt install -y postgresql postgresql-contrib
    fi

    echo "4. Instalando Nginx e PM2..."
    if ! command -v nginx &> /dev/null; then
        sudo apt install -y nginx
    fi
    if ! command -v pm2 &> /dev/null; then
        sudo npm install -g pm2
    fi

    echo "5. Verificando instalações..."
    node -v
    nginx -v
    psql --version
    pm2 --version

    echo ""
    echo "Base instalada com sucesso!"
}

create_project() {
    echo ""
    echo "=============================================="
    echo "  CRIAR NOVO PROJETO"
    echo "=============================================="

    read -p "Nome do projeto (ex: meu-site): " PROJECT_NAME
    read -p "Domínio (ex: api.meusite.com ou Enter para localhost): " DOMAIN
    read -p "Porta (Enter para 3000): " PORT
    PORT="${PORT:-3000}"

    PROJECT_DIR="/var/www/$PROJECT_NAME"

    echo ""
    echo "--- Configuração do Banco de Dados ---"
    read -p "Nome do banco de dados [${PROJECT_NAME}_db]: " DB_NAME
    DB_NAME="${DB_NAME:-${PROJECT_NAME}_db}"

    read -p "Usuário do banco [${PROJECT_NAME}_user]: " DB_USER
    DB_USER="${DB_USER:-${PROJECT_NAME}_user}"

    while [ -z "$DB_PASS" ]; do
        read -s -p "Senha do banco: " DB_PASS
        echo ""
        if [ -z "$DB_PASS" ]; then
            echo "Senha não pode ser vazia"
        fi
    done

    read -p "Tabelas iniciais (Enter para padrão): " TABLES_INPUT

    echo ""
    echo "=============================================="
    echo "  CRIANDO BANCO DE DADOS"
    echo "=============================================="

    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || echo "Usuário já existe"
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || echo "Banco já existe"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

    echo ""
    echo "=============================================="
    echo "  CRIANDO PROJETO"
    echo "=============================================="

    sudo mkdir -p "$PROJECT_DIR/src"
    sudo mkdir -p "$PROJECT_DIR/public"

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
PORT=$PORT
NODE_ENV=production
DB_HOST=localhost
DB_PORT=5432
DB_NAME=$DB_NAME
DB_USER=$DB_USER
PASSWORD=$DB_PASS
EOF

    DEFAULT_TABLES="clientes,contatos,servicos"
    TABLES="${TABLES_INPUT:-$DEFAULT_TABLES}"

    sudo tee "$PROJECT_DIR/src/server.js" > /dev/null <<'SERVEREOF'
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
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

pool.on('error', (err) => console.error('DB Error:', err));

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
        res.json({ success: true, message: `Tabela "${tableName}" criada` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/tables/:tableName', async (req, res) => {
    const { tableName } = req.params;
    try {
        await pool.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE;`);
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

    echo ""
    echo "=============================================="
    echo "  CRIANDO TABELAS PADRÃO"
    echo "=============================================="

    IFS=',' read -ra TABLE_ARRAY <<< "$TABLES"
    for table in "${TABLE_ARRAY[@]}"; do
        table=$(echo "$table" | xargs)
        if [ -n "$table" ]; then
            echo "Criando tabela: $table"
            sudo -u postgres psql -d "$DB_NAME" -c "
                CREATE TABLE IF NOT EXISTS \"$table\" (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                );
            " 2>/dev/null || echo "Tabela $table já existe"
        fi
    done

    cd "$PROJECT_DIR"
    sudo npm install

    echo ""
    echo "=============================================="
    echo "  CONFIGURANDO PM2"
    echo "=============================================="

    sudo pm2 delete "$PROJECT_NAME" 2>/dev/null || true
    sudo pm2 start "$PROJECT_DIR/src/server.js" --name "$PROJECT_NAME" -- --port "$PORT"
    sudo pm2 save

    SYSTEMD_SERVICE=$(sudo pm2 startup | tail -1)
    if [ -n "$SYSTEMD_SERVICE" ]; then
        echo "$SYSTEMD_SERVICE" | sudo bash 2>/dev/null || true
    fi

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
        proxy_pass http://localhost:$PORT;
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
        proxy_pass http://localhost:$PORT;
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

    save_config

    echo ""
    echo "=============================================="
    echo "  RESUMO DO PROJETO"
    echo "=============================================="
    echo ""
    echo "Projeto: $PROJECT_NAME"
    echo "Diretório: $PROJECT_DIR"
    echo "Porta: $PORT"
    echo "Banco: $DB_NAME"
    echo "Usuário: $DB_USER"
    echo "Tabelas: $TABLES"
    echo ""
    echo "URL: http://localhost:$PORT"
    if [ -n "$DOMAIN" ]; then
        echo "Domínio: $DOMAIN"
    fi
    echo ""
    echo "=== Projeto criado com sucesso! ==="
}

show_menu() {
    echo ""
    echo "=============================================="
    echo "  Setup API Node.js + PostgreSQL + Nginx + PM2"
    echo "=============================================="
    echo ""
    echo "Escolha uma opção:"
    echo "  1 - Instalar base (Node, PostgreSQL, Nginx, PM2)"
    echo "  2 - Criar novo projeto"
    echo "  3 - Listar projetos"
    echo "  4 - Reverter/remover projeto"
    echo "  5 - Criar backup"
    echo "  6 - Restaurar backup"
    echo "  7 - Sair"
    echo ""
    read -p "Opção: " OPTION

    case $OPTION in
        1) install_base ;;
        2) create_project ;;
        3) list_projects ;;
        4) rollback_project ;;
        5) create_backup ;;
        6) restore_backup ;;
        7) echo "Saindo..."; exit 0 ;;
        *) echo "Opção inválida" ;;
    esac
}

if [ "$1" == "install" ]; then
    install_base
elif [ "$1" == "create" ]; then
    create_project
elif [ "$1" == "list" ]; then
    list_projects
elif [ "$1" == "rollback" ]; then
    rollback_project
elif [ "$1" == "backup" ]; then
    create_backup
elif [ "$1" == "restore" ]; then
    restore_backup
else
    show_menu
fi