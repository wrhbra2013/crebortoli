<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

$db = new SQLite3('database.sqlite');

$db->exec("CREATE TABLE IF NOT EXISTS agendamentos (
    id TEXT PRIMARY KEY, data TEXT, hora TEXT, nome TEXT, 
    whatsapp TEXT, servico TEXT, servico_id TEXT, valor REAL, 
    status TEXT, created_at TEXT, updated_at TEXT
)");

$db->exec("CREATE TABLE IF NOT EXISTS servicos (
    id TEXT PRIMARY KEY, nome TEXT, preco REAL, 
    categoria TEXT, desconto TEXT
)");

$db->exec("CREATE TABLE IF NOT EXISTS clientes (
    id TEXT PRIMARY KEY, nome TEXT, whatsapp TEXT, 
    email TEXT, created_at TEXT
)");

$db->exec("CREATE TABLE IF NOT EXISTS receitas (
    id TEXT PRIMARY KEY, data TEXT, valor REAL, 
    descricao TEXT, tipo TEXT, servico TEXT, cliente TEXT, 
    created_at TEXT
)");

$db->exec("CREATE TABLE IF NOT EXISTS contatos (
    id TEXT PRIMARY KEY, nome TEXT, email TEXT, 
    telefone TEXT, mensagem TEXT, lido INTEGER DEFAULT 0, 
    created_at TEXT
)");

$db->exec("CREATE TABLE IF NOT EXISTS vendas_servicos (
    id TEXT PRIMARY KEY, data TEXT, servico_id TEXT, 
    servico_nome TEXT, quantidade INTEGER, valor_unitario REAL, 
    valor_total REAL, cliente TEXT, created_at TEXT
)");

$db->exec("CREATE TABLE IF NOT EXISTS sessoes (
    id TEXT PRIMARY KEY, token TEXT, status TEXT, 
    ip TEXT, user_agent TEXT, created_at TEXT, expires_at TEXT, time_left INTEGER DEFAULT 60
));

$inserirServicosPadrao = $db->query("SELECT COUNT(*) as total FROM servicos");
$totalServicos = $inserirServicosPadrao->fetchArray(SQLITE3_ASSOC);

