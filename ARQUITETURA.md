# Arquitetura Crebortoli

## Visão Geral

```
[Usuário] --> [Nginx] --> [Páginas Estáticas]
                       --> [API Node.js] (PM2)
                              --> [PostgreSQL]
                  (port 80)        (port 3000)      (5432)
```

## Componentes

### 1. Páginas Estáticas (Frontend)
- **Local**: `/var/www/crebortoli/`
- **Arquivos**: `index.html`, `paginas/*.html`, `static/`
- **Servidor**: Nginx (porta 80)
- **Interação**: Chamadas AJAX para API Node.js via `/api/`

### 2. API Node.js (Backend)
- **Local**: `/var/www/crebortoli/api/`
- **Gerenciador**: PM2 (crebortoli-api)
- **Porta**: 3000
- **Endpoints**:
  - `GET /health` - Health check
  - `GET /ping` - Ping simples
  - `POST /api/read` - Ler dados
  - `POST /api/create` - Criar registro
  - `POST /api/update` - Atualizar registro
  - `POST /api/delete` - Deletar registro
  - `POST /api/upload` - Upload de arquivos

### 3. Banco de Dados
- **Tipo**: PostgreSQL
- **Host**: 127.0.0.1 (localhost)
- **Porta**: 5432
- **Banco**: crebortoli
- **Usuário**: postgres
- **Senha**: wander

## Configuração

### Variáveis de Ambiente (API)
```bash
CREBORTOLI_DB_HOST=127.0.0.1
CREBORTOLI_DB_PORT=5432
CREBORTOLI_DB_USER=postgres
CREBORTOLI_DB_PASS=wander
CREBORTOLI_DB_NAME=crebortoli
API_TOKEN=crebortoli-api-token-2024
ALLOWED_ORIGINS=*
UPLOAD_DIR=uploads
```

### Frontend (storage.js)
O `static/js/storage.js` está configurado para:
- API_URL: `/api` (via Nginx proxy)
- Projeto: `crebortoli`
- Token: definido em `localStorage` ou valor padrão

## Deploy na VM

### Requisitos
- VM Debian com Nginx + PM2 + PostgreSQL
- IP: 201.23.76.59
- Usuário: debian

### Scripts Disponíveis

#### Install VM (instalação completa)
```bash
chmod +x install-vm.sh
./install-vm.sh
```

#### Deploy (deploy incremental)
```bash
chmod +x deploy/deploy-pm2.sh
./deploy/deploy-pm2.sh
```

### Acesso SSH
```bash
ssh debian@201.23.76.59
```

### Comandos PM2
```bash
pm2 status                 # Ver status
pm2 logs crebortoli-api    # Ver logs
pm2 restart crebortoli-api # Reiniciar
pm2 save                   # Salvar configuração
```

### Comandos Nginx
```bash
sudo nginx -t              # Testar config
sudo systemctl reload nginx
sudo systemctl status nginx
```

## Tabelas do Banco

O sistema usa as seguintes tabelas:
- `agendamentos` - Agendamentos de clientes
- `servicos` - Serviços oferecidos
- `clientes` - Cadastro de clientes
- `receitas` - Receitas médicas
- `contatos` - Mensagens de contato

## Testes

### Health Check
```bash
curl http://201.23.76.59/api/health
```

### Ler dados
```bash
curl -X POST http://201.23.76.59/api/read \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer crebortoli-api-token-2024" \
  -d '{"project":"crebortoli","table":"agendamentos"}'
```

### Criar registro
```bash
curl -X POST http://201.23.76.59/api/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer crebortoli-api-token-2024" \
  -d '{"project":"crebortoli","table":"contatos","data":{"nome":"Teste","email":"teste@email.com"}}'
```