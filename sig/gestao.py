# /home/wander/crebortoli/sig/gestao.py
from flask import (
    Blueprint, render_template, redirect, url_for, request, flash, session, current_app
)
from datetime import timedelta
from functools import wraps
import qrcode
from .form import *
import sqlite3  # Importado para capturar erros específicos do DB
from init_db import DB_FILE  # Import the DB_FILE constant


# ==============================================================================
# CONFIGURAÇÃO DO BLUEPRINT E CONSTANTES
# ================================================================
#
app_gestao = Blueprint('sig', __name__, url_prefix='/sig', template_folder='templates')

# BOA PRÁTICA: Centralizar constantes e configurações
ALLOWED_TABLES_FOR_DELETE = {
    'clientes', 'compras', 'vendas_servicos', 'vendas_produtos', 'colaboradores',
    'impostos', 'insumos', 'depreciacao', 'margem', 'markup', 'relatorioMEI'
}


# ==============================================================================
# DECORADOR DE AUTENTICAÇÃO (MELHORIA DE SEGURANÇA E DRY)
# ==============================================================================

def login_required(f):
    """
    Garante que o usuário esteja logado antes de acessar uma rota.
    Substitui a verificação manual 'if not session.get("logged_in")' em cada rota.
    """
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
    return render_template('sig/error.html', e=e), 404


@app_gestao.before_request
def make_session_permanent():
    session.permanent = True
    # Aumentado para 30 minutos de inatividade
    app_gestao.permanent_session_lifetime = timedelta(minutes=30)


# ==============================================================================
# FUNÇÕES DE BANCO DE DADOS (Refatoradas para Segurança e Clareza)
# ==============================================================================

def get_connection():  # New function to get a database connection
    return sqlite3.connect(DB_FILE, check_same_thread=False)


def db_insert(sql, params):
    """Função genérica para inserções no banco de dados."""
    with get_connection() as conn:  # Use a context manager for the connection
        cur = conn.cursor()
        cur.execute(sql, params)
        conn.commit()


def db_fetch_all(sql, params=()):
    """Função genérica para buscar múltiplos registros."""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(sql, params)
        return cur.fetchall()


def get_table_headers(cursor):
    """Obtém os nomes das colunas da última query executada."""
    return [desc[0] for desc in cursor.description]


# --- Funções Específicas ---

def get_clientes(search_term=""):
    sql = "SELECT id, nome, email, telefone, STRFTIME('%d/%m/%Y', Ultima_Atualizacao) FROM clientes WHERE nome LIKE ? ORDER BY nome;"
    registros = db_fetch_all(sql, ('%' + search_term + '%',))
    with get_connection() as conn:  # You need a cursor to get headers
        cur = conn.cursor()
        cur.execute(sql, ('%' + search_term + '%',))  # Re-execute to populate cursor.description
        cabecalho = get_table_headers(cur)
    return registros, cabecalho


def get_compras(search_term=""):
    sql = "SELECT * FROM compras WHERE Produto LIKE ? ORDER BY id DESC;"
    registros = db_fetch_all(sql, ('%' + search_term + '%',))
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(sql, ('%' + search_term + '%',))
        cabecalho = get_table_headers(cur)
    return registros, cabecalho


def delete_record_by_id(table_name, record_id):
    """Função segura para deletar um registro de uma tabela permitida pelo ID."""
    if table_name not in ALLOWED_TABLES_FOR_DELETE:
        raise ValueError(f"A exclusão na tabela '{table_name}' não é permitida.")

    sql = f"DELETE FROM {table_name} WHERE id = ?;"
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(sql, (record_id,))
        conn.commit()


# ==============================================================================
# ROTAS DE AUTENTICAÇÃO E PÁGINA PRINCIPAL
# ==============================================================================

# /home/wander/crebortoli/sig/gestao.py

@app_gestao.route('/login', methods=['GET', 'POST'])
def login():
    # CORRECTION 1: If the user is already logged in, send them to the dashboard.
    if session.get('logged_in'):
        return redirect(url_for('sig.dashboard'))

    senha_correta = current_app.config.get('ADMIN_PASSWORD', 'CreBortoli2023')
    form = Login()
    if form.validate_on_submit():
        if form.senha.data == senha_correta:
            session['logged_in'] = True
            flash('Login bem-sucedido!', 'success')
            # CORRECTION 2: Redirect to the correct dashboard endpoint after a successful login.
            return redirect(url_for('sig.dashboard'))
        else:
            flash('Token Incorreto!', 'danger')

    # The render_template should be outside the 'if form.validate_on_submit()' block
    # to handle the initial GET request and failed login attempts.
    return render_template('sig/login.html', form=form)


@app_gestao.route('/logout')
@login_required
def logout():
    session.pop('logged_in', None)
    flash('Você foi desconectado com segurança.', 'info')
    return redirect(url_for('sig.login'))

# /home/wander/crebortoli/sig/gestao.py



