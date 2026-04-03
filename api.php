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
    $pdo->exec('PRAGMA foreign_keys = ON');
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['erro' => 'Erro ao conectar banco: ' . $e->getMessage()]);
    exit;
}

function initTables($pdo) {
    $tables = [
        'agendamentos' => '
            id TEXT PRIMARY KEY,
            data TEXT,
            hora TEXT,
            cliente TEXT,
            telefone TEXT,
            servico TEXT,
            servicoNome TEXT,
            valor REAL,
            status TEXT DEFAULT "PENDENTE",
            pago INTEGER DEFAULT 0,
            created_at TEXT,
            updated_at TEXT
        ',
        'servicos' => '
            id TEXT PRIMARY KEY,
            nome TEXT,
            preco REAL,
            categoria TEXT,
            ativo INTEGER DEFAULT 1,
            created_at TEXT,
            updated_at TEXT
        ',
        'clientes' => '
            id TEXT PRIMARY KEY,
            nome TEXT,
            telefone TEXT,
            email TEXT,
            anamnese TEXT,
            created_at TEXT,
            updated_at TEXT
        ',
        'receitas' => '
            id TEXT PRIMARY KEY,
            nome TEXT,
            produtos TEXT,
            instrucoes TEXT,
            created_at TEXT,
            updated_at TEXT
        ',
        'qr_sessoes' => '
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            token TEXT UNIQUE,
            status TEXT DEFAULT "aguardando",
            urlAprovacao TEXT,
            created TEXT,
            aprovadoEm TEXT,
            negadoEm TEXT
        '
    ];
    
    foreach ($tables as $table => $columns) {
        $pdo->exec("CREATE TABLE IF NOT EXISTS $table ($columns)");
    }
}

initTables($pdo);

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

if ($method === 'GET' && $action) {
    if ($action === 'health') {
        echo json_encode(['status' => 'ok', 'timestamp' => time()]);
        exit;
    }
    
    $allowedTables = ['agendamentos', 'servicos', 'clientes', 'receitas', 'qr_sessoes'];
    
    if (in_array($action, $allowedTables)) {
        $stmt = $pdo->query("SELECT * FROM $action ORDER BY created_at DESC");
        $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($data);
        exit;
    }
    
    http_response_code(404);
    echo json_encode(['erro' => 'Action não encontrada']);
    exit;
}

if ($method === 'GET') {
    $tables = ['agendamentos', 'servicos', 'clientes', 'receitas', 'qr_sessoes'];
    $data = [];
    foreach ($tables as $table) {
        $stmt = $pdo->query("SELECT * FROM $table ORDER BY created_at DESC");
        $data[$table] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    echo json_encode($data);
    exit;
}

$input = file_get_contents('php://input');
$dados = json_decode($input, true);

if (!$dados) {
    http_response_code(400);
    echo json_encode(['erro' => 'Dados inválidos']);
    exit;
}

$response = ['sucesso' => false];

if (isset($dados['acao'])) {
    $acao = $dados['acao'];
    
    if ($acao === 'criar_sessao') {
        $token = $dados['token'] ?? strtoupper(bin2hex(random_bytes(4)));
        $urlAprovacao = $dados['urlAprovacao'] ?? '';
        
        $stmt = $pdo->prepare('INSERT INTO qr_sessoes (token, status, urlAprovacao, created) VALUES (?, ?, ?, ?)');
        $stmt->execute([$token, 'aguardando', $urlAprovacao, date('Y-m-d H:i:s')]);
        
        $response = ['sucesso' => true, 'token' => $token];
    }
    elseif ($acao === 'verificar_sessao') {
        $token = $dados['token'] ?? '';
        $stmt = $pdo->prepare('SELECT * FROM qr_sessoes WHERE token = ?');
        $stmt->execute([$token]);
        $sessao = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($sessao) {
            $response = $sessao;
        } else {
            $response = ['status' => 'nao_encontrada'];
        }
    }
    elseif ($acao === 'aprovar_sessao') {
        $token = $dados['token'] ?? '';
        $stmt = $pdo->prepare('UPDATE qr_sessoes SET status = ?, aprovadoEm = ? WHERE token = ? AND status = ?');
        $stmt->execute(['aprovado', date('Y-m-d H:i:s'), $token, 'aguardando']);
        
        $response = ['sucesso' => $stmt->rowCount() > 0];
    }
    elseif ($acao === 'negar_sessao') {
        $token = $dados['token'] ?? '';
        $stmt = $pdo->prepare('UPDATE qr_sessoes SET status = ?, negadoEm = ? WHERE token = ?');
        $stmt->execute(['negado', date('Y-m-d H:i:s'), $token]);
        
        $response = ['sucesso' => $stmt->rowCount() > 0];
    }
    elseif ($acao === 'limpar_sessoes') {
        $pdo->exec("DELETE FROM qr_sessoes WHERE created < datetime('now', '-1 minute') AND status = 'aguardando'");
        $response = ['sucesso' => true];
    }
    else {
        $response = ['erro' => 'Ação inválida'];
    }
    
    echo json_encode($response);
    exit;
}

$entities = ['agendamentos', 'servicos', 'clientes', 'receitas'];

foreach ($entities as $entity) {
    if (isset($dados[$entity]) && is_array($dados[$entity])) {
        foreach ($dados[$entity] as $item) {
            $id = $item['id'] ?? uniqid();
            $item['id'] = $id;
            $item['created_at'] = $item['created_at'] ?? date('Y-m-d H:i:s');
            
            $fields = array_keys($item);
            $set = array_map(fn($f) => "$f = :$f", $fields);
            $sql = "INSERT OR REPLACE INTO $entity (" . implode(', ', $fields) . ") VALUES (:" . implode(', :', $fields) . ")";
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute($item);
        }
    }
}

echo json_encode(['sucesso' => true]);