if ($totalServicos['total'] == 0) {
    $servicos = [
        ['dep_perna', 'Depilação Perna', 25, 'Depilação', ''],
        ['dep_virilha', 'Depilação Virilha Completa', 50, 'Depilação', ''],
        ['dep_buco', 'Depilação Buço', 15, 'Depilação', ''],
        ['dep_axilas', 'Depilação Axilas', 20, 'Depilação', ''],
        ['dep_pacote', 'Pacote Mensal Depilação', 90, 'Depilação', 'De R$110 por R$90'],
        ['barreira_cutanea', 'Reparação de Barreira Cutânea', 50, 'Tratamento', ''],
        ['limpeza_pele', 'Limpeza de Pele', 100, 'Tratamento', ''],
        ['massagem', 'Massagem Relaxante', 50, 'Massagem', '']
    ];
    
    $stmt = $db->prepare("INSERT OR REPLACE INTO servicos (id, nome, preco, categoria, desconto) VALUES (?, ?, ?, ?, ?)");
    foreach ($servicos as $s) {
        $stmt->bindValue(1, $s[0]);
        $stmt->bindValue(2, $s[1]);
        $stmt->bindValue(3, $s[2]);
        $stmt->bindValue(4, $s[3]);
        $stmt->bindValue(5, $s[4]);
        $stmt->execute();
    }
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

if ($method === 'OPTIONS') {
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    $input = $_POST;
}

function sanitize($value) {
    return is_array($value) ? array_map('sanitize', $value) : 
        (is_string($value) ? htmlspecialchars($value, ENT_QUOTES, 'UTF-8') : $value);
}

switch ($action) {
    case 'read':
        $table = preg_replace('/[^a-z_]/', '', $input['table'] ?? 'agendamentos');
        $allowedTables = ['agendamentos', 'servicos', 'clientes', 'receitas', 'contatos', 'vendas_servicos'];
        
        if (!in_array($table, $allowedTables)) {
            echo json_encode(['error' => 'Tabela inválida']);
            break;
        }
        
        $results = $db->query("SELECT * FROM $table ORDER BY created_at DESC");
        $data = [];
        while ($row = $results->fetchArray(SQLITE3_ASSOC)) {
            $data[] = array_map(fn($v) => $v === null ? '' : $v, $row);
        }
        echo json_encode($data);
        break;
        
    case 'write':
        $table = preg_replace('/[^a-z_]/', '', $input['table'] ?? 'agendamentos');
        $data = $input['data'] ?? [];
        $allowedTables = ['agendamentos', 'servicos', 'clientes', 'receitas', 'contatos', 'vendas_servicos'];
        
        if (!in_array($table, $allowedTables)) {
            echo json_encode(['error' => 'Tabela inválida']);
            break;
        }
        
        $data = sanitize($data);
        $data['id'] = $data['id'] ?? $table . '_' . time();
        $data['created_at'] = $data['created_at'] ?? date('c');
        
        $cols = array_keys($data);
        $vals = array_map(fn($v) => "'" . SQLite3::escapeString($v) . "'", array_values($data));
        
        $sql = "INSERT OR REPLACE INTO $table (" . implode(', ', $cols) . ") VALUES (" . implode(', ', $vals) . ")";
        $db->exec($sql);
        
        echo json_encode(['success' => true, 'id' => $data['id'], 'table' => $table]);
        break;
        
    case 'delete':
        $table = preg_replace('/[^a-z_]/', '', $input['table'] ?? 'agendamentos');
        $id = SQLite3::escapeString($input['id'] ?? '');
        $allowedTables = ['agendamentos', 'servicos', 'clientes', 'receitas', 'contatos', 'vendas_servicos'];
        
        if (!in_array($table, $allowedTables) || !$id) {
            echo json_encode(['error' => 'Parâmetros inválidos']);
            break;
        }
        
        $db->exec("DELETE FROM $table WHERE id = '$id'");
        echo json_encode(['success' => true]);
        break;
        
    case 'update':
        $table = preg_replace('/[^a-z_]/', '', $input['table'] ?? 'agendamentos');
        $id = SQLite3::escapeString($input['id'] ?? '');
        $data = sanitize($input['data'] ?? []);
        $allowedTables = ['agendamentos', 'servicos', 'clientes', 'receitas', 'contatos', 'vendas_servicos'];
        
        if (!in_array($table, $allowedTables) || !$id) {
            echo json_encode(['error' => 'Parâmetros inválidos']);
            break;
        }
        
        $data['updated_at'] = date('c');
        $sets = [];
        foreach ($data as $key => $val) {
            $sets[] = "$key = '" . SQLite3::escapeString($val) . "'";
        }
        
        $sql = "UPDATE $table SET " . implode(', ', $sets) . " WHERE id = '$id'";
        $db->exec($sql);
        
        echo json_encode(['success' => true]);
        break;
        
    case 'status':
        echo json_encode([
            'status' => 'ok',
            'database' => file_exists('database.sqlite') ? 'exists' : 'created',
            'tables' => ['agendamentos', 'servicos', 'clientes', 'receitas', 'contatos', 'vendas_servicos', 'sessoes']
        ]);
        break;
        
    case 'criar_sessao':
        $token = SQLite3::escapeString($input['token'] ?? '');
        $urlAprovacao = SQLite3::escapeString($input['urlAprovacao'] ?? '');
        
        if (!$token) {
            echo json_encode(['sucesso' => false, 'erro' => 'Token inválido']);
            break;
        }
        
        $sessaoId = 'sessao_' . time();
        $expiresAt = date('c', strtotime('+2 minutes'));
        
        $db->exec("INSERT INTO sessoes (id, token, status, created_at, expires_at) VALUES ('$sessaoId', '$token', 'aguardando', NOW(), '$expiresAt')");
        
        echo json_encode(['sucesso' => true, 'sessaoId' => $sessaoId, 'token' => $token]);
        break;
        
    case 'verificar_sessao':
        $token = SQLite3::escapeString($input['token'] ?? '');
        
        if (!$token) {
            echo json_encode(['status' => 'invalid']);
            break;
        }
        
        $result = $db->query("SELECT status FROM sessoes WHERE token = '$token' ORDER BY created_at DESC LIMIT 1");
        $sessao = $result->fetchArray(SQLITE3_ASSOC);
        
        if ($sessao) {
            echo json_encode(['status' => $sessao['status']]);
        } else {
            echo json_encode(['status' => 'inexistente']);
        }
        break;
        
    case 'aprovar_sessao':
        $token = SQLite3::escapeString($input['token'] ?? '');
        
        if (!$token) {
            echo json_encode(['sucesso' => false]);
            break;
        }
        
        $db->exec("UPDATE sessoes SET status = 'aprovado' WHERE token = '$token'");
        
        echo json_encode(['sucesso' => true]);
        break;
        
    case 'negar_sessao':
        $token = SQLite3::escapeString($input['token'] ?? '');
        
        if (!$token) {
            echo json_encode(['sucesso' => false]);
            break;
        }
        
        $db->exec("UPDATE sessoes SET status = 'negado' WHERE token = '$token'");
        
        echo json_encode(['sucesso' => true]);
        break;
        
    case 'sync_timer':
        $token = SQLite3::escapeString($input['token'] ?? '');
        $timeLeft = intval($input['timeLeft'] ?? 60);
        
        if (!$token) {
            echo json_encode(['sucesso' => false]);
            break;
        }
        
        $db->exec("UPDATE sessoes SET time_left = $timeLeft WHERE token = '$token'");
        
        echo json_encode(['sucesso' => true]);
        break;
        
    case 'get_timer':
        $token = SQLite3::escapeString($input['token'] ?? '');
        
        if (!$token) {
            echo json_encode(['timeLeft' => 60]);
            break;
        }
        
        $result = $db->query("SELECT time_left FROM sessoes WHERE token = '$token' ORDER BY created_at DESC LIMIT 1");
        $sessao = $result->fetchArray(SQLITE3_ASSOC);
        
        if ($sessao && $sessao['time_left']) {
            echo json_encode(['timeLeft' => intval($sessao['time_left'])]);
        } else {
            echo json_encode(['timeLeft' => 60]);
        }
        break;
        
    default:
        echo json_encode(['error' => 'Ação inválida. Use: ?action=read, write, delete, update ou status']);
}
?>
