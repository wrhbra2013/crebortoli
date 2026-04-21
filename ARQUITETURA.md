# Arquitetura Crebortoli

## Visão Geral

```
[Usuário] --> [Nginx/Servidor] --> [Páginas Estáticas]
                               --> [API Node.js] (PM2)
                                      --> [PostgreSQL] (VM Magalu)
                        (port 80)        (port 3000)      (5432)
```

## Componentes

### 1. Páginas Estáticas (Frontend)
- **Local**: `/var/www/crebortoli/`
- **Arquivos**: `index.html`, `paginas/*.html`, `static/`, `sig/*.html`
- **Servidor**: Nginx (porta 80)
- **Interação**: Chamadas AJAX para API Node.js via `/api/`

#### Páginas Públicas (`paginas/`)
- `index.html` - Homepage
- `sobre.html` - Sobre a clínica
- `servicos.html` - Lista de serviços
- `contato.html` - Formulário de contato
- `agenda.html` - Agendamento online
- `pagamento.html` - Informações de pagamento

#### Área Administrativa (`sig/`)
- `index.html` - Dashboard principal
- `login.html` - Login com QR Code
- `agenda.html` - Gestão de agendamentos
- `aprovar.html` - Aprovação de logins
- `receituario.html` - Emissão de receitas
- `relatorios.html` - Relatórios
- `tabela_precos.html` - Gestão de preços
- `pagamento.html` - Controle de pagamentos

### 2. API Node.js (Backend)
- **Local**: `/var/www/crebortoli/api/`
- **Framework**: Fastify
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
- **Host**: 201.54.22.122 (VM Magalu)
- **Porta**: 5432
- **Banco**: crebortoli_db
- **Usuário**: postgres
- **Senha**: wander

## Configuração

### Variáveis de Ambiente (API)
```bash
CREBORTOLI_DB_HOST=201.54.22.122
CREBORTOLI_DB_PORT=5432
CREBORTOLI_DB_USER=postgres
CREBORTOLI_DB_PASS=wander
CREBORTOLI_DB_NAME=crebortoli_db
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
- `sessoes` - Sessões de login QR Code
- `usuarios` - Usuários do sistema

## Estrutura de Arquivos

```
crebortoli/
├── index.html              # Homepage principal
├── api.js                  # Proxy API (Node.js)
├── api/                    # Backend Fastify
│   ├── .env               # Variáveis de ambiente
│   ├── src/server.js      # Servidor principal
│   └── package.json
├── paginas/               # Páginas públicas
│   ├── sobre.html
│   ├── servicos.html
│   ├── contato.html
│   ├── agenda.html
│   └── pagamento.html
├── sig/                   # Área administrativa
│   ├── index.html
│   ├── login.html
│   ├── agenda.html
│   ├── aprovar.html
│   ├── receituario.html
│   ├── relatorios.html
│   ├── tabela_precos.html
│   └── pagamento.html
├── static/                # Recursos estáticos
│   ├── css/              # Estilos
│   ├── js/               # Scripts
│   └── icon/            # Ícones e imagens
├── deploy/               # Scripts de deploy
├── ARQUITURA.md          # Este documento
└── INSTALL.md            # Guia de instalação
```

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
