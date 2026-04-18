const FASTAPI_URL = 'http://201.23.76.59:3001';
const API_PROJECT = 'crebortoli';
const API_TOKEN = process.env.API_TOKEN || 'crebortoli-api-token-2024';

const validTables = ['agendamentos', 'servicos', 'clientes', 'receitas', 'contatos', 'sessoes', 'usuarios'];

function getAuthHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_TOKEN}`
    };
}

async function makeRequest(endpoint, method = 'POST', data = null) {
    const options = {
        method,
        headers: getAuthHeaders()
    };
    if (data && method !== 'GET') {
        options.body = JSON.stringify(data);
    }
    const response = await fetch(`${FASTAPI_URL}${endpoint}`, options);
    return { code: response.status, body: await response.json() };
}

function parseQuery(url) {
    const params = {};
    const searchParams = new URL(url).searchParams;
    searchParams.forEach((v, k) => params[k] = v);
    return params;
}

async function handleRequest(req, res) {
    const url = req.url.split('?')[0];
    const query = parseQuery(req.url);
    const action = query.action || 'read';

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    let body = {};
    if (req.method !== 'GET') {
        try {
            const buffers = [];
            for await (const chunk of req) buffers.push(chunk);
            body = JSON.parse(Buffer.concat(buffers).toString()) || {};
        } catch (e) {
            body = {};
        }
    }
    body = { ...query, ...body };

    let result;
    switch (action) {
        case 'health':
        case 'status':
            result = await makeRequest('/health', 'GET');
            break;
        case 'ping':
            res.writeHead(200);
            res.end(JSON.stringify({ pong: true }));
            return;
        case 'read':
            result = await makeRequest('/api/read', 'POST', {
                project: body.project || API_PROJECT,
                table: body.table || 'agendamentos',
                filters: body.filters || {},
                limit: parseInt(body.limit) || 100,
                offset: parseInt(body.offset) || 0,
                order_by: body.order_by || 'created_at',
                order_dir: body.order_dir || 'DESC'
            });
            break;
        case 'create':
            result = await makeRequest('/api/create', 'POST', {
                project: body.project || API_PROJECT,
                table: body.table || 'contatos',
                data: body.data || {}
            });
            break;
        case 'update':
            result = await makeRequest('/api/update', 'POST', {
                project: body.project || API_PROJECT,
                table: body.table || 'agendamentos',
                id: body.id || '',
                data: body.data || {}
            });
            break;
        case 'delete':
            result = await makeRequest('/api/delete', 'POST', {
                project: body.project || API_PROJECT,
                table: body.table || 'agendamentos',
                id: body.id || ''
            });
            break;
        case 'tables':
            result = await makeRequest('/api/tables/' + (body.project || API_PROJECT), 'GET');
            break;
        default:
            result = { code: 400, body: { error: 'Ação desconhecida: ' + action } };
    }

    res.writeHead(result.code);
    res.end(JSON.stringify(result.body));
}

const server = require('http').createServer(handleRequest);
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`API Proxy running on port ${PORT}, forwarding to ${FASTAPI_URL}`);
});