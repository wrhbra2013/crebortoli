# Arquitetura Crebortoli

## Visão Geral

```
[Usuário] --> [Páginas Estáticas] --> [API Node.js] --> [PostgreSQL]
                 (nginx)                  (port 3000)      (5432)
```

## Componentes

### 1. Páginas Estáticas (Frontend)
- **Local**: `/var/www/crebortoli/`
- **Arquivos**: `index.html`, `paginas/*.html`, `static/`
- **Servidor**: Nginx (porta 80/443)
- **Interação**: Chamadas AJAX para API Node.js

### 2. API Node.js (Backend)
- **Local**: `/var/www/crebortoli/api/`
- **Porta**: 3000
- **Endpoints**:
  - `GET /health` - Health check
  - `POST /api/read` - Ler dados
  - `POST /api/create` - Criar registro
  - `POST /api/update` - Atualizar registro
  - `POST /api/delete` - Deletar registro

### 3. Banco de Dados
- **Tipo**: PostgreSQL
- **Host**: 127.0.0.1 (localhost)
- **Porta**: 5432
- **Banco**: crebortoli

## Configuração

### Variáveis de Ambiente (API)
```bash
CREBORTOLI_DB_HOST=127.0.0.1
CREBORTOLI_DB_PORT=5432
CREBORTOLI_DB_USER=postgres
CREBORTOLI_DB_PASS=senha_forte
CREBORTOLI_DB_NAME=crebortoli
API_TOKEN=dev-token-change-me
ALLOWED_ORIGINS=*
```

### Frontend (storage.js)
O `static/js/storage.js` está configurado para:
- API_URL: `/api`
- Projeto: `crebortoli`
- Token: definido em `localStorage` ou valor padrão

## Deploy

### 1. Preparar a VM
```bash
# Na VM (como root)
apt update && apt upgrade -y
apt install -y nginx postgresql nodejs npm
```

### 2. Criar banco de dados
```bash
sudo -u postgres psql
CREATE DATABASE crebortoli;
\q
```

### 3. Deploy das páginas estáticas
```bash
rsync -avz --exclude='.env' --exclude='api' ./ user@vm:/var/www/crebortoli/
```

### 4. Deploy da API
```bash
# Copiar pasta api
rsync -avz --exclude='node_modules' ./api/ user@vm:/var/www/crebortoli/api/

# Na VM
cd /var/www/crebortoli/api
npm install

# Criar .env com as credenciais do banco
```

### 5. Configurar Nginx
```bash
cp deploy/nginx-static.conf /etc/nginx/sites-available/crebortoli
ln -s /etc/nginx/sites-available/crebortoli /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### 6. Iniciar API
```bash
systemctl enable crebortoli-api
systemctl start crebortoli-api
```

## Tabelas do Banco

O sistema usa as seguintes tabelas:
- `agendamentos` - Agendamentos de clientes
- `servicos` - Serviços oferecidos
- `clientes` - Cadastro de clientes
- `receitas` - Receitas médicas
- `contatos` - Mensagens de contato