# /home/wander/crebortoli/sig/gestao.py

from flask import (
    Blueprint, render_template, redirect, url_for, request, flash, session, current_app, abort
)
from datetime import timedelta, date
from functools import wraps
import sqlite3
from init_db import DB_FILE

# Importa todos os formulários padronizados do form.py
from .form import *

# ==============================================================================
# CONFIGURAÇÃO DO BLUEPRINT
# ==============================================================================
app_gestao = Blueprint('sig', __name__, url_prefix='/sig', template_folder='templates')

# ==============================================================================
# DECORADOR DE AUTENTICAÇÃO
# ==============================================================================
def login_required(f):
    """Garante que o usuário esteja logado antes de acessar uma rota."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('logged_in'):
            flash('Você precisa estar logado para acessar esta página.', 'warning')
            return redirect(url_for('sig.login'))
        return f(*args, **kwargs)
    return decorated_function

# ==============================================================================
# CONFIGURAÇÕES GERAIS DO BLUEPRINT
# ==============================================================================
@app_gestao.errorhandler(404)
def page_not_found(e):
    """Renderiza uma página de erro 404 personalizada."""
    return render_template('sig/error.html', error_code=404, error_message="Página não encontrada"), 404

@app_gestao.before_request
def make_session_permanent():
    """Define a sessão como permanente com um tempo de vida de 30 minutos."""
    session.permanent = True
    app_gestao.permanent_session_lifetime = timedelta(minutes=30)

# ==============================================================================
# FUNÇÕES DE BANCO DE DADOS (Refatoradas e Otimizadas)
# ==============================================================================
def get_connection():
    """Cria e retorna uma nova conexão com o banco de dados."""
    return sqlite3.connect(DB_FILE)

def db_execute(sql, params=(), commit=False):
    """Função genérica para executar comandos SQL (INSERT, UPDATE, DELETE)."""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(sql, params)
        if commit:
            conn.commit()

def db_fetch(sql, params=(), one=False):
    """Função genérica para buscar dados (SELECT), retornando dados e cabeçalhos."""
    with get_connection() as conn:
        conn.row_factory = sqlite3.Row  # Permite acesso por nome de coluna
        cur = conn.cursor()
        cur.execute(sql, params)
        headers = [desc[0] for desc in cur.description] if cur.description else []
        result = cur.fetchone() if one else cur.fetchall()
        return result, headers

# --- Funções de Consulta Específicas ---
def get_table_data(get_func, search_term=""):
    """Wrapper para obter dados e cabeçalhos de uma função de consulta."""
    return get_func(search_term)

def get_clientes(search_term=""):
    sql = "SELECT id, nome, email, telefone, STRFTIME('%d/%m/%Y', Ultima_Atualizacao) as 'Atualizado em' FROM clientes WHERE nome LIKE ? ORDER BY nome;"
    return db_fetch(sql, ('%' + search_term + '%',))

def get_compras(search_term=""):
    sql = "SELECT id, Produto, Marca, Quantidade, Preco_Unitario, STRFTIME('%d/%m/%Y', Validade) as Validade FROM compras WHERE Produto LIKE ? ORDER BY id DESC;"
    return db_fetch(sql, ('%' + search_term + '%',))

def get_vendas_servicos(search_term=""):
    sql = "SELECT id, Cliente, Servico, Preco_Final, STRFTIME('%d/%m/%Y', Ultima_Atualizacao) as 'Realizada em' FROM vendas_servicos WHERE Cliente LIKE ? ORDER BY id DESC;"
    return db_fetch(sql, ('%' + search_term + '%',))

def get_vendas_produtos(search_term=""):
    sql = "SELECT id, Cliente, Produto, Preco_Final, STRFTIME('%d/%m/%Y', Ultima_Atualizacao) as 'Realizada em' FROM vendas_produtos WHERE Cliente LIKE ? ORDER BY id DESC;"
    return db_fetch(sql, ('%' + search_term + '%',))

def get_relatorioMEI(search_term=""):
    sql = "SELECT id, Apuracao, Total_Geral_Receitas, Data FROM relatorioMEI WHERE Apuracao LIKE ? ORDER BY Apuracao DESC;"
    return db_fetch(sql, ('%' + search_term + '%',))

def delete_record_by_id(table_name, record_id):
    """Função segura para deletar um registro de uma tabela permitida."""
    allowed_tables = {
        'clientes', 'compras', 'vendas_servicos', 'vendas_produtos', 'colaboradores',
        'impostos', 'insumos', 'depreciacao', 'margem', 'markup', 'relatorioMEI'
    }
    if table_name not in allowed_tables:
        raise ValueError(f"A exclusão na tabela '{table_name}' não é permitida.")
    sql = f"DELETE FROM {table_name} WHERE id = ?;"
    db_execute(sql, (record_id,), commit=True)

# ==============================================================================
# ROTAS DE AUTENTICAÇÃO E DASHBOARD
# ==============================================================================
@app_gestao.route('/login', methods=['GET', 'POST'])
def login():
    if session.get('logged_in'):
        return redirect(url_for('sig.dashboard'))

    form = LoginForm()
    if form.validate_on_submit():
        senha_correta = current_app.config.get('ADMIN_PASSWORD', 'CreBortoli2023')
        if form.senha.data == senha_correta:
            session['logged_in'] = True
            flash('Login bem-sucedido!', 'success')
            return redirect(url_for('sig.dashboard'))
        else:
            flash('Token Incorreto!', 'danger')
    return render_template('sig/login.html', form=form)

@app_gestao.route('/logout')
@login_required
def logout():
    session.pop('logged_in', None)
    flash('Você foi desconectado com segurança.', 'info')
    return redirect(url_for('sig.login'))

@app_gestao.route('/dashboard')
@login_required
def dashboard():
    """Painel principal do SIG com KPIs (Key Performance Indicators)."""
    try:
        # Busca total de clientes
        total_clientes, _ = db_fetch("SELECT COUNT(id) FROM clientes;", one=True)
        
        # Busca vendas e custos do mês atual
        current_month = date.today().strftime('%Y-%m')
        vendas_mes, _ = db_fetch("SELECT SUM(Preco_Final) FROM vendas_servicos WHERE strftime('%Y-%m', Ultima_Atualizacao) = ?;", (current_month,), one=True)
        compras_mes, _ = db_fetch("SELECT SUM(Preco_Unitario * Quantidade) FROM compras WHERE strftime('%Y-%m', Ultima_Atualizacao) = ?;", (current_month,), one=True)

        # Garante que os valores não sejam None
        total_clientes = total_clientes[0] if total_clientes else 0
        total_vendas_mes = vendas_mes[0] if vendas_mes and vendas_mes[0] else 0.0
        total_compras_mes = compras_mes[0] if compras_mes and compras_mes[0] else 0.0
        lucro_mes = total_vendas_mes - total_compras_mes

    except sqlite3.Error as e:
        flash(f"Ocorreu um erro ao buscar os dados do dashboard: {e}", "danger")
        total_clientes, total_vendas_mes, total_compras_mes, lucro_mes = 0, 0.0, 0.0, 0.0

    return render_template('sig/sig.html',
                        total_clientes=total_clientes,
                        total_vendas_mes=total_vendas_mes,
                        total_compras_mes=total_compras_mes,
                        lucro_mes=lucro_mes)

# ==============================================================================
# ROTA DINÂMICA PARA VISUALIZAÇÃO DE TABELAS (GET)
# ==============================================================================
@app_gestao.route('/tabela/<string:table_name>')
@login_required
def view_table(table_name):
    """Rota dinâmica que substitui múltiplas rotas de visualização."""
    table_map = {
        'clientes': {'get_func': get_clientes, 'template': 'view_table.html', 'title': 'Clientes'},
        'compras': {'get_func': get_compras, 'template': 'view_table.html', 'title': 'Histórico de Compras'},
        'vendas_servicos': {'get_func': get_vendas_servicos, 'template': 'view_table.html', 'title': 'Vendas de Serviços'},
        'vendas_produtos': {'get_func': get_vendas_produtos, 'template': 'view_table.html', 'title': 'Vendas de Produtos'},
        'relatorioMEI': {'get_func': get_relatorioMEI, 'template': 'view_table.html', 'title': 'Relatórios MEI'}
    }
    config = table_map.get(table_name)
    if not config:
        abort(404)

    form_pesquisa = SearchForm()
    search_term = request.args.get('query', '')

    if form_pesquisa.validate_on_submit():
        search_term = form_pesquisa.query.data
        return redirect(url_for('sig.view_table', table_name=table_name, query=search_term))

    try:
        dados, cabecalho = get_table_data(config['get_func'], search_term)
        return render_template(
            f'sig/{config["template"]}',
            dados=dados,
            cabecalho=cabecalho,
            titulo=config['title'],
            form_pesquisa=form_pesquisa,
            table_name=table_name
        )
    except Exception as e:
        flash(f"Erro ao carregar dados da tabela '{table_name}': {e}", "danger")
        return redirect(url_for('sig.dashboard'))

# ==============================================================================
# ROTA PARA EXCLUSÃO (POST)
# ==============================================================================
@app_gestao.route('/delete/<string:table_name>/<int:record_id>', methods=['POST'])
@login_required
def delete_record(table_name, record_id):
    form = DeleteForm()
    if form.validate_on_submit():
        try:
            delete_record_by_id(table_name, record_id)
            flash('Registro deletado com sucesso!', 'success')
        except ValueError as e:
            flash(str(e), 'danger')
        except Exception as e:
            flash(f'Erro ao deletar registro: {e}', 'danger')
    return redirect(request.referrer or url_for('sig.dashboard'))

# ==============================================================================
# ROTAS DE CADASTRO (Nomes e Formulários Padronizados)
# ==============================================================================
# Note: As rotas foram renomeadas para 'cadastrar_*' para maior clareza.
# Os nomes dos formulários foram atualizados para os nomes padronizados em form.py.

@app_gestao.route('/cadastrar/cliente', methods=['GET', 'POST'])
@login_required
def cadastrar_cliente():
    form = ClienteForm()
    if form.validate_on_submit():
        try:
            sql = "INSERT INTO clientes (nome, cpf, email, telefone) VALUES (?, ?, ?, ?);"
            params = (form.nome.data, form.cpf.data, form.email.data, form.telefone.data)
            db_execute(sql, params, commit=True)
            flash('Cliente cadastrado com sucesso!', 'success')
            return redirect(url_for('sig.cadastrar_cliente'))
        except sqlite3.IntegrityError:
            flash('Erro: Já existe um cliente com este CPF ou e-mail.', 'danger')
        except Exception as e:
            flash(f'Ocorreu um erro inesperado: {e}', 'danger')
    return render_template('sig/postclientes.html', form=form, titulo="Cadastrar Cliente")

@app_gestao.route('/cadastrar/compra', methods=['GET', 'POST'])
@login_required
def cadastrar_compra():
    form = CompraForm()
    if form.validate_on_submit():
        try:
            sql = "INSERT INTO compras (Produto, Marca, Quantidade, Unidade, Validade, Preco_Unitario) VALUES (?, ?, ?, ?, ?, ?);"
            params = (form.produto.data, form.marca.data, form.quantidade.data, form.unidade.data, form.validade.data, form.preco.data)
            db_execute(sql, params, commit=True)
            flash('Compra registrada com sucesso!', 'success')
            return redirect(url_for('sig.cadastrar_compra'))
        except Exception as e:
            flash(f'Erro ao registrar compra: {e}', 'danger')
    return render_template('sig/compras.html', form=form, titulo="Registrar Compra")

# ... (outras rotas de cadastro como 'vendas_servicos', 'colaboradores', etc. seguiriam o mesmo padrão) ...
# Exemplo:
@app_gestao.route('/cadastrar/venda_servico', methods=['GET', 'POST'])
@login_required
def cadastrar_venda_servico():
    form = VendaServicoForm()
    if form.validate_on_submit():
        try:
            # Lógica para inserir no banco de dados
            flash('Venda de serviço registrada com sucesso!', 'success')
            return redirect(url_for('sig.cadastrar_venda_servico'))
        except Exception as e:
            flash(f'Erro ao registrar venda: {e}', 'danger')
    return render_template('sig/vendas_servicos.html', form=form, titulo="Registrar Venda de Serviço")
