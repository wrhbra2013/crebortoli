from flask import (Blueprint, render_template, redirect, url_for, request, flash, session, current_app, abort)
from datetime import timedelta, date
from functools import wraps
import psycopg2
from psycopg2.extras import DictCursor
from init_db import get_connection

# Importa todos os formulários padronizados do form.py
from .form import *

#==============================================================================
# CONFIGURAÇÃO DO BLUEPRINT
# ==============================================================================
app_gestao = Blueprint('sig', __name__, url_prefix='/sig', template_folder='templates')

# ==============================================================================
# DECORADOR DE AUTENTICAÇÃO
# ==============================================================================
def login_required(f):
    """Garante que o usuário esteja logado e passa o usuário para o template."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'logged_in' not in session:
            flash('Por favor, faça login para acessar esta página.', 'warning')
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
def db_execute(sql, params=(), commit=False):
    """Função genérica para executar comandos SQL (INSERT, UPDATE, DELETE)."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
        if commit:
            conn.commit()
    finally:
        if conn:
            conn.close()

def db_fetch(sql, params=(), one=False):
    """Função genérica para buscar dados (SELECT), retornando dados e cabeçalhos."""
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(sql, params)
            headers = [desc[0] for desc in cur.description] if cur.description else []
            result = cur.fetchone() if one else cur.fetchall()
            return result, headers
    finally:
        if conn:
            conn.close()

# --- Funções de Consulta Específicas ---
def get_table_data(get_func, search_term=""):
    """Wrapper para obter dados e cabeçalhos de uma função de consulta."""
    return get_func(search_term)

def get_clientes(search_term=""):
    sql = "SELECT id, nome, email, telefone, TO_CHAR(Ultima_Atualizacao, 'DD/MM/YYYY') as \"Atualizado em\" FROM clientes WHERE nome LIKE %s ORDER BY nome;"
    return db_fetch(sql, ('%' + search_term + '%',))

def get_compras(search_term=""):
    sql = "SELECT id, Produto, Marca, Quantidade, Preco_Unitario, TO_CHAR(Validade, 'DD/MM/YYYY') as Validade FROM compras WHERE Produto LIKE %s ORDER BY id DESC;"
    return db_fetch(sql, ('%' + search_term + '%',))

def get_vendas_servicos(search_term=""):
    sql = "SELECT id, Cliente, Servico, Preco_Final, TO_CHAR(Ultima_Atualizacao, 'DD/MM/YYYY') as \"Realizada em\" FROM vendas_servicos WHERE Cliente LIKE %s ORDER BY id DESC;"
    return db_fetch(sql, ('%' + search_term + '%',))

def get_vendas_produtos(search_term=""):
    sql = "SELECT id, Cliente, Produto, Preco_Final, TO_CHAR(Ultima_Atualizacao, 'DD/MM/YYYY') as \"Realizada em\" FROM vendas_produtos WHERE Cliente LIKE %s ORDER BY id DESC;"
    return db_fetch(sql, ('%' + search_term + '%',))

def get_relatorioMEI(search_term=""):
    # A busca em campo de data/timestamp pode precisar de ajuste dependendo do formato de 'search_term'
    sql = "SELECT id, Apuracao, Total_Geral_Receitas, Data FROM relatorioMEI WHERE CAST(Apuracao AS TEXT) LIKE %s ORDER BY Apuracao DESC;"
    return db_fetch(sql, ('%' + search_term + '%',))

def get_agendamentos(search_term=""):
    sql = "SELECT Cliente, TO_CHAR(Dia, 'DD/MM/YYYY') as Dia, Hora, Atendimento FROM agenda WHERE Cliente LIKE %s ORDER BY Dia, Hora;"
    return db_fetch(sql, ('%' + search_term + '%',))

def get_impostos(search_term=""):
    """Busca dados de custos fixos (tabela impostos)."""
    sql = "SELECT id, aluguel, IPTU, luz, agua, prolabore, Total_Custos_Fixos, TO_CHAR(Ultima_Atualizacao, 'DD/MM/YYYY') as \"Atualizado em\" FROM impostos WHERE CAST(id AS TEXT) LIKE %s ORDER BY id DESC;"
    return db_fetch(sql, ('%' + search_term + '%',))

