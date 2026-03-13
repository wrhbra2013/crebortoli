from flask import Flask, render_template, request, jsonify, send_from_directory
import sqlite3
import os

app = Flask(__name__, template_folder='.', static_folder='static')
DB_NAME = 'crebortoli.db'

def init_db():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    
    c.execute('''CREATE TABLE IF NOT EXISTS clientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT,
        telefone TEXT NOT NULL,
        data_nascimento TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS servicos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        preco REAL DEFAULT 0,
        duracao INTEGER DEFAULT 30,
        descricao TEXT
    )''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS agenda (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente_id INTEGER,
        servico_id INTEGER,
        data TEXT NOT NULL,
        hora TEXT NOT NULL,
        status TEXT DEFAULT 'agendado',
        observacoes TEXT,
        FOREIGN KEY (cliente_id) REFERENCES clientes(id),
        FOREIGN KEY (servico_id) REFERENCES servicos(id)
    )''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS vendas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente_id INTEGER,
        servico_id INTEGER,
        valor REAL NOT NULL,
        data TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cliente_id) REFERENCES clientes(id),
        FOREIGN KEY (servico_id) REFERENCES servicos(id)
    )''')
    
    conn.commit()
    conn.close()

def dict_from_row(row, columns):
    return dict(zip(columns, row))

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/paginas/<path:filename>')
def paginas(filename):
    return send_from_directory('html/paginas', filename)

@app.route('/sig/<path:filename>')
def sig(filename):
    return send_from_directory('html/sig', filename)

@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)

@app.route('/<path:filename>')
def serve_file(filename):
    return send_from_directory('.', filename)

@app.route('/api/clientes', methods=['GET', 'POST'])
def api_clientes():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    if request.method == 'POST':
        data = request.json
        c.execute('INSERT INTO clientes (nome, email, telefone, data_nascimento) VALUES (?, ?, ?, ?)',
                  (data['nome'], data.get('email'), data['telefone'], data.get('data_nascimento')))
        conn.commit()
        cliente_id = c.lastrowid
        conn.close()
        return jsonify({'id': cliente_id, 'message': 'Cliente criado com sucesso'})
    
    c.execute('SELECT * FROM clientes ORDER BY nome')
    clientes = [dict(row) for row in c.fetchall()]
    conn.close()
    return jsonify(clientes)

@app.route('/api/clientes/<int:id>', methods=['GET', 'PUT', 'DELETE'])
def api_cliente(id):
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    if request.method == 'GET':
        c.execute('SELECT * FROM clientes WHERE id = ?', (id,))
        cliente = dict(c.fetchone())
        conn.close()
        return jsonify(cliente)
    
    if request.method == 'PUT':
        data = request.json
        c.execute('UPDATE clientes SET nome=?, email=?, telefone=?, data_nascimento=? WHERE id=?',
                  (data['nome'], data.get('email'), data['telefone'], data.get('data_nascimento'), id))
        conn.commit()
        conn.close()
        return jsonify({'message': 'Cliente atualizado'})
    
    if request.method == 'DELETE':
        c.execute('DELETE FROM clientes WHERE id = ?', (id,))
        conn.commit()
        conn.close()
        return jsonify({'message': 'Cliente deletado'})

@app.route('/api/servicos', methods=['GET', 'POST'])
def api_servicos():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    if request.method == 'POST':
        data = request.json
        c.execute('INSERT INTO servicos (nome, preco, duracao, descricao) VALUES (?, ?, ?, ?)',
                  (data['nome'], data.get('preco', 0), data.get('duracao', 30), data.get('descricao')))
        conn.commit()
        servico_id = c.lastrowid
        conn.close()
        return jsonify({'id': servico_id, 'message': 'Serviço criado com sucesso'})
    
    c.execute('SELECT * FROM servicos ORDER BY nome')
    servicos = [dict(row) for row in c.fetchall()]
    conn.close()
    return jsonify(servicos)

@app.route('/api/agenda', methods=['GET', 'POST'])
def api_agenda():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    if request.method == 'POST':
        data = request.json
        c.execute('INSERT INTO agenda (cliente_id, servico_id, data, hora, observacoes) VALUES (?, ?, ?, ?, ?)',
                  (data['cliente_id'], data['servico_id'], data['data'], data['hora'], data.get('observacoes')))
        conn.commit()
        agenda_id = c.lastrowid
        conn.close()
        return jsonify({'id': agenda_id, 'message': 'Agendamento criado com sucesso'})
    
    c.execute('''SELECT a.*, c.nome as cliente_nome, s.nome as servico_nome 
                FROM agenda a 
                LEFT JOIN clientes c ON a.cliente_id = c.id 
                LEFT JOIN servicos s ON a.servico_id = s.id 
                ORDER BY a.data, a.hora''')
    agenda = [dict(row) for row in c.fetchall()]
    conn.close()
    return jsonify(agenda)

@app.route('/api/vendas', methods=['GET', 'POST'])
def api_vendas():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    if request.method == 'POST':
        data = request.json
        c.execute('INSERT INTO vendas (cliente_id, servico_id, valor) VALUES (?, ?, ?)',
                  (data['cliente_id'], data['servico_id'], data['valor']))
        conn.commit()
        venda_id = c.lastrowid
        conn.close()
        return jsonify({'id': venda_id, 'message': 'Venda registrada com sucesso'})
    
    c.execute('''SELECT v.*, c.nome as cliente_nome, s.nome as servico_nome 
                FROM vendas v 
                LEFT JOIN clientes c ON v.cliente_id = c.id 
                LEFT JOIN servicos s ON v.servico_id = s.id 
                ORDER BY v.data DESC''')
    vendas = [dict(row) for row in c.fetchall()]
    conn.close()
    return jsonify(vendas)

@app.route('/api/dashboard')
def api_dashboard():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    
    c.execute('SELECT COUNT(*) FROM clientes')
    total_clientes = c.fetchone()[0]
    
    c.execute('SELECT COUNT(*) FROM agenda WHERE data >= date("now")')
    agendamentos_hoje = c.fetchone()[0]
    
    c.execute('SELECT COALESCE(SUM(valor), 0) FROM vendas WHERE date(data) = date("now")')
    vendas_hoje = c.fetchone()[0]
    
    c.execute('SELECT COALESCE(SUM(valor), 0) FROM vendas')
    total_vendas = c.fetchone()[0]
    
    conn.close()
    
    return jsonify({
        'total_clientes': total_clientes,
        'agendamentos_hoje': agendamentos_hoje,
        'vendas_hoje': vendas_hoje,
        'total_vendas': total_vendas
    })

if __name__ == '__main__':
    if not os.path.exists(DB_NAME):
        init_db()
        print(f'Banco de dados {DB_NAME} criado com sucesso!')
    
    app.run(debug=True, host='0.0.0.0', port=5000)
