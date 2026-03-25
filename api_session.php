<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$SESSION_FILE = __DIR__ . '/session.json';
chmod($SESSION_FILE, 0644);

function lerSessao() {
    global $SESSION_FILE;
    if (!file_exists($SESSION_FILE)) {
        return [];
    }
    $conteudo = file_get_contents($SESSION_FILE);
    return json_decode($conteudo, true) ?: [];
}

function salvarSessao($sessao) {
    global $SESSION_FILE;
    $json = json_encode($sessao, JSON_PRETTY_PRINT);
    return file_put_contents($SESSION_FILE, $json) !== false;
}

function gerarToken() {
    $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    $token = '';
    for ($i = 0; $i < 8; $i++) {
        $token .= $chars[random_int(0, strlen($chars) - 1)];
    }
    return $token;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $token = $_GET['token'] ?? '';
    $sessoes = lerSessao();
    
    if ($token && isset($sessoes[$token])) {
        echo json_encode($sessoes[$token]);
    } else {
        echo json_encode(['erro' => 'Sessão não encontrada ou expirada']);
    }
    exit;
}

$input = file_get_contents('php://input');
$dados = json_decode($input, true);

if (!$dados || !isset($dados['acao'])) {
    http_response_code(400);
    echo json_encode(['erro' => 'Ação não especificada']);
    exit;
}

$sessoes = lerSessao();
$acao = $dados['acao'];

switch ($acao) {
    case 'criar':
        $token = gerarToken();
        $sessoes[$token] = [
            'token' => $token,
            'criadoEm' => time(),
            'status' => 'aguardando',
            'urlAprovacao' => $dados['urlAprovacao'] ?? ''
        ];
        salvarSessao($sessoes);
        echo json_encode(['token' => $token, 'status' => 'aguardando']);
        break;
        
    case 'verificar':
        $token = $dados['token'] ?? '';
        if ($token && isset($sessoes[$token])) {
            $sessao = $sessoes[$token];
            if ($sessao['status'] === 'aprovado') {
                unset($sessoes[$token]);
                salvarSessao($sessoes);
            }
            echo json_encode(['status' => $sessao['status']]);
        } else {
            echo json_encode(['status' => 'nao_encontrada']);
        }
        break;
        
    case 'aprovar':
        $token = $dados['token'] ?? '';
        if ($token && isset($sessoes[$token]) && $sessoes[$token]['status'] === 'aguardando') {
            $sessoes[$token]['status'] = 'aprovado';
            $sessoes[$token]['aprovadoEm'] = time();
            salvarSessao($sessoes);
            echo json_encode(['sucesso' => true]);
        } else {
            http_response_code(400);
            echo json_encode(['erro' => 'Sessão não encontrada ou já processada']);
        }
        break;
        
    case 'negar':
        $token = $dados['token'] ?? '';
        if ($token && isset($sessoes[$token])) {
            $sessoes[$token]['status'] = 'negado';
            $sessoes[$token]['negadoEm'] = time();
            salvarSessao($sessoes);
            echo json_encode(['sucesso' => true]);
        } else {
            http_response_code(400);
            echo json_encode(['erro' => 'Sessão não encontrada']);
        }
        break;
        
    default:
        http_response_code(400);
        echo json_encode(['erro' => 'Ação inválida']);
}

function limparSessoesExpiradas() {
    global $SESSION_FILE;
    $sessoes = lerSessao();
    $agora = time();
    $novas = [];
    
    foreach ($sessoes as $token => $sessao) {
        $idade = $agora - $sessao['criadoEm'];
        if ($idade < 600) {
            $novas[$token] = $sessao;
        }
    }
    
    salvarSessao($novas);
}

limparSessoesExpiradas();