def get_insumos(search_term=""):
    """Busca dados de insumos."""
    sql = "SELECT id, Tipo_Servico, Nome_Insumo, Custo_Secao, TO_CHAR(Ultima_Atualizacao, 'DD/MM/YYYY') as \"Atualizado em\" FROM insumos WHERE Nome_Insumo LIKE %s ORDER BY id DESC;"
    return db_fetch(sql, ('%' + search_term + '%',))

def get_depreciacao(search_term=""):
    """Busca dados de depreciação."""
    sql = "SELECT id, Objeto, Preco_Custo, Anos_Uso, Valor_Depreciacao, TO_CHAR(Ultima_Atualizacao, 'DD/MM/YYYY') as \"Atualizado em\" FROM depreciacao WHERE Objeto LIKE %s ORDER BY id DESC;"
    return db_fetch(sql, ('%' + search_term + '%',))

def get_margem(search_term=""):
    """Busca dados de margem de contribuição."""
    sql = "SELECT id, Tipo_Servico, Preco_Ofertado, Custo_Variavel, Custo_Fixo, Projecao_Atendimentos, TO_CHAR(Ultima_Atualizacao, 'DD/MM/YYYY') as \"Atualizado em\" FROM margem WHERE Tipo_Servico LIKE %s ORDER BY id DESC;"
    return db_fetch(sql, ('%' + search_term + '%',))

def get_markup(search_term=""):
    """Busca dados de markup."""
    sql = "SELECT id, Tipo_Servico, Preco_Ofertado, Indice_Markup, Preco_Justo, TO_CHAR(Ultima_Atualizacao, 'DD/MM/YYYY') as \"Atualizado em\" FROM markup WHERE Tipo_Servico LIKE %s ORDER BY id DESC;"
    return db_fetch(sql, ('%' + search_term + '%',))

def get_colaboradores(search_term=""):
    """Busca dados de colaboradores."""
    sql = "SELECT id, Nome, Funcao, Salario, TO_CHAR(Ultima_Atualizacao, 'DD/MM/YYYY') as \"Atualizado em\" FROM colaboradores WHERE Nome LIKE %s ORDER BY id DESC;"
    return db_fetch(sql, ('%' + search_term + '%',))

def get_anamnese(search_term=""):
    """Busca dados de fichas de anamnese."""
    sql = "SELECT id, nome, cpf, queixa_principal, TO_CHAR(nascimento, 'DD/MM/YYYY') as \"Nascimento\" FROM anaminese WHERE nome LIKE %s ORDER BY nome;"
    return db_fetch(sql, ('%' + search_term + '%',))

def get_record_by_id(table_name, record_id):
    """Função segura para buscar um registro de uma tabela permitida pelo ID."""
    allowed_tables = {
        'post', 'enquete', 'clientes', 'anaminese', 'compras',
        'vendas_produtos', 'vendas_servicos', 'colaboradores', 'relatorioMEI',
        'impostos', 'insumos', 'depreciacao', 'margem', 'markup'
    }
    if table_name not in allowed_tables:
        raise ValueError(f"A visualização na tabela '{table_name}' não é permitida.")

    # Esta função genérica assume uma coluna 'id' como chave primária.
    sql = f"SELECT * FROM {table_name} WHERE id = %s;"
    record, headers = db_fetch(sql, (record_id,), one=True)
    return record, headers

