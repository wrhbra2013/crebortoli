# Crebortoli

Site estático hospedado no GitHub Pages com API backend em Node.js/Fastify na VM Debian.

## Estrutura do Projeto

### Raiz - GitHub Pages (Estático)
- `index.html` - Página principal
- `paginas/` - Páginas estáticas
- `static/` - CSS, JS, imagens, fontes
- `components/` - Componentes reutilizáveis
- `sig/` - Sistema interno
- `*.html` - Documentação em HTML

### Pasta `api/` - VM Debian (Backend)
Contém tudo necessário para rodar na VM Debian com Nginx + PM2 + PostgreSQL:

- `src/server.js` - Servidor Fastify
- `setup-api-debian.sh` - Script principal para instalar/gerenciar projetos
- `package.json` - Dependências Node.js
- `.env.example` - Exemplo de configuração
- `API_README.md` - Documentação da API
- `INSTALL.md` - Guia de instalação

## Deploy

**GitHub Pages:** Push na branch main atualiza o site automaticamente.

**VM Debian:** Use o script `api/setup-api-debian.sh` para:
- Instalar base (Node, PostgreSQL, Nginx, PM2)
- Criar novos projetos
- Configurar Nginx e PM2
- Gerenciar bancos PostgreSQL
