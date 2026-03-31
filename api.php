<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$DB_FILE = __DIR__ . '/database.sqlite';

try {
    $pdo = new PDO('sqlite:' . $DB_FILE);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    inicializarBanco($pdo);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['erro' => 'Erro na conexão: ' . $e->getMessage()]);
    exit;
}

function inicializarBanco($pdo) {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS agendamentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente TEXT,
            servico TEXT,
            data TEXT,
            hora TEXT,
            status TEXT DEFAULT 'pendente',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS servicos (
            id TEXT PRIMARY KEY,
            nome TEXT,
            preco REAL,
            categoria TEXT,
            desconto TEXT
        )
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS clientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT,
            telefone TEXT,
            email TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

if ($method === 'GET' && $action === 'agendamentos') {
    $stmt = $pdo->query("SELECT * FROM agendamentos ORDER BY data DESC");
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    exit;
}

if ($method === 'GET' && $action === 'servicos') {
    $stmt = $pdo->query("SELECT * FROM servicos");
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    exit;
}

if ($method === 'GET' && $action === 'clientes') {
    $stmt = $pdo->query("SELECT * FROM clientes ORDER BY nome");
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    exit;
}

if ($method === 'GET') {
    echo json_encode([
        'agendamentos' => $pdo->query("SELECT * FROM agendamentos")->fetchAll(PDO::FETCH_ASSOC),
        'servicos' => $pdo->query("SELECT * FROM servicos")->fetchAll(PDO::FETCH_ASSOC),
        'clientes' => $pdo->query("SELECT * FROM clientes")->fetchAll(PDO::FETCH_ASSOC)
    ]);
    exit;
}

$input = file_get_contents('php://input');
$dadosRecebidos = json_decode($input, true);

if (!$dadosRecebidos) {
    http_response_code(400);
    echo json_encode(['erro' => 'Dados inválidos']);
    exit;
}

if (isset($dadosRecebidos['agendamentos'])) {
    $stmt = $pdo->prepare("INSERT INTO agendamentos (cliente, servico, data, hora, status) VALUES (?, ?, ?, ?, ?)");
    foreach ($dadosRecebidos['agendamentos'] as $agendamento) {
        $stmt->execute([
            $agendamento['cliente'] ?? '',
            $agendamento['servico'] ?? '',
            $agendamento['data'] ?? '',
            $agendamento['hora'] ?? '',
            $agendamento['status'] ?? 'pendente'
        ]);
    }
}

if (isset($dadosRecebidos['servicos'])) {
    $stmt = $pdo->prepare("INSERT OR REPLACE INTO servicos (id, nome, preco, categoria, desconto) VALUES (?, ?, ?, ?, ?)");
    foreach ($dadosRecebidos['servicos'] as $servico) {
        $stmt->execute([
            $servico['id'] ?? '',
            $servico['nome'] ?? '',
            $servico['preco'] ?? 0,
            $servico['categoria'] ?? '',
            $servico['desconto'] ?? ''
        ]);
    }
}

if (isset($dadosRecebidos['clientes'])) {
    $stmt = $pdo->prepare("INSERT INTO clientes (nome, telefone, email) VALUES (?, ?, ?)");
    foreach ($dadosRecebidos['clientes'] as $cliente) {
        $stmt->execute([
            $cliente['nome'] ?? '',
            $cliente['telefone'] ?? '',
            $cliente['email'] ?? ''
        ]);
    }
}

echo json_encode(['sucesso' => true]);