def delete_record_by_id(table_name, record_id):
    """Função segura para deletar um registro de uma tabela permitida."""
    allowed_tables = {
        'post', 'enquete', 'clientes', 'anaminese', 'agenda', 'compras',
        'vendas_produtos', 'vendas_servicos', 'colaboradores', 'relatorioMEI',
        'impostos', 'insumos', 'depreciacao', 'margem', 'markup'
    }
    if table_name not in allowed_tables:
        raise ValueError(f"A exclusão na tabela '{table_name}' não é permitida.")
    sql = f"DELETE FROM {table_name} WHERE id = %s;"
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
    return render_template('sig/login.html', form=form)  # Render the form on GET

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
    kpis = {
        'total_clientes': 0,
        'total_receitas_mes': 0.0,
        'total_custos_mes': 0.0,
        'lucro_mes': 0.0,
        'agendamentos_hoje': 0,
        'pro_labore_mes': 0.0
    }
    try:
        current_month = date.today().strftime('%Y-%m')
        today_str = date.today().strftime('%Y-%m-%d')

        # --- Receitas do Mês (Serviços + Produtos) ---
        vendas_servicos_mes, _ = db_fetch("SELECT SUM(Preco_Final) FROM vendas_servicos WHERE TO_CHAR(Ultima_Atualizacao, 'YYYY-MM') = %s;", (current_month,), one=True)
        vendas_produtos_mes, _ = db_fetch("SELECT SUM(Preco_Final) FROM vendas_produtos WHERE TO_CHAR(Ultima_Atualizacao, 'YYYY-MM') = %s;", (current_month,), one=True)
        total_receitas_mes = (vendas_servicos_mes[0] or 0) + (vendas_produtos_mes[0] or 0)

        # --- Custos do Mês (Compras + Custos Fixos) ---
        custos_compras_mes, _ = db_fetch("SELECT SUM(Custo_Estoque) FROM compras WHERE TO_CHAR(Ultima_Atualizacao, 'YYYY-MM') = %s;", (current_month,), one=True)
        custos_fixos_mes, _ = db_fetch("SELECT SUM(Total_Custos_Fixos) FROM impostos WHERE TO_CHAR(Ultima_Atualizacao, 'YYYY-MM') = %s;", (current_month,), one=True)
        total_custos_mes = (custos_compras_mes[0] or 0) + (custos_fixos_mes[0] or 0)

        # --- Outros KPIs ---
        total_clientes, _ = db_fetch("SELECT COUNT(id) FROM clientes;", one=True)
        agendamentos_hoje, _ = db_fetch("SELECT COUNT(*) FROM agenda WHERE Dia = %s;", (today_str,), one=True)
        pro_labore_mes, _ = db_fetch("SELECT SUM(prolabore) FROM impostos WHERE TO_CHAR(Ultima_Atualizacao, 'YYYY-MM') = %s;", (current_month,), one=True)

        kpis['total_clientes'] = total_clientes[0] if total_clientes else 0
        kpis['total_receitas_mes'] = float(total_receitas_mes)
        kpis['total_custos_mes'] = float(total_custos_mes)
        kpis['lucro_mes'] = float(total_receitas_mes - total_custos_mes)
        kpis['agendamentos_hoje'] = agendamentos_hoje[0] if agendamentos_hoje else 0
        kpis['pro_labore_mes'] = float(pro_labore_mes[0] or 0.0)

    except psycopg2.Error as e:
        flash(f"Ocorreu um erro ao buscar os dados do dashboard: {e}", "danger")

    return render_template('sig/sig.html', **kpis)

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
        'relatorioMEI': {'get_func': get_relatorioMEI, 'template': 'view_table.html', 'title': 'Relatórios MEI'},
        'agenda': {'get_func': get_agendamentos, 'template': 'view_table.html', 'title': 'Agenda de Horários'},
        'impostos': {'get_func': get_impostos, 'template': 'view_table.html', 'title': 'Custos Fixos'},
        'insumos': {'get_func': get_insumos, 'template': 'view_table.html', 'title': 'Insumos'},
        'depreciacao': {'get_func': get_depreciacao, 'template': 'view_table.html', 'title': 'Depreciação'},
        'margem': {'get_func': get_margem, 'template': 'view_table.html', 'title': 'Margem de Contribuição'},
        'markup': {'get_func': get_markup, 'template': 'view_table.html', 'title': 'Markup'},
        'colaboradores': {'get_func': get_colaboradores, 'template': 'view_table.html', 'title': 'Colaboradores'},
        'anaminese': {'get_func': get_anamnese, 'template': 'view_table.html', 'title': 'Fichas de Anamnese'}
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
# ROTA DINÂMICA PARA VISUALIZAÇÃO DE UM REGISTRO (GET)
# ==============================================================================
@app_gestao.route('/visualizar/<string:table_name>/<int:record_id>')
@login_required
def view_record(table_name, record_id):
    """Rota dinâmica para visualizar um único registro de qualquer tabela."""
    
    # A tabela 'agenda' não possui um 'id' numérico e não pode ser tratada por esta rota.
    if table_name == 'agenda':
        flash(f"A tabela '{table_name}' possui uma estrutura especial e requer uma página de visualização dedicada.", 'warning')
        return redirect(url_for('sig.view_table', table_name=table_name))

    try:
        record, headers = get_record_by_id(table_name, record_id)
        if not record:
            flash('Registro não encontrado.', 'danger')
            return redirect(url_for('sig.view_table', table_name=table_name))

        # Converte o DictRow em um dicionário para facilitar o uso no template
        record_dict = dict(zip(headers, record)) if record else {}

        return render_template(
            'sig/view_listas.html',
            registro=record_dict,
            titulo=f"Detalhes de {table_name.replace('_', ' ').title()}",
            table_name=table_name,
            record_id=record_id
        )
    except ValueError as e:
        flash(str(e), 'danger')
        return redirect(url_for('sig.dashboard'))
    except Exception as e:
        flash(f"Erro ao carregar o registro: {e}", "danger")
        return redirect(url_for('sig.view_table', table_name=table_name))

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
    return redirect(request.referrer or url_for('sig.dashboard'))  # Handle GET requests

