<?php

define('FASTAPI_URL', 'http://201.23.76.59:3001');
define('API_PROJECT', 'crebortoli');
define('API_TOKEN', getenv('API_TOKEN') ?: 'crebortoli-api-token-2024');

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

function makeRequest($endpoint, $method = 'POST', $data = null) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, FASTAPI_URL . $endpoint);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . API_TOKEN
    ]);

    if ($method !== 'GET') {
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        if ($data) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }
    }

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return ['code' => $httpCode, 'body' => $response];
}

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    if ($action === 'health' || $action === 'status') {
        $result = makeRequest('/health', 'GET');
        echo $result['body'];
        exit;
    }
    if ($action === 'ping') {
        echo json_encode(['pong' => true]);
        exit;
    }
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$body = array_merge($_GET, $input);

switch ($action) {
    case 'read':
    case 'status':
    case 'health':
    case 'ping':
        if ($action === 'read') {
            $result = makeRequest('/api/read', 'POST', [
                'project' => $body['project'] ?? API_PROJECT,
                'table' => $body['table'] ?? 'agendamentos',
                'filters' => $body['filters'] ?? [],
                'limit' => $body['limit'] ?? 100,
                'offset' => $body['offset'] ?? 0,
                'order_by' => $body['order_by'] ?? 'created_at',
                'order_dir' => $body['order_dir'] ?? 'DESC'
            ]);
        } else {
            $result = makeRequest('/' . ($action === 'status' ? 'health' : $action), 'GET');
        }
        break;

    case 'create':
        $result = makeRequest('/api/create', 'POST', [
            'project' => $body['project'] ?? API_PROJECT,
            'table' => $body['table'] ?? 'contatos',
            'data' => $body['data'] ?? []
        ]);
        break;

    case 'update':
        $result = makeRequest('/api/update', 'POST', [
            'project' => $body['project'] ?? API_PROJECT,
            'table' => $body['table'] ?? 'agendamentos',
            'id' => $body['id'] ?? '',
            'data' => $body['data'] ?? []
        ]);
        break;

    case 'delete':
        $result = makeRequest('/api/delete', 'POST', [
            'project' => $body['project'] ?? API_PROJECT,
            'table' => $body['table'] ?? 'agendamentos',
            'id' => $body['id'] ?? ''
        ]);
        break;

    case 'login':
        $result = makeRequest('/api.php', 'POST', [
            'action' => 'login',
            'email' => $body['email'] ?? '',
            'senha' => $body['senha'] ?? ''
        ]);
        break;

    default:
        echo json_encode(['error' => 'Ação desconhecida: ' . $action]);
        exit;
}

http_response_code($result['code']);
echo $result['body'];