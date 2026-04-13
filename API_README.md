# Generic API - PHP + PostgreSQL

API REST genérica para qualquer projeto usando PHP + PostgreSQL.

## Requisitos

- PHP 8.0+
- PostgreSQL 12+
- Nginx/Apache com PHP-FPM
- PDO PostgreSQL extension

## Instalação

1. Copie `api.php` e `.env.example` para seu servidor:

```bash
cp .env.example .env
# Edite o .env com suas credenciais
```

2. Configure o Nginx:

```nginx
server {
    listen 80;
    server_name api.seusite.com;
    root /var/www/seuprojeto;
    index api.php;

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.4-fpm.sock;
        fastcgi_index api.php;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    }
}
```

3. Teste:

```bash
curl -X POST "http://localhost/api.php?action=status"
```

## Endpoints

### Status e Saúde

| Action | Descrição |
|--------|-----------|
| `?action=status` | Status da API |
| `?action=ping` | Ping simples |
| `?action=health` | Health check completo |
| `?action=tables` | Listar tabelas |
| `?action=schema&table=X` | Ver estrutura da tabela |

### CRUD Básico

| Action | Método | Descrição |
|--------|--------|-----------|
| `?action=read&table=X` | POST | Listar registros |
| `?action=create&table=X` | POST | Criar registro |
| `?action=update&table=X&id=Y` | POST | Atualizar registro |
| `?action=delete&table=X&id=Y` | POST | Deletar registro |

### Busca e Agregação

| Action | Descrição |
|--------|-----------|
| `?action=search&table=X&term=Y` | Buscar registros |
| `?action=count&table=X` | Contar registros |
| `?action=aggregate&table=X&operation=sum&field=valor` | Agregação |

### Tabela

| Action | Descrição |
|--------|-----------|
| `?action=create_table&table=X&columns=[]` | Criar tabela |

### Upload

| Action | Descrição |
|--------|-----------|
| `?action=upload` | POST (multipart) | Upload de arquivo |
| `?action=files` | Listar uploads |
| `?action=delete_file&filename=X` | Deletar arquivo |

## Exemplos

### Criar registro
```bash
curl -X POST "http://localhost/api.php?action=create" \
  -H "Content-Type: application/json" \
  -d '{
    "table": "usuarios",
    "data": {
      "nome": "João Silva",
      "email": "joao@email.com"
    }
  }'
```

### Ler registros com filtros
```bash
curl -X POST "http://localhost/api.php?action=read" \
  -H "Content-Type: application/json" \
  -d '{
    "table": "usuarios",
    "filters": {"status": "ativo"},
    "order_by": "created_at",
    "order_dir": "DESC",
    "limit": 50,
    "offset": 0
  }'
```

### Atualizar registro
```bash
curl -X POST "http://localhost/api.php?action=update" \
  -H "Content-Type: application/json" \
  -d '{
    "table": "usuarios",
    "id": "abc123",
    "data": {"status": "inativo"}
  }'
```

### Deletar registro
```bash
curl -X POST "http://localhost/api.php?action=delete" \
  -H "Content-Type: application/json" \
  -d '{
    "table": "usuarios",
    "id": "abc123"
  }'
```

### Buscar
```bash
curl -X POST "http://localhost/api.php?action=search" \
  -H "Content-Type: application/json" \
  -d '{
    "table": "usuarios",
    "term": "João",
    "fields": ["nome", "email"]
  }'
```

### Contar
```bash
curl -X POST "http://localhost/api.php?action=count" \
  -H "Content-Type: application/json" \
  -d '{
    "table": "usuarios",
    "filters": {"status": "ativo"}
  }'
```

### Agregação
```bash
curl -X POST "http://localhost/api.php?action=aggregate" \
  -H "Content-Type: application/json" \
  -d '{
    "table": "vendas",
    "operation": "sum",
    "field": "valor",
    "group_by": "status"
  }'
```

### Criar tabela
```bash
curl -X POST "http://localhost/api.php?action=create_table" \
  -H "Content-Type: application/json" \
  -d '{
    "table": "tarefas",
    "columns": [
      {"name": "id", "type": "TEXT", "primary": true},
      {"name": "titulo", "type": "TEXT"},
      {"name": "concluido", "type": "BOOLEAN", "default": "false"},
      {"name": "created_at", "type": "TIMESTAMP", "default": "NOW()"}
    ]
  }'
```

### Upload de arquivo
```bash
curl -X POST "http://localhost/api.php?action=upload" \
  -F "file=@documento.pdf"
```

## JavaScript Client

```javascript
class ApiClient {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }

    async request(action, data = {}) {
        const response = await fetch(`${this.baseUrl}/api.php?action=${action}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.error);
        return result.data;
    }

    async create(table, data) {
        return this.request('create', {table, data});
    }

    async read(table, filters = {}) {
        return this.request('read', {table, ...filters});
    }

    async update(table, id, data) {
        return this.request('update', {table, id, data});
    }

    async delete(table, id) {
        return this.request('delete', {table, id});
    }

    async status() {
        return this.request('status');
    }
}

// Uso
const api = new ApiClient('http://localhost');

// Criar
await api.create('usuarios', {nome: 'Maria', email: 'maria@email.com'});

// Listar
const usuarios = await api.read('usuarios', {limit: 10});

// Atualizar
await api.update('usuarios', 'id_123', {nome: 'Maria Silva'});

// Deletar
await api.delete('usuarios', 'id_123');
```

## Rate Limiting

- 100 requests por minuto por IP
- Bloqueio com código 429 + Retry-After

## Segurança

- Prepared statements (anti SQL injection)
- Sanitização de inputs
- Headers de segurança
- Validação de nomes de tabelas
- Rate limiting
- Arquivos protegidos (.env)

## Estrutura do .env

```env
DB_DRIVER=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=seu_banco
DB_USER=postgres
DB_PASS=sua_senha
APP_ENV=production
```