# ==============================================================================
# ROTAS DE CADASTRO (Nomes e Formulários Padronizados)
# ==============================================================================
# Note: As rotas foram renomeadas para 'cadastrar_*' para maior clareza.
# Os nomes dos formulários foram atualizados para os nomes padronizados em form.py.
# A função 'handle_registration' foi removida para uma lógica mais clara em cada rota.

@app_gestao.route('/cadastrar_cliente', methods=['GET', 'POST'])
@login_required
def cadastrar_cliente():
    form = ClienteForm()
    if form.validate_on_submit():
        sql = "INSERT INTO clientes (nome, cpf, email, telefone) VALUES (%s, %s, %s, %s);"
        params = (form.nome.data, form.cpf.data, form.email.data, form.telefone.data)
        try:
            db_execute(sql, params, commit=True)
            flash('Cliente cadastrado com sucesso!', 'success')
            return redirect(url_for('sig.cadastrar_cliente'))
        except psycopg2.IntegrityError:
            flash('Erro: Já existe um registro com estas informações (ex: CPF ou email duplicado).', 'danger')
        except Exception as e:
            flash(f'Ocorreu um erro inesperado: {e}', 'danger')
    return render_template('sig/postclientes.html', form=form, titulo="Cadastrar Cliente")

@app_gestao.route('/cadastrar_compra', methods=['GET', 'POST'])
@login_required
def cadastrar_compra():
    form = CompraForm()
    if form.validate_on_submit():
        sql = "INSERT INTO compras (Produto, Marca, Quantidade, Unidade, Validade, Preco_Unitario) VALUES (%s, %s, %s, %s, %s, %s);"
        params = (form.produto.data, form.marca.data, form.quantidade.data, form.unidade.data, form.validade.data, form.preco.data)
        try:
            db_execute(sql, params, commit=True)
            flash('Compra registrada com sucesso!', 'success')
            return redirect(url_for('sig.cadastrar_compra'))
        except Exception as e:
            flash(f'Ocorreu um erro inesperado: {e}', 'danger')
    return render_template('sig/compras.html', form=form, titulo="Registrar Compra")

