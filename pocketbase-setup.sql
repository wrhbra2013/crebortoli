-- Criar collections para o sistema Cre Bortoli

-- Collection: agendamentos
CREATE TABLE IF NOT EXISTS agendamentos (
    id TEXT PRIMARY KEY,
    cliente TEXT,
    servico TEXT,
    servicoNome TEXT,
    data TEXT,
    hora TEXT,
    status TEXT DEFAULT 'pendente',
    valor REAL DEFAULT 0,
    pago INTEGER DEFAULT 0,
    localId TEXT,
    synced INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Collection: servicos
CREATE TABLE IF NOT EXISTS servicos (
    id TEXT PRIMARY KEY,
    nome TEXT,
    preco REAL,
    categoria TEXT,
    desconto TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Collection: clientes
CREATE TABLE IF NOT EXISTS clientes (
    id TEXT PRIMARY KEY,
    nome TEXT,
    telefone TEXT,
    email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Collection: receitas
CREATE TABLE IF NOT EXISTS receitas (
    id TEXT PRIMARY KEY,
    paciente TEXT,
    data TEXT,
    dataFormatada TEXT,
    pdfData TEXT,
    nomeArquivo TEXT,
    localId TEXT,
    synced INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Permissões públicas (ajuste conforme necessidade)
-- No PocketBase UI: Settings > API Rules > Collections > Each collection
-- List/View: "" (empty = public)
-- Create: "" (empty = public)
-- Update/Delete: "" (empty = public)
