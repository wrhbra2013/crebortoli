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
        return json_decode($content, true) ?: getDefaultData();
    }
    return getDefaultData();
}

function getDefaultData() {
    return [
        'agendamentos' => [],
        'servicos' => [],
        'clientes' => [],
        'colaboradores' => [],
        'compras' => [],
        'vendas_servicos' => [],
        'vendas_produtos' => [],
        'insumos' => [],
        'custos_fixos' => [],
        'relatorios_mei' => [],
        'anamnese' => []
    ];
}

function saveData($data) {
    global $DATA_FILE;
    $data['_updated'] = time();
    file_put_contents($DATA_FILE, json_encode($data, JSON_PRETTY_PRINT));
}

function mergeEntity($existing, $new, $key = 'id') {
    $map = [];
    foreach ($existing as $item) {
        $map[$item[$key]] = $item;
    }
    foreach ($new as $item) {
        $map[$item[$key]] = $item;
    }
    return array_values($map);
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

$entities = ['agendamentos', 'servicos', 'clientes', 'colaboradores', 'compras', 'vendas_servicos', 'vendas_produtos', 'insumos', 'custos_fixos', 'relatorios_mei', 'anamnese'];

if ($method === 'GET' && in_array($action, $entities)) {
    $data = loadData();
    echo json_encode($data[$action] ?? []);
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

if (isset($dadosRecebidos['full_data'])) {
    foreach ($entities as $entity) {
        if (isset($dadosRecebidos['full_data'][$entity])) {
            $data[$entity] = mergeEntity(
                $data[$entity] ?? [],
                $dadosRecebidos['full_data'][$entity]
            );
        }
    }
} else {
    foreach ($entities as $entity) {
        if (isset($dadosRecebidos[$entity]) && is_array($dadosRecebidos[$entity])) {
            foreach ($dadosRecebidos[$entity] as $item) {
                $item['id'] = $item['id'] ?? uniqid();
                $item['created_at'] = $item['created_at'] ?? date('Y-m-d H:i:s');
                $data[$entity] = mergeEntity($data[$entity] ?? [], [$item]);
            }
        }
    }
}

saveData($data);

echo json_encode(['sucesso' => true]);
