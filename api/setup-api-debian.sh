#!/bin/bash

CONFIG_FILE="/var/www/.setup-api-config"
NGINX_MAIN_CONF="/etc/nginx/sites-available/main"

PG_ADMIN_USER="postgres"
PG_ADMIN_PASS=""

init_postgres_credentials() {
    echo ""
    echo "=============================================="
    echo "  ACESSSO POSTGRESQL"
    echo "=============================================="
    
    while [ -z "$PG_ADMIN_USER" ]; do
        read -p "Usuário PostgreSQL: " PG_ADMIN_USER
        if [ -z "$PG_ADMIN_USER" ]; then
            echo "Informe o usuário"
        fi
    done
    
    while [ -z "$PG_ADMIN_PASS" ]; do
        read -s -p "Senha PostgreSQL: " PG_ADMIN_PASS
        if [ -z "$PG_ADMIN_PASS" ]; then
            echo "Informe a senha"
        fi
    done
    echo ""
}

init_postgres_credentials

save_config() {
    grep -q "^$PROJECT_NAME|" "$CONFIG_FILE" 2>/dev/null || echo "$PROJECT_NAME|$DB_NAME|$DB_USER|$PORT|$LOCATION" >> "$CONFIG_FILE"
}

update_config() {
    local name=$1
    local port=$2
    local location=$3
    if [ -f "$CONFIG_FILE" ]; then
        if grep -q "^$name|" "$CONFIG_FILE"; then
            sed -i "s|^$name|.*|$name|$port|$location|" "$CONFIG_FILE"
        else
            echo "$name||$port|$location" >> "$CONFIG_FILE"
        fi
    fi
}

check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "Porta $port já está em uso"
        return 1
    fi
    return 0
}

kill_port() {
    local port=$1
    echo "Verificando porta $port..."
    local pids=$(lsof -Pi :$port -t 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo "Matando processos na porta $port: $pids"
        echo "$pids" | xargs -r sudo kill -9 2>/dev/null || true
        sleep 1
    fi
}

cleanup_pm2() {
    local name=$1
    echo "Limpando PM2 para $name..."
    sudo pm2 stop "$name" 2>/dev/null || true
    sudo pm2 delete "$name" 2>/dev/null || true
}

remove_location() {
    local name=$1
    if [ -f "$NGINX_MAIN_CONF" ]; then
        echo "Removendo location /$name do Nginx..."
        sudo sed -i "/location \/$name/,/}/d" "$NGINX_MAIN_CONF"
    fi
}

cleanup_database() {
    local db_name=$1
    local db_user=$2
    echo "Limpando banco de dados..."
    sudo -u postgres psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$db_name' AND pid <> pg_backend_pid();" 2>/dev/null || true
    sudo -u postgres psql -c "DROP DATABASE IF EXISTS $db_name;" 2>/dev/null || true
    sudo -u postgres psql -c "DROP USER IF EXISTS $db_user;" 2>/dev/null || true
}

list_projects() {
    if [ -f "$CONFIG_FILE" ]; then
        echo ""
        echo "Projetos existentes:"
        cat "$CONFIG_FILE" | while IFS='|' read -r name dbname dbuser port location; do
            echo "  - $name (porta: $port, path: /$location)"
        done
    fi
}

generate_nginx_conf() {
    local server_name=$1
    shift
    local locations=("$@")
    
    local conf="server {
    listen 80;
    server_name $server_name;
"
    for loc in "${locations[@]}"; do
        IFS='|' read -r name port <<< "$loc"
        conf+="
    location /$name/ {
        proxy_pass http://127.0.0.1:$port/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cache_bypass \$http_upgrade;
    }
"
    done
    conf+="
}"
    echo "$conf"
}

