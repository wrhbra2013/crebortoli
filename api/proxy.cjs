const http = require('http');

const FASTAPI_URL = 'https://api.crebortoli.com.br/crebortoli';
const API_TOKEN = process.env.API_TOKEN || 'crebortoli-api-token-2024';
const PORT = process.env.PORT || 8080;

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const action = url.searchParams.get('action') || 'read';
    const table = url.searchParams.get('table') || 'agendamentos';
    const project = url.searchParams.get('project') || 'crebortoli';
    const id = url.searchParams.get('id');
    const limit = url.searchParams.get('limit');
    const offset = url.searchParams.get('offset');
    const order_by = url.searchParams.get('order_by');
    const order_dir = url.searchParams.get('order_dir');

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.url === '/health') {
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'ok' }));
        return;
    }

    if (req.url.startsWith('/api')) {
        let body = { project, table };
        
        if (action === 'read') {
            if (limit) body.limit = parseInt(limit);
            if (offset) body.offset = parseInt(offset);
            if (order_by) body.order_by = order_by;
            if (order_dir) body.order_dir = order_dir;
        }
        if (action === 'update' || action === 'delete') {
            body.id = id;
        }

        let bodyStr = '';
        for await (const chunk of req) {
            bodyStr += chunk;
        }
        if (bodyStr) {
            try {
                const parsed = JSON.parse(bodyStr);
                Object.assign(body, parsed);
            } catch (e) {}
        }

        const postData = JSON.stringify(body);
        const apiUrl = new URL(FASTAPI_URL + '/api/' + action);

        const options = {
            hostname: apiUrl.hostname,
            port: apiUrl.port || 80,
            path: apiUrl.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'Authorization': `Bearer ${API_TOKEN}`
            }
        };

        const proxyReq = http.request(options, (proxyRes) => {
            let data = '';
            proxyRes.on('data', chunk => data += chunk);
            proxyRes.on('end', () => {
                res.writeHead(proxyRes.statusCode);
                res.end(data);
            });
        });

        proxyReq.on('error', (err) => {
            res.writeHead(500);
            res.end(JSON.stringify({ error: err.message }));
        });

        proxyReq.write(postData);
        proxyReq.end();
        return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Proxy running on port ${PORT}, forwarding to ${FASTAPI_URL}`);
});