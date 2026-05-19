# Plano: Refatorar sistema de tokens URL + Criar função SQL tokenizer no server.js

## Fase 1: Remover sistema de ofuscação de URL

### Deletar
- `static/js/route-encrypt.js` — módulo PathTokens inteiro

### Reescrever `static/js/router.js`
Router simplificado SEM tokens:
- `navigate(path)` → `window.location.hash = '#/' + path`
- `onHashChange()` → pega hash direto como caminho (após `#/`)
- `loadPage(path)` → fetch direto ao caminho (sem `getServerToken()`)
- Remover: `PathTokens`, `_serverTokenCache`, `getServerToken()`, `updateNavLinks()`
- Manter: SPA renderização, scripts inline, patchDocumentWrite, DOMContentLoaded

### Editar `index.html`
- Linha 307: remover `<script src="static/js/route-encrypt.js">`
- Linha 436: `AppRouter.init()` continua normal

### Editar `sig/login.html`
- Linhas 326 e 346: trocar `'/#/' + encodeSigPath('sig/index.html')` → `'sig/index.html'`
- Linhas 369-376: remover função `encodeSigPath()`

### Editar `.htaccess`
- Linhas 19-27: remover bloco `RewriteEngine On` + bloqueio de `paginas/`

### Editar `api/proxy.cjs`
- Linhas 35-59: remover bloco `if (req.url.startsWith('/api/page/'))` do proxy

### Editar `api/src/server.js` (parte 1)
- Linhas 560-607: remover `pageTokenStore`, `TOKEN_EXPIRY_MS`, `setInterval` de cleanup,
  `POST /api/page/token`, `GET /api/page/:token`

### Editar `static/js/auth-guard.js`
- Linhas 96, 102: `window.__routerPath ||` → remover, usar só `window.location.pathname`

### Editar `static/js/components.js`
- Linha 92: `window.__routerPath ||` → remover, usar só `window.location.pathname`

---

## Fase 2: Criar função SQL tokenizer DENTRO de server.js

### Adicionar em `api/src/server.js`
Inserir antes dos CRUD routes (~linha 300):

```javascript
// SQL Tokenizer - central function to tokenize/resolve SQL parameters
const SQL_TOKEN_PREFIX = 'st_';
const SQL_TOKEN_EXPIRY_MS = 30 * 60 * 1000;
const sqlTokenStore = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of sqlTokenStore) {
    if (now - entry.created > SQL_TOKEN_EXPIRY_MS) sqlTokenStore.delete(token);
  }
}, 5 * 60 * 1000);

function sqlTokenize(value) {
  if (value == null || value === '') return value;
  const strVal = String(value);
  for (const [token, entry] of sqlTokenStore) {
    if (entry.value === strVal && Date.now() - entry.created < SQL_TOKEN_EXPIRY_MS) {
      entry.created = Date.now();
      return token;
    }
  }
  const buf = crypto.randomBytes(16);
  const token = SQL_TOKEN_PREFIX + buf.toString('base64url').slice(0, 12);
  sqlTokenStore.set(token, { value: strVal, created: Date.now() });
  return token;
}

function sqlResolve(token) {
  if (!token || typeof token !== 'string' || !token.startsWith(SQL_TOKEN_PREFIX)) return token;
  const entry = sqlTokenStore.get(token);
  if (!entry) return token;
  if (Date.now() - entry.created > SQL_TOKEN_EXPIRY_MS) {
    sqlTokenStore.delete(token);
    return token;
  }
  entry.created = Date.now();
  return entry.value;
}

function sqlSanitizeForLog(sql, params = []) {
  if (!params || !Array.isArray(params)) return sql;
  let s = sql;
  params.forEach((p, i) => {
    const r = typeof p === 'string' ? `'${p.slice(0, 3)}..[REDACTED]'` : '[REDACTED]';
    s = s.split(`$${i + 1}`).join(r);
  });
  return s;
}
```

### Usar nos logs dos CRUD endpoints
Substituir `console.log` que expõem dados por logs sanitizados:
- Linha 317: `console.log('[READ]', { project, table, order_by, order_dir, limit })` → usar `sqlSanitizeForLog` nos params
- Linha 339: `console.log('[READ] Found', dataRes.rows.length, 'rows')` → manter (não tem params)
- Linha 395: `console.log('[CREATE]', { project, table, dataKeys: ... })` → manter (só keys)
- Linha 409: `console.log('[CREATE] SQL: INSERT INTO', table, '(', cols, ') VALUES (', vals, ')')` → usar `sqlSanitizeForLog`
- Linha 415: `console.log('[CREATE] ERROR', e.message)` → manter

### Usar no proxy.cjs para URLs
Importar as funções do server.js ou duplicar a lógica no proxy.cjs (CommonJS).
No proxy.cjs, ao montar URLs para API externa, usar `sqlTokenize` em `table`, `id` e `filters`.
No servidor, o resolve acontece antes da query.

---

## Resumo de arquivos

| Ação | Arquivo |
|------|---------|
| DELETAR | `static/js/route-encrypt.js` |
| REESCREVER | `static/js/router.js` |
| EDITAR | `index.html` |
| EDITAR | `sig/login.html` |
| EDITAR | `.htaccess` |
| EDITAR | `api/proxy.cjs` |
| EDITAR (grande) | `api/src/server.js` |
| EDITAR (pequeno) | `static/js/auth-guard.js` |
| EDITAR (pequeno) | `static/js/components.js` |