rollback_project() {
    echo ""
    echo "=============================================="
    echo "  REVERTENDO PROJETO"
    echo "=============================================="

    list_projects

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
    echo "  - Location Nginx: /$ROLLBACK_NAME/"
    echo "  - Processo PM2"
    echo ""
    read -p "Confirmar? (sim/não): " CONFIRM
    if [ "$CONFIRM" != "sim" ]; then
        echo "Cancelado"
        return 0
    fi

    DB_NAME="${ROLLBACK_NAME}_db"
    DB_USER="${ROLLBACK_NAME}_user"
    PORT=$(grep "^PORT=" "$PROJECT_DIR/.env" 2>/dev/null | cut -d= -f2 || echo "3000")

    echo ""
    echo "1. Parando PM2..."
    cleanup_pm2 "$ROLLBACK_NAME"

    echo "2. Removendo location Nginx..."
    remove_location "$ROLLBACK_NAME"

    echo "3. Liberando porta $PORT..."
    kill_port "$PORT"

    echo "4. Removendo banco de dados..."
    cleanup_database "$DB_NAME" "$DB_USER"

    echo "5. Removendo diretório..."
    sudo rm -rf "$PROJECT_DIR"

    echo "6. Atualizando config..."
    if [ -f "$CONFIG_FILE" ]; then
        grep -v "^$ROLLBACK_NAME|" "$CONFIG_FILE" > "${CONFIG_FILE}.tmp" && mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"
    fi

    echo ""
    echo "=== Projeto $ROLLBACK_NAME removido com sucesso! ==="
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
        echo "Backup criado: $BACKUP_FILE"
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

    read -p "Nome do projeto (ex: crebortoli): " PROJECT_NAME
    read -p "Domínio/IP principal (ex: 201.54.22.122): " SERVER_NAME
    SERVER_NAME="${SERVER_NAME:-201.54.22.122}"
    read -p "Porta (Enter para auto-detectar): " PORT

    if [ -z "$PORT" ]; then
        PORT=3001
        while ! check_port "$PORT"; do
            PORT=$((PORT + 1))
        done
    else
        if ! check_port "$PORT"; then
            echo ""
            echo "ERRO: Porta $PORT já está em uso!"
            read -p "Deseja limpar a porta e continuar? (sim/não): " CLEAN_PORT
            if [ "$CLEAN_PORT" == "sim" ]; then
                kill_port "$PORT"
            else
                echo "Cancelado"
                return 1
            fi
        fi
    fi

    LOCATION="$PROJECT_NAME"
    PROJECT_DIR="/var/www/$PROJECT_NAME"

    if [ -d "$PROJECT_DIR" ]; then
        echo ""
        echo "Projeto já existe em $PROJECT_DIR"
        read -p "Deseja remover e recriar? (sim/não): " RECREATE
        if [ "$RECREATE" == "sim" ]; then
            DB_NAME="${PROJECT_NAME}_db"
            DB_USER="${PROJECT_NAME}_user"
            cleanup_pm2 "$PROJECT_NAME"
            remove_location "$PROJECT_NAME"
            kill_port "$PORT"
            cleanup_database "$DB_NAME" "$DB_USER"
            sudo rm -rf "$PROJECT_DIR"
        else
            echo "Cancelado"
            return 0
        fi
    else
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
    fi

    read -p "Tabelas (Enter para agendamentos,servicos,clientes,contatos): " TABLES_INPUT
    TABLES="${TABLES_INPUT:-agendamentos,servicos,clientes,contatos}"

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
    "dev": "node --watch src/server.js"
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
DB_PASS=$DB_PASS
EOF

    sudo tee "$PROJECT_DIR/src/server.js" > /dev/null <<SERVEREOF
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS
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

app.get('/api/tables', async (req, res) => {
    try {
        const result = await pool.query(\`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        \`);
        res.json({ tables: result.rows.map(r => r.table_name) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/tables/:tableName', async (req, res) => {
    const { tableName } = req.params;
    try {
        const result = await pool.query(\`SELECT * FROM "\${tableName}" LIMIT 100;\`);
        res.json({ table: tableName, data: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/tables/:tableName', async (req, res) => {
    const { tableName } = req.params;
    const data = req.body;
    try {
        const keys = Object.keys(data).map(k => '"${k}"').join(', ');
        const values = Object.keys(data).map((_, i) => \`$\${i + 1}\`).join(', ');
        const result = await pool.query(\`INSERT INTO "\${tableName}" (\${keys}) VALUES (\${values}) RETURNING *;\`, Object.values(data));
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/tables/:tableName/:id', async (req, res) => {
    const { tableName, id } = req.params;
    const data = req.body;
    try {
        const keys = Object.keys(data).map((k, i) => \`"\${k}" = $\${i + 1}\`).join(', ');
        const result = await pool.query(\`UPDATE "\${tableName}" SET \${keys} WHERE id = $\${Object.keys(data).length + 1} RETURNING *;\`, [...Object.values(data), id]);
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/tables/:tableName/:id', async (req, res) => {
    const { tableName, id } = req.params;
    try {
        await pool.query(\`DELETE FROM "\${tableName}" WHERE id = $1;\`, [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(\`Server running on port \${PORT}\`);
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

    cleanup_pm2 "$PROJECT_NAME"
    sudo pm2 start "$PROJECT_DIR/src/server.js" --name "$PROJECT_NAME"
    sudo pm2 save

    SYSTEMD_SERVICE=$(sudo pm2 startup | tail -1)
    if [ -n "$SYSTEMD_SERVICE" ]; then
        echo "$SYSTEMD_SERVICE" | sudo bash 2>/dev/null || true
    fi

    echo ""
    echo "=============================================="
    echo "  CONFIGURANDO NGINX (MULTI-LOCATION)"
    echo "=============================================="

    local location_block="
    location /$LOCATION/ {
        proxy_pass http://127.0.0.1:$PORT/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cache_bypass \$http_upgrade;
    }
"

    if [ -f "$NGINX_MAIN_CONF" ]; then
        echo "Adicionando location /$LOCATION/ ao config existente..."
        if ! grep -q "location /$LOCATION/" "$NGINX_MAIN_CONF"; then
            sudo sed -i "s|server {|server {\n$location_block|" "$NGINX_MAIN_CONF"
        fi
    else
        echo "Criando novo config Nginx..."
        sudo tee "$NGINX_MAIN_CONF" > /dev/null <<EOF
server {
    listen 80;
    server_name $SERVER_NAME;
$location_block
}
EOF
    fi

    sudo ln -sf "$NGINX_MAIN_CONF" /etc/nginx/sites-enabled/main 2>/dev/null || true
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
    echo "Location: /$LOCATION/"
    echo "Banco: $DB_NAME"
    echo "Usuário: $DB_USER"
    echo "Tabelas: $TABLES"
    echo ""
    echo "URL: http://$SERVER_NAME/$LOCATION/"
    echo ""
    echo "=== Projeto criado com sucesso! ==="
}

install_crebortoli_api() {
    echo ""
    echo "=============================================="
    echo "  API CREBORTOLI (Fastify)"
    echo "=============================================="

    CREBORTOLI_DIR="/var/www/crebortoli"
    API_DIR="$CREBORTOLI_DIR/api"
    PORT=3001

    if [ ! -d "$CREBORTOLI_DIR" ]; then
        echo "Erro: Diretório $CREBORTOLI_DIR não existe"
        return 1
    fi

    if [ ! -d "$API_DIR" ]; then
        echo "Erro: Diretório $API_DIR não existe"
        return 1
    fi

    cd "$API_DIR"

    echo ""
    echo "1. Instalando dependências..."
    if [ ! -d "node_modules" ]; then
        npm install
    fi

    echo "2. Criando arquivo .env..."
    if [ ! -f .env ]; then
        cat > .env <<EOF
CREBORTOLI_DB_HOST=201.54.22.122
CREBORTOLI_DB_PORT=5432
CREBORTOLI_DB_USER=postgres
CREBORTOLI_DB_PASS=wander
CREBORTOLI_DB_NAME=crebortoli_db
API_TOKEN=crebortoli-api-token-2024
ALLOWED_ORIGINS=*
PORT=$PORT
EOF
        echo ".env criado"
    fi

    echo "3. Verificando/parando processo existente..."
    if pgrep -f "node.*server.js" > /dev/null 2>&1; then
        echo "Parando API existente..."
        pkill -f "node.*server.js" || true
        sleep 2
    fi

    echo "4. Iniciando API com PM2..."
    cleanup_pm2 "crebortoli-api"
    cd "$API_DIR"
    sudo pm2 start src/server.js --name "crebortoli-api"
    sudo pm2 save

    echo "5. Testando API..."
    sleep 2
    TEST_RESULT=$(curl -s http://localhost:$PORT/health 2>/dev/null || echo '{"status":"error"}')
    echo "$TEST_RESULT" | grep -q "ok" && echo "API iniciada com sucesso!" || echo "Verifique os logs: pm2 logs crebortoli-api"

    echo ""
    echo "=============================================="
    echo "  RESUMO"
    echo "=============================================="
    echo "Diretório: $API_DIR"
    echo "Porta: $PORT"
    echo "URL: http://201.54.22.122:$PORT/"
    echo "Health: http://201.54.22.122:$PORT/health"
    echo ""
    echo "Comandos úteis:"
    echo "  pm2 status          - Ver status"
    echo "  pm2 logs            - Ver logs"
    echo "  pm2 restart        - Reiniciar"
    echo ""
    echo "=== API Crebortoli iniciada! ==="
}

stop_crebortoli_api() {
    echo ""
    echo "Parando API Crebortoli..."
    cleanup_pm2 "crebortoli-api"
    pkill -f "crebortoli-api" 2>/dev/null || true
    echo "API parada"
}

setup_crebortoli_nginx() {
    echo ""
    echo "=============================================="
    echo "  CONFIGURAR NGINX CREBORTOLI"
    echo "=============================================="

    CREBORTOLI_DIR="/var/www/crebortoli"
    API_PORT=3001
    SERVER_NAME="${1:-201.54.22.122}"

    if [ ! -d "$CREBORTOLI_DIR" ]; then
        echo "Erro: Diretório $CREBORTOLI_DIR não existe"
        return 1
    fi

    NGINX_CONF="/etc/nginx/sites-available/crebortoli"
    NGINX_ENABLED="/etc/nginx/sites-enabled/crebortoli"

    echo "Criando configuração Nginx para Crebortoli..."
    echo "Servidor: $SERVER_NAME"
    echo "Pasta: $CREBORTOLI_DIR"
    echo "API: http://127.0.0.1:$API_PORT"
    echo ""

    sudo tee "$NGINX_CONF" > /dev/null <<EOF
server {
    listen 80;
    server_name $SERVER_NAME;

    root $CREBORTOLI_DIR;
    index index.html;

    access_log /var/log/nginx/crebortoli_access.log;
    error_log /var/log/nginx/crebortoli_error.log;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Static files
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # API proxy - /api/ -> Node.js
    location /api/ {
        proxy_pass http://127.0.0.1:$API_PORT/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 60s;
    }

    # API proxy - /crebortoli/api/ -> Node.js
    location /crebortoli/api/ {
        proxy_pass http://127.0.0.1:$API_PORT/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 60s;
    }

    # Static /crebortoli/
    location /crebortoli/ {
        alias $CREBORTOLI_DIR/;
        try_files \$uri \$uri/ /crebortoli/index.html;
    }

    location /uploads/ {
        alias $CREBORTOLI_DIR/static/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|otf)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location ~ /\. {
        deny all;
    }

    location ~ ^/(\.htaccess|\.git|\.env) {
        deny all;
    }
}
EOF

    sudo ln -sf "$NGINX_CONF" "$NGINX_ENABLED"
    sudo rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

    echo "Testando configuração Nginx..."
    if sudo nginx -t; then
        echo "Recarregando Nginx..."
        sudo systemctl reload nginx
        echo ""
        echo "=== Nginx configurado com sucesso! ==="
        echo ""
        echo "URLs disponíveis:"
        echo "  - http://$SERVER_NAME/"
        echo "  - http://$SERVER_NAME/api/"
        echo "  - http://$SERVER_NAME/crebortoli/"
        echo "  - http://$SERVER_NAME/crebortoli/api/"
        echo ""
    else
        echo "Erro na configuração do Nginx"
        return 1
    fi
}

show_menu() {
    echo ""
    echo "=============================================="
    echo "  Setup API Multi-Projeto (Nginx Locations)"
    echo "=============================================="
    echo ""
    echo "Escolha uma opção:"
    echo "  1 - Instalar base (Node, PostgreSQL, Nginx, PM2)"
    echo "  2 - Criar novo projeto"
    echo "  3 - Listar projetos"
    echo "  4 - Reverter/remover projeto"
    echo "  5 - Criar backup"
    echo "  6 - Instalar/Atualizar API Crebortoli (Fastify)"
    echo "  7 - Parar API Crebortoli"
    echo "  8 - Configurar Nginx para Crebortoli"
    echo "  9 - Sair"
    echo ""
    read -p "Opção: " OPTION

    case $OPTION in
        1) install_base ;;
        2) create_project ;;
        3) list_projects ;;
        4) rollback_project ;;
        5) create_backup ;;
        6) install_crebortoli_api ;;
        7) stop_crebortoli_api ;;
        8) 
            read -p "IP/Domínio (Enter para 201.54.22.122): " SERVER_IP
            SERVER_IP="${SERVER_IP:-201.54.22.122}"
            setup_crebortoli_nginx "$SERVER_IP"
            ;;
        9) echo "Saindo..."; exit 0 ;;
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
elif [ "$1" == "api" ]; then
    install_crebortoli_api
elif [ "$1" == "stop-api" ]; then
    stop_crebortoli_api
elif [ "$1" == "nginx" ]; then
    setup_crebortoli_nginx "${2:-201.54.22.122}"
else
    show_menu
fi