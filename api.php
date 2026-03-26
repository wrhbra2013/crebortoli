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

function lerDados() {
    global $DATA_FILE;
    if (!file_exists($DATA_FILE)) {
        return ['agendamentos' => [], 'servicos' => [], 'clientes' => []];
    }
    $conteudo = file_get_contents($DATA_FILE);
    return json_decode($conteudo, true) ?: ['agendamentos' => [], 'servicos' => [], 'clientes' => []];
}

function salvarDados($dados) {
    global $DATA_FILE;
    $json = json_encode($dados, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    return file_put_contents($DATA_FILE, $json) !== false;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    echo json_encode(lerDados());
    exit;
}

$input = file_get_contents('php://input');
$dadosRecebidos = json_decode($input, true);

if (!$dadosRecebidos) {
    http_response_code(400);
    echo json_encode(['erro' => 'Dados inválidos']);
    exit;
}

$dados = lerDados();

if (isset($dadosRecebidos['agendamentos'])) {
    $dados['agendamentos'] = $dadosRecebidos['agendamentos'];
}

if (isset($dadosRecebidos['servicos'])) {
    $dados['servicos'] = $dadosRecebidos['servicos'];
}

if (isset($dadosRecebidos['clientes'])) {
    $dados['clientes'] = $dadosRecebidos['clientes'];
}

if (salvarDados($dados)) {
    echo json_encode(['sucesso' => true, 'mensagem' => 'Dados salvos']);
} else {
    http_response_code(500);
    echo json_encode(['erro' => 'Erro ao salvar dados']);
}