@app_gestao.route('/cadastrar_venda_servico', methods=['GET', 'POST'])
@login_required
def cadastrar_venda_servico():
    form = VendaServicoForm()
    if form.validate_on_submit():
        sql = """
        INSERT INTO vendas_servicos (Cliente, Servico, Tempo_Minutos, Desconto, Preco, Observacoes) 
        VALUES (%s, %s, %s, %s, %s, %s);
        """
        params = (
            form.cliente.data, form.servico.data, form.tempo_min.data.strftime('%H:%M:%S'),
            form.desconto.data, form.preco.data, form.observacoes.data
        )
        try:
            db_execute(sql, params, commit=True)
            flash('Venda de serviço registrada com sucesso!', 'success')
            return redirect(url_for('sig.cadastrar_venda_servico'))
        except Exception as e:
            flash(f'Ocorreu um erro inesperado: {e}', 'danger')
    return render_template('sig/vendas_servicos.html', form=form, titulo="Registrar Venda de Serviço")
    
@app_gestao.route('/cadastrar_venda_produto', methods=['GET', 'POST'])
@login_required
def cadastrar_venda_produto():
    form = VendaProdutoForm()
    if form.validate_on_submit():
        sql = """
        INSERT INTO vendas_produtos (Cliente, Produto, Marca, Quantidade, Validade, Preco_aVista, Desconto, Qtde_Parcelas) 
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s);
        """
        params = (
            form.cliente.data, form.produto.data, form.marca.data, form.quantidade.data,
            form.validade.data, form.preco_aVista.data, form.desconto.data,
            form.qtde_parcelas.data
        )
        try:
            db_execute(sql, params, commit=True)
            flash('Venda de produto registrada com sucesso!', 'success')
            return redirect(url_for('sig.cadastrar_venda_produto'))
        except Exception as e:
            flash(f'Ocorreu um erro inesperado: {e}', 'danger')
    return render_template('sig/vendas_produtos.html', form=form, titulo="Registrar Venda de Produto")

@app_gestao.route('/cadastrar_colaborador', methods=['GET', 'POST'])
@login_required
def cadastrar_colaborador():
    form = ColaboradorForm()
    if form.validate_on_submit():
        sql = """
        INSERT INTO colaboradores (Nome, Endereco, Cidade, Email, Telefone, Funcao, Regime_Empregaticio, Salario, observacoes) 
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);
        """
        params = (
            form.nome.data, form.endereco.data, form.cidade.data, form.email.data,
            form.telefone.data, form.funcao.data, form.regime.data, form.salario.data,
            form.observacoes.data
        )
        try:
            db_execute(sql, params, commit=True)
            flash('Colaborador cadastrado com sucesso!', 'success')
            return redirect(url_for('sig.cadastrar_colaborador'))
        except Exception as e:
            flash(f'Ocorreu um erro inesperado: {e}', 'danger')
    return render_template('sig/colaboradores.html', form=form, titulo="Cadastrar Colaborador")

