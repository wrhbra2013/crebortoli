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

$sessaoFile = __DIR__ . '/sessoes.json';

function lerSessoes() {
    global $sessaoFile;
    if (!file_exists($sessaoFile)) {
        return [];
    }
    $conteudo = file_get_contents($sessaoFile);
    return json_decode($conteudo, true) ?: [];
}

function salvarSessoes($sessoes) {
    global $sessaoFile;
    $json = json_encode($sessoes, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    return file_put_contents($sessaoFile, $json) !== false;
}

function gerarTokenSessao() {
    $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    $token = '';
    for ($i = 0; $i < 8; $i++) {
        $token .= $chars[rand(0, strlen($chars) - 1)];
    }
    return $token;
}

$input = file_get_contents('php://input');
$dadosRecebidos = json_decode($input, true);

if (!$dadosRecebidos && isset($_GET['acao'])) {
    if ($_GET['acao'] === 'criar_sessao') {
        $token = gerarTokenSessao();
        $sessoes = lerSessoes();
        $sessoes[$token] = [
            'token' => $token,
            'status' => 'aguardando',
            'criadoEm' => time()
        ];
        salvarSessoes($sessoes);
        echo json_encode(['sucesso' => true, 'token' => $token]);
        exit;
    }
    
    if ($_GET['acao'] === 'verificar_sessao' && isset($_GET['token'])) {
        $sessoes = lerSessoes();
        $token = $_GET['token'];
        if (isset($sessoes[$token])) {
            $sessao = $sessoes[$token];
            if ($sessao['status'] === 'aprovado') {
                echo json_encode(['sucesso' => true, 'status' => 'aprovado']);
            } elseif ($sessao['status'] === 'negado') {
                echo json_encode(['sucesso' => true, 'status' => 'negado']);
            } else {
                echo json_encode(['sucesso' => true, 'status' => 'aguardando']);
            }
        } else {
            http_response_code(404);
            echo json_encode(['erro' => 'Sessão não encontrada']);
        }
        exit;
    }
}

if ($dadosRecebidos && isset($dadosRecebidos['acao'])) {
    if ($dadosRecebidos['acao'] === 'aprovar_codigo') {
        $codigo = strtoupper(trim($dadosRecebidos['codigo'] ?? ''));
        $sessoes = lerSessoes();
        
        if (empty($codigo)) {
            http_response_code(400);
            echo json_encode(['sucesso' => false, 'erro' => 'Código não fornecido']);
            exit;
        }
        
        if (!isset($sessoes[$codigo])) {
            http_response_code(404);
            echo json_encode(['sucesso' => false, 'erro' => 'Código inválido ou expirado']);
            exit;
        }
        
        $sessao = $sessoes[$codigo];
        if ($sessao['status'] !== 'aguardando') {
            http_response_code(400);
            echo json_encode(['sucesso' => false, 'erro' => 'Esta sessão já foi processada']);
            exit;
        }
        
        $sessoes[$codigo]['status'] = 'aprovado';
        $sessoes[$codigo]['aprovadoEm'] = time();
        salvarSessoes($sessoes);
        
        echo json_encode(['sucesso' => true, 'mensagem' => 'Login aprovado']);
        exit;
    }
    
    if ($dadosRecebidos['acao'] === 'negar_codigo') {
        $codigo = strtoupper(trim($dadosRecebidos['codigo'] ?? ''));
        $sessoes = lerSessoes();
        
        if (empty($codigo)) {
            http_response_code(400);
            echo json_encode(['sucesso' => false, 'erro' => 'Código não fornecido']);
            exit;
        }
        
        if (!isset($sessoes[$codigo])) {
            http_response_code(404);
            echo json_encode(['sucesso' => false, 'erro' => 'Código inválido ou expirado']);
            exit;
        }
        
        $sessoes[$codigo]['status'] = 'negado';
        $sessoes[$codigo]['negadoEm'] = time();
        salvarSessoes($sessoes);
        
        echo json_encode(['sucesso' => true, 'mensagem' => 'Login negado']);
        exit;
    }
}

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
