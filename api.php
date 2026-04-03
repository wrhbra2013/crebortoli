<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$DATA_FILE = __DIR__ . '/data.json';

function loadData() {
    global $DATA_FILE;
    if (file_exists($DATA_FILE)) {
        $content = file_get_contents($DATA_FILE);
        return json_decode($content, true) ?: [
            'agendamentos' => [],
            'servicos' => [],
            'clientes' => []
        ];
    }
    return [
        'agendamentos' => [],
        'servicos' => [],
        'clientes' => []
    ];
}

function saveData($data) {
    global $DATA_FILE;
    file_put_contents($DATA_FILE, json_encode($data, JSON_PRETTY_PRINT));
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

if ($method === 'GET' && $action === 'agendamentos') {
    $data = loadData();
    echo json_encode($data['agendamentos']);
    exit;
}

if ($method === 'GET' && $action === 'servicos') {
    $data = loadData();
    echo json_encode($data['servicos']);
    exit;
}

if ($method === 'GET' && $action === 'clientes') {
    $data = loadData();
    echo json_encode($data['clientes']);
    exit;
}

if ($method === 'GET' && $action === 'export') {
    $data = loadData();
    $data['exported_at'] = date('Y-m-d H:i:s');
    echo json_encode($data);
    exit;
}

if ($method === 'GET') {
    echo json_encode(loadData());
    exit;
}

$input = file_get_contents('php://input');
$dadosRecebidos = json_decode($input, true);

if (!$dadosRecebidos) {
    http_response_code(400);
    echo json_encode(['erro' => 'Dados inválidos']);
    exit;
}

$data = loadData();

if (isset($dadosRecebidos['agendamentos'])) {
    foreach ($dadosRecebidos['agendamentos'] as $agendamento) {
        $agendamento['id'] = $agendamento['id'] ?? uniqid();
        $agendamento['created_at'] = $agendamento['created_at'] ?? date('Y-m-d H:i:s');
        $agendamento['status'] = $agendamento['status'] ?? 'pendente';
        $data['agendamentos'][] = $agendamento;
    }
}

if (isset($dadosRecebidos['servicos'])) {
    foreach ($dadosRecebidos['servicos'] as $servico) {
        $servico['id'] = $servico['id'] ?? uniqid();
        $data['servicos'][] = $servico;
    }
}

if (isset($dadosRecebidos['clientes'])) {
    foreach ($dadosRecebidos['clientes'] as $cliente) {
        $cliente['id'] = $cliente['id'] ?? uniqid();
        $cliente['created_at'] = $cliente['created_at'] ?? date('Y-m-d H:i:s');
        $data['clientes'][] = $cliente;
    }
}

if (isset($dadosRecebidos['full_data'])) {
    $data = $dadosRecebidos['full_data'];
}

saveData($data);

echo json_encode(['sucesso' => true]);