@app_gestao.route('/cadastrar_anamnese', methods=['GET', 'POST'])
@login_required
def cadastrar_anamnese():
    form = AnamneseForm()
    if request.method == 'GET':
        # Busca clientes para popular o dropdown
        clientes, _ = get_clientes()
        form.nome.choices = [(c['nome'], c['nome']) for c in clientes]

    if form.validate_on_submit():
        # Helper para combinar campos 'Sim/Não' com 'Quais?'
        def combine_fields(select_data, text_data):
            return f"{select_data}: {text_data}" if select_data == 'Sim' and text_data else select_data

        sql = """
        INSERT INTO anaminese (
            nome, nascimento, profissao, endereco, telefone, indicacao, queixa_principal,
            alergia_medicamentos, alergia_aspirina, tratamentos_medicos, cirurgia, uso_medicamentos,
            proteses, doencas_familiares, diabetes, pressao, doenca_renal, epilepsia,
            menstruacao, gestacao, tratamento_estetico, uso_cosmeticos, filtro_solar,
            bronzeamento, observacoes, assinatura, cpf
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
        """
        params = (
            form.nome.data, form.nascimento.data, form.profissao.data, form.endereco.data, form.telefone.data, form.indicacao.data, form.queixa_principal.data,
            combine_fields(form.alergia_medicamentos.data, form.alergia_medicamentos_quais.data),
            combine_fields(form.alergia_aspirina.data, form.alergia_aspirina_quais.data),
            combine_fields(form.tratamentos_medicos.data, form.tratamentos_medicos_quais.data),
            combine_fields(form.cirurgias.data, form.cirurgias_quais.data),
            combine_fields(form.medicamentos.data, form.medicamentos_quais.data),
            combine_fields(form.proteses.data, form.proteses_quais.data),
            combine_fields(form.gene.data, form.gene_quais.data),
            form.diabetes.data, form.pressao.data, form.doenca_renal.data, form.epilepsia.data,
            form.menstruacao.data, form.gestante.data,
            combine_fields(form.tratamento_estetico.data, form.tratamento_estetico_quais.data),
            combine_fields(form.cosmeticos.data, form.cosmeticos_quais.data),
            combine_fields(form.filtro_solar.data, form.filtro_solar_quais.data),
            combine_fields(form.bronzeamento.data, form.bronzeamento_quais.data),
            form.obs.data, form.assinatura.data, form.documento.data
        )
        try:
            db_execute(sql, params, commit=True)
            flash('Ficha de Anamnese registrada com sucesso!', 'success')
            return redirect(url_for('sig.cadastrar_anamnese'))
        except Exception as e:
            flash(f'Ocorreu um erro inesperado: {e}', 'danger')
    return render_template('sig/anamnese.html', form=form, titulo="Registrar Ficha de Anamnese")
        
@app_gestao.route('/cadastrar_relatorio_mei', methods=['GET', 'POST'])
@login_required
def cadastrar_relatorio_mei():
    form = RelatorioMEIForm()
    if form.validate_on_submit():
        sql = """
        INSERT INTO relatorioMEI (
            Apuracao, CNPJ, Razao_Social, Produto_Dispensa_NF, Produto_Emissao_NF,
            Servico_Dispensa_NF, Servico_Emissao_NF, Local, Data, Assinatura
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
        """
        params = (
            form.apuracao.data, form.cnpj.data, form.razao_social.data,
            form.pdn.data, form.pen.data, form.sdn.data, form.sen.data,
            form.local.data, form.data.data, form.assinatura.data
        )
        try:
            db_execute(sql, params, commit=True)
            flash('Relatório MEI registrado com sucesso!', 'success')
            return redirect(url_for('sig.cadastrar_relatorio_mei'))
        except Exception as e:
            flash(f'Ocorreu um erro inesperado: {e}', 'danger')
    
    dados, cabecalho = get_relatorioMEI()
    return render_template('sig/relatorio_mei.html', 
                           form=form, 
                           titulo="Registrar Relatório MEI",
                           dados=dados,
                           cabecalho=cabecalho,
                           table_name='relatorioMEI')
        
@app_gestao.route('/cadastrar_custos_fixos', methods=['GET', 'POST'])
@login_required
def cadastrar_custos_fixos():
    form = CustosFixosForm()
    if form.validate_on_submit():
        sql = """
        INSERT INTO impostos (
            aluguel, IPTU, luz, agua, telefone, internet, aluguel_Maquina_Cartao, MEI,
            descartaveis, novos_produtos, equipamentos, marketing, prolabore, terceiros, reserva
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
        """
        params = (
            form.alu.data, form.IPTU.data, form.luz.data, form.agua.data,
            form.tel.data, form.net.data, form.alu_car.data, form.MEI.data,
            form.descart.data, form.n_prod.data, form.equip.data, form.mkt.data,
            form.prolab.data, form.terc.data, form.reserva.data
        )
        try:
            db_execute(sql, params, commit=True)
            flash('Custos Fixos registrados com sucesso!', 'success')
            return redirect(url_for('sig.cadastrar_custos_fixos'))
        except Exception as e:
            flash(f'Ocorreu um erro inesperado: {e}', 'danger')

    dados, cabecalho = get_impostos()
    return render_template('sig/custos_fixos.html', 
                           form=form, 
                           titulo="Registrar Custos Fixos",
                           dados=dados,
                           cabecalho=cabecalho,
                           table_name='impostos')

@app_gestao.route('/cadastrar_insumo', methods=['GET', 'POST'])
@login_required
def cadastrar_insumo():
    form = InsumoForm()
    if form.validate_on_submit():
        sql = """
        INSERT INTO insumos (
            Tipo_Servico, Nome_Insumo, Quantidade_Fechada, unidade_total,
            Preco_Fechado, Quantidade_Fracionada, unidade_fracionada
        ) VALUES (%s, %s, %s, %s, %s, %s, %s);
        """
        params = (
            form.tipo_servico.data, form.nome_insumo.data, form.qtde_fechada.data,
            form.qfe_unidade.data, form.preco_fechado.data, form.qtde_fracionada.data,
            form.qfr_unidade.data
        )
        try:
            db_execute(sql, params, commit=True)
            flash('Insumo registrado com sucesso!', 'success')
            return redirect(url_for('sig.cadastrar_insumo'))
        except Exception as e:
            flash(f'Ocorreu um erro inesperado: {e}', 'danger')
    return render_template('sig/insumos.html', form=form, titulo="Registrar Insumo")
        
@app_gestao.route('/cadastrar_depreciacao', methods=['GET', 'POST'])
@login_required
def cadastrar_depreciacao():
    form = DepreciacaoForm()
    if form.validate_on_submit():
        sql = "INSERT INTO depreciacao (Objeto, Preco_Custo, Anos_Uso) VALUES (%s, %s, %s);"
        params = (form.obj.data, form.preco_custo.data, form.vida_util.data)
        try:
            db_execute(sql, params, commit=True)
            flash('Depreciação registrada com sucesso!', 'success')
            return redirect(url_for('sig.cadastrar_depreciacao'))
        except Exception as e:
            flash(f'Ocorreu um erro inesperado: {e}', 'danger')
    return render_template('sig/depreciacao.html', form=form, titulo="Registrar Depreciação")

@app_gestao.route('/cadastrar_margem', methods=['GET', 'POST'])
@login_required
def cadastrar_margem():
    form = MargemForm()
    if form.validate_on_submit():
        # ATENÇÃO: A tabela 'margem' requer mais campos que o formulário oferece.
        # A inserção pode falhar se as outras colunas não permitirem valores nulos.
        sql = "INSERT INTO margem (Tipo_Servico, Preco_Ofertado) VALUES (%s, %s);"
        params = (form.servico.data, form.preco_oferta.data)
        try:
            db_execute(sql, params, commit=True)
            flash('Margem registrada com sucesso!', 'success')
            return redirect(url_for('sig.cadastrar_margem'))
        except Exception as e:
            flash(f'Ocorreu um erro ao registrar a margem: {e}', 'danger')
    return render_template('sig/margemlucro.html', form=form, titulo="Registrar Margem")

@app_gestao.route('/cadastrar_markup', methods=['GET', 'POST'])
@login_required
def cadastrar_markup():
    form = MarkupForm()
    if form.validate_on_submit():
        # ATENÇÃO: A tabela 'markup' requer mais campos que o formulário oferece.
        # A inserção pode falhar se as outras colunas não permitirem valores nulos.
        sql = "INSERT INTO markup (Taxa_Maq_Cartao, Margem_Lucro) VALUES (%s, %s);"
        params = (form.txmc.data, form.mg.data)
        try:
            db_execute(sql, params, commit=True)
            flash('Markup registrado com sucesso!', 'success')
            return redirect(url_for('sig.cadastrar_markup'))
        except Exception as e:
            flash(f'Ocorreu um erro ao registrar o markup: {e}', 'danger')
    return render_template('sig/markup.html', form=form, titulo="Registrar Markup")