@app_gestao.route('/dashboard', methods=['GET'])
@login_required
def dashboard():
    """
    The main view for the admin area after a user logs in.
    """
    total_clientes = 0
    total_vendas_mes = 0.0  # Initialize as a float

    try:
        with get_connection() as conn:
            cur = conn.cursor()
            
            # Fetch total clients
            total_clientes_result = cur.execute("SELECT COUNT(*) FROM clientes").fetchone()
            if total_clientes_result:
                total_clientes = total_clientes_result[0]

            # CORRECTED QUERY: Use 'Ultima_Atualizacao' instead of 'data_venda'
            sql_vendas = """
                SELECT SUM(Preco_aVista) 
                FROM vendas_produtos 
                WHERE strftime('%Y-%m', Ultima_Atualizacao) = strftime('%Y-%m', 'now')
            """
            total_vendas_result = cur.execute(sql_vendas).fetchone()
            
            # Safely assign the value, defaulting to 0.0 if it's None
            if total_vendas_result and total_vendas_result[0] is not None:
                total_vendas_mes = total_vendas_result[0]

    except sqlite3.Error as e:
        flash(f"Ocorreu um erro ao buscar os dados do dashboard: {e}", "danger")

    # Pass data to the template
    return render_template('sig/sig.html',
                           total_clientes=total_clientes,
                           total_vendas_mes=total_vendas_mes)




# ==============================================================================
# ROTAS DE CADASTRO (POST)
# ==============================================================================

@app_gestao.route('/clientes/novo', methods=['GET', 'POST'])
@login_required
def post_clientes():
    form = cadClientes()
    if form.validate_on_submit():
        try:
            sql = "INSERT INTO clientes (nome, cpf, email, telefone) VALUES (?, ?, ?, ?);"
            params = (form.nome.data, form.cpf.data, form.email.data, form.telefone.data)
            db_insert(sql, params)
            flash('Cliente cadastrado com sucesso!', 'success')
            return redirect(url_for('sig.post_clientes'))
        except sqlite3.IntegrityError:
            flash('Erro: Já existe um cliente com este CPF ou e-mail.', 'danger')
        except Exception as e:
            flash(f'Ocorreu um erro inesperado: {e}', 'danger')
    return render_template('sig/postclientes.html', form=form)


@app_gestao.route('/anaminese/nova', methods=['GET', 'POST'])
@login_required
def post_anaminese():
    form = formAnaminese()
    if form.validate_on_submit():
        try:
            # CORREÇÃO: A query SQL deve listar todas as colunas explicitamente.
            sql = """
                INSERT INTO anaminese (
                    nome, nascimento, profissao, endereco, telefone, indicacao,
                    queixa_principal, alergia_medicamentos, alergia_aspirina,
                    tratamentos_medicos, cirurgia, uso_medicamentos, proteses,
                    doencas_familiares, diabetes, pressao, doenca_renal, epilepsia,
                    menstruacao, gestacao, tratamento_estetico, uso_cosmeticos,
                    filtro_solar, bronzeamento, observacoes, assinatura, cpf
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """
            # CORREÇÃO: Os dados devem ser passados como uma tupla na ordem correta.
            params = (
                form.nome.data, form.nascimento.data, form.profissao.data, form.endereco.data,
                form.telefone.data, form.indicacao.data, form.queixa_principal.data,
                form.alergia_medicamentos.data, form.alergia_aspirina.data,
                form.tratamentos_medicos.data, form.cirurgias.data, form.medicamentos.data,
                form.proteses.data, form.gene.data, form.diabetes.data, form.pressao.data,
                form.doenca_renal.data, form.epilepsia.data, form.menstruacao.data,
                form.gestante.data, form.tratamento_estetico.data, form.cosmeticos.data,
                form.filtro_solar.data, form.bronzeamento.data, form.obs.data,
                form.assinatura.data, form.documento.data
            )
            db_insert(sql, params)
            flash('Ficha de Anamnese registrada com sucesso!', 'success')
            return redirect(url_for('sig.post_anaminese'))
        except Exception as e:
            flash(f'Erro ao registrar ficha: {e}', 'danger')
    return render_template('sig/anaminese.html', form=form)


# ==============================================================================
# ROTAS DE VISUALIZAÇÃO E EXCLUSÃO (GET, DELETE)
# ==============================================================================

@app_gestao.route('/delete/<string:table_name>/<int:record_id>', methods=['POST'])
@login_required
def delete_record(table_name, record_id):
    form = formDelete()
    if form.validate_on_submit():
        try:
            delete_record_by_id(table_name, record_id)
            flash(f'Registro {record_id} da tabela {table_name} deletado com sucesso!', 'success')
        except ValueError as e:
            flash(str(e), 'danger')
        except Exception as e:
            flash(f'Erro ao deletar registro: {e}', 'danger')

    return redirect(request.referrer or url_for('sig.dashboard'))


@app_gestao.route('/tabela/<string:table_name>')
@login_required
def view_table(table_name):
    """
    ROTA DINÂMICA: Substitui as 11 rotas de tabela anteriores.
    """
    table_map = {
        'clientes': {
            'get_func': get_clientes,
            'template': 'getclientes.html',
            'title': 'Clientes'
        },
        'compras': {
            'get_func': get_compras,
            'template': 'compras.html',
            'title': 'Compras'
        },
    }

    config = table_map.get(table_name)
    if not config:
        return render_template('sig/error.html', e=f"Tabela '{table_name}' não encontrada ou não configurada."), 404

    try:
        search_term = request.args.get('q', '')
        dados, cabecalho = config['get_func'](search_term)
        form_pesquisa = formClientes()

        return render_template(
            f'sig/{config["template"]}',
            dados=dados,
            cabecalho=cabecalho,
            titulo=config['title'],
            form_pesquisa=form_pesquisa
        )
    except Exception as e:
        flash(f"Erro ao carregar dados da tabela '{table_name}': {e}", "danger")
        return render_template('sig/error.html', e=e)


@app_gestao.route('/nota')
@login_required
def nota():
    return render_template('sig/nota.html')
