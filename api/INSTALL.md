# Instalação da API - Crebortoli

## VM: Magalu Cloud - Debian
- **IP**: 201.23.76.59
- **Usuário**: debian

## Pré-requisitos

- PostgreSQL instalado na VM
- Acceso SSH à VM

## Instalação Automática

### Opção 1: Script automático (da sua máquina)

```bash
chmod +x install-vm.sh
./install-vm.sh
```

### Opção 2: Deploy completo (páginas + API + Nginx)

```bash
chmod +x deploy/deploy-api.sh
./deploy/deploy-api.sh
```

## Instalação Manual

### 1. Conectar à VM
```bash
ssh debian@201.23.76.59
```

### 2. Instalar Node.js 20.x
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs
node -v
```

### 3. Criar diretórios
```bash
sudo mkdir -p /var/www/crebortoli/api /var/www/crebortoli/uploads
sudo chown -R www-data:www-data /var/www/crebortoli
```

### 4. Copiar API
```bash
# Da sua máquina:
scp -r ./api/* debian@201.23.76.59:/var/www/crebortoli/api/
```

### 5. Criar arquivo .env
```bash
sudo nano /var/www/crebortoli/api/.env
```

Conteúdo:
```
CREBORTOLI_DB_HOST=127.0.0.1
CREBORTOLI_DB_PORT=5432
CREBORTOLI_DB_USER=postgres
CREBORTOLI_DB_PASS=wander
CREBORTOLI_DB_NAME=crebortoli
API_TOKEN=crebortoli-api-token-2024
ALLOWED_ORIGINS=*
UPLOAD_DIR=uploads
```

### 6. Instalar dependências
```bash
cd /var/www/crebortoli/api
npm install --production
```

### 7. Criar serviço systemd (opcional)
```bash
sudo nano /etc/systemd/system/crebortoli-api.service
```

```ini
[Unit]
Description=Crebortoli API Node.js
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/crebortoli/api
ExecStart=/usr/bin/node /var/www/crebortoli/api/src/server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=/var/www/crebortoli/api/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable crebortoli-api
sudo systemctl start crebortoli-api
```

### 8. Iniciar API
```bash
# Sem systemd:
node src/server.js

# Com systemd:
sudo systemctl start crebortoli-api
```

## Testar a API

### Na VM
```bash
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/ping
```

### Da sua máquina
```bash
curl http://201.23.76.59:3000/health
```

### Criar banco de dados
```bash
curl -X POST http://127.0.0.1:3000/api/project/create \
  -H "Authorization: Bearer crebortoli-api-token-2024" \
  -H "Content-Type: application/json" \
  -d '{"name":"crebortoli"}'
```

### Ler dados
```bash
curl -X POST http://127.0.0.1:3000/api/read \
  -H "Authorization: Bearer crebortoli-api-token-2024" \
  -H "Content-Type: application/json" \
  -d '{"project":"crebortoli","table":"agendamentos"}'
```

### Criar registro
```bash
curl -X POST http://127.0.0.1:3000/api/create \
  -H "Authorization: Bearer crebortoli-api-token-2024" \
  -H "Content-Type: application/json" \
  -d '{"project":"crebortoli","table":"contatos","data":{"nome":"Teste","email":"teste@email.com"}}'
```

## Comandos Úteis

```bash
# Ver status do serviço
sudo systemctl status crebortoli-api

# Ver logs
sudo journalctl -u crebortoli-api -f

# Reiniciar
sudo systemctl restart crebortoli-api

# Parar
sudo systemctl stop crebortoli-api
```

## Problemas Comuns

### "Connection refused" na porta 3000
- API não está rodando: `sudo systemctl start crebortoli-api`

### "Database does not exist"
- Criar banco: `curl -X POST http://127.0.0.1:3000/api/project/create -H "Authorization: Bearer crebortoli-api-token-2024" -H "Content-Type: application/json" -d '{"name":"crebortoli"}'`

### "Authentication failed"
- Verificar .env: `CREBORTOLI_DB_PASS`

### PostgreSQL não conecta
- Testar: `psql -h 127.0.0.1 -U postgres -d crebortoli`
- Ver se PostgreSQL está rodando: `sudo systemctl status postgresql`