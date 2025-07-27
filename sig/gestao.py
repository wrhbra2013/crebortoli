from flask import (
Blueprint, render_template, redirect, url_for, request, flash, session, current_app, abort
)
from datetime import timedelta, date
from functools import wraps
import sqlite3
from init_db import DB_FILE

# Importa todos os formulários padronizados do form.py
from .form import *;

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
    return redirect(request.referrer or url_for('sig.dashboard'))  # Handle GET requests

# ==============================================================================
# HELPER FUNCTION FOR REGISTRATION ROUTES
# ==============================================================================
def handle_registration(form, sql, params, success_message, template, title):
    if form.validate_on_submit():
        try:
            db_execute(sql, params, commit=True)
            flash(success_message, 'success')
            return redirect(request.url)  # Redirect to the same registration page
        except sqlite3.IntegrityError:
            flash('Erro: Já existe um registro com estas informações.', 'danger')
        except Exception as e:
            flash(f'Ocorreu um erro inesperado: {e}', 'danger')
    return render_template(template, form=form, titulo=title)

# ==============================================================================
# ROTAS DE CADASTRO (Nomes e Formulários Padronizados)
# ==============================================================================
# Note: As rotas foram renomeadas para 'cadastrar_*' para maior clareza.
# Os nomes dos formulários foram atualizados para os nomes padronizados em form.py.

@app_gestao.route('/cadastrar_cliente', methods=['GET', 'POST'])
@login_required
def cadastrar_cliente():
    form = ClienteForm()
    if form.validate_on_submit():
        # Process the form data (POST request)
        sql = "INSERT INTO clientes (nome, cpf, email, telefone) VALUES (?, ?, ?, ?);"
        params = (form.nome.data, form.cpf.data, form.email.data, form.telefone.data)
    return handle_registration(form, sql, params, 'Cliente cadastrado com sucesso!', 'sig/postclientes.html', "Cadastrar Cliente")
    # Render the form (GET request)
    return render_template('sig/postclientes.html', form=form, titulo="Cadastrar Cliente")
        return handle_registration(form, sql, params, 'Cliente cadastrado com sucesso!', 'sig/cadastrar_cliente.html', "Cadastrar Cliente")
    # Render the form (GET request) - this should be inside the function, before the other return
    return render_template('sig/cadastrar_cliente.html', form=form, titulo="Cadastrar Cliente")
@app_gestao.route('/cadastrar_compra', methods=['GET', 'POST'])
@login_required
def cadastrar_compra():
    form = CompraForm()
    sql = "INSERT INTO compras (Produto, Marca, Quantidade, Unidade, Validade, Preco_Unitario) VALUES (?, ?, ?, ?, ?, ?);"
    params = (form.produto.data, form.marca.data, form.quantidade.data, form.unidade.data, form.validade.data, form.preco.data)
    return handle_registration(form, sql, params, 'Compra registrada com sucesso!', 'sig/compras.html', "Registrar Compra")

@app_gestao.route('/cadastrar_venda_servico', methods=['GET', 'POST'])
@login_required
def cadastrar_venda_servico():
    form = VendaServicoForm()
    sql = """
    INSERT INTO vendas_servicos (
        Cliente, Servico, Tempo_Min, Desconto, Preco_Final, Observacoes
    ) VALUES (?, ?, ?, ?, ?, ?);
    """
    preco_final = form.preco.data * (1 - form.desconto.data / 100)
    params = (
        form.cliente.data, form.servico.data, form.tempo_min.data,
        form.desconto.data, preco_final, form.observacoes.data
    )
    return handle_registration(form, sql, params, 'Venda de serviço registrada com sucesso!', 'sig/vendas_servicos.html', "Registrar Venda de Serviço")
    
@app_gestao.route('/cadastrar_venda_produto', methods=['GET', 'POST'])
@login_required
def cadastrar_venda_produto():
    form = VendaProdutoForm()
    sql = """
    INSERT INTO vendas_produtos (
        Cliente, Produto, Marca, Quantidade, Validade, Preco_aVista, Desconto, Qtde_Parcelas, Preco_Final
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    """
    preco_final = form.preco_aVista.data * (1 - form.desconto.data / 100)
    params = (
        form.cliente.data, form.produto.data, form.marca.data, form.quantidade.data,
        form.validade.data, form.preco_aVista.data, form.desconto.data,
        form.qtde_parcelas.data, preco_final
    )
    return handle_registration(form, sql, params, 'Venda de produto registrada com sucesso!', 'sig/vendas_produtos.html', "Registrar Venda de Produto")

@app_gestao.route('/cadastrar_colaborador', methods=['GET', 'POST'])
@login_required
def cadastrar_colaborador():
    form = ColaboradorForm()
    sql = """
    INSERT INTO colaboradores (
        Nome, Endereco, Cidade, Email, Telefone, Funcao, Regime, Salario, Observacoes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    """
    params = (
        form.nome.data, form.endereco.data, form.cidade.data, form.email.data,
        form.telefone.data, form.funcao.data, form.regime.data, form.salario.data,
        form.observacoes.data
    )
    return handle_registration(form, sql, params, 'Colaborador cadastrado com sucesso!', 'sig/colaboradores.html', "Cadastrar Colaborador")

@app_gestao.route('/cadastrar_anamnese', methods=['GET', 'POST'])
@login_required
def cadastrar_anamnese():
    form = AnamneseForm()
    sql = """
    INSERT INTO anamnese (
    nome, nascimento, profissao, endereco, telefone, indicacao, queixa_principal,
    alergia_medicamentos, alergia_medicamentos_quais, alergia_aspirina, alergia_aspirina_quais,
    tratamentos_medicos, tratamentos_medicos_quais, cirurgias, cirurgias_quais,
    medicamentos, medicamentos_quais, proteses, proteses_quais,
    gene, gene_quais, diabetes, pressao, doenca_renal, epilepsia,
    menstruacao, gestante, tratamento_estetico, tratamento_estetico_quais,
    cosmeticos, cosmeticos_quais, filtro_solar, filtro_solar_quais,
    bronzeamento, bronzeamento_quais, obs, assinatura, documento, data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """
    params = (
    form.nome.data, form.nascimento.data, form.profissao.data, form.endereco.data,
    form.telefone.data, form.indicacao.data, form.queixa_principal.data,
    form.alergia_medicamentos.data, form.alergia_medicamentos_quais.data,
    form.alergia_aspirina.data, form.alergia_aspirina_quais.data,
    form.tratamentos_medicos.data, form.tratamentos_medicos_quais.data,
    form.cirurgias.data, form.cirurgias_quais.data,
    form.medicamentos.data, form.medicamentos_quais.data,
    form.proteses.data, form.proteses_quais.data,
    form.gene.data, form.gene_quais.data, form.diabetes.data,
    form.pressao.data, form.doenca_renal.data, form.epilepsia.data,
    form.menstruacao.data, form.gestante.data,
    form.tratamento_estetico.data, form.tratamento_estetico_quais.data,
    form.cosmeticos.data, form.cosmeticos_quais.data,
    form.filtro_solar.data, form.filtro_solar_quais.data,
    form.bronzeamento.data, form.bronzeamento_quais.data,
    form.obs.data, form.assinatura.data, form.documento.data, form.data.data)
    return handle_registration(form, sql, params, 'Ficha de Anamnese registrada com sucesso!', 'sig/anamnese.html', "Registrar Ficha de Anamnese")
        
@app_gestao.route('/cadastrar_relatorio_mei', methods=['GET', 'POST'])
@login_required
def cadastrar_relatorio_mei():
    form = RelatorioMEIForm()
    sql = """
    INSERT INTO relatorioMEI (
        Apuracao, CNPJ, Razao_Social, Receita_Produtos_Dispensa_NF,
        Receita_Produtos_Emissao_NF, Receita_Servicos_Dispensa_NF,
        Receita_Servicos_Emissao_NF, Total_Geral_Receitas, Local, Data, Assinatura_CPF
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """
    total_receitas = (
        (form.pdn.data if form.pdn.data is not None else 0) +
        (form.pen.data if form.pen.data is not None else 0) +
        (form.sdn.data if form.sdn.data is not None else 0) +
        (form.sen.data if form.sen.data is not None else 0)
    )
    params = (
        form.apuracao.data, form.cnpj.data, form.razao_social.data,
        form.pdn.data, form.pen.data, form.sdn.data, form.sen.data,
        total_receitas, form.local.data, form.data.data, form.assinatura.data
            )
    return handle_registration(form, sql, params, 'Relatório MEI registrado com sucesso!', 'sig/relatorio_mei.html', "Registrar Relatório MEI")
        
@app_gestao.route('/cadastrar_custos_fixos', methods=['GET', 'POST'])
@login_required
def cadastrar_custos_fixos():
    form = CustosFixosForm()
    sql = """
    INSERT INTO custos_fixos (
        Aluguel, IPTU, Luz, Agua, Telefone, Internet, Aluguel_Maquina_Cartao,
        MEI, Material_Descartavel, Novos_Produtos_Lancamentos, Financiamento_Equipamentos,
        Marketing, Pro_Labore, Outros_Funcionarios_Prestadores_Servicos, Reserva_Emergencia
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """
    params = (
        form.alu.data, form.IPTU.data, form.luz.data, form.agua.data,
        form.tel.data, form.net.data, form.alu_car.data, form.MEI.data,
        form.descart.data, form.n_prod.data, form.equip.data, form.mkt.data,
        form.prolab.data, form.terc.data, form.reserva.data
    )
    return handle_registration(form, sql, params, 'Custos Fixos registrados com sucesso!', 'sig/custos_fixos.html', "Registrar Custos Fixos")

@app_gestao.route('/cadastrar_insumo', methods=['GET', 'POST'])
@login_required
def cadastrar_insumo():
    form = InsumoForm()
    sql = """
    INSERT INTO insumos (
        Tipo_Servico, Nome_Insumo, Qtde_Fechada, Qtde_Fechada_Unidade,
        Qtde_Fracionada, Qtde_Fracionada_Unidade, Preco_Fechado
    ) VALUES (?, ?, ?, ?, ?, ?, ?);
    """
    params = (
    form.tipo_servico.data, form.nome_insumo.data, form.qtde_fechada.data,
            form.qfe_unidade.data, form.qtde_fracionada.data,
            form.qfr_unidade.data, form.preco_fechado.data
        )
    return handle_registration(form, sql, params, 'Insumo registrado com sucesso!', 'sig/insumos.html', "Registrar Insumo")
        
@app_gestao.route('/cadastrar_depreciacao', methods=['GET', 'POST'])
@login_required
def cadastrar_depreciacao():
    form = DepreciacaoForm()
    sql = """
    INSERT INTO depreciacao (
        Objeto, Preco_Custo, Vida_Util_Anos
    ) VALUES (?, ?, ?);
    """
    params = (
        form.obj.data, form.preco_custo.data, form.vida_util.data
    )
    return handle_registration(form, sql, params, 'Depreciação registrada com sucesso!', 'sig/depreciacao.html', "Registrar Depreciação")

@app_gestao.route('/cadastrar_margem', methods=['GET', 'POST'])
@login_required
def cadastrar_margem():
    form = MargemForm()
    sql = """
    INSERT INTO margem (
        Servico, Preco_Ofertado
    ) VALUES (?, ?);
    """
    params = (
        form.servico.data, form.preco_oferta.data
    )
    return handle_registration(form, sql, params, 'Margem registrada com sucesso!', 'sig/margem.html', "Registrar Margem")

@app_gestao.route('/cadastrar_markup', methods=['GET', 'POST'])
@login_required
def cadastrar_markup():
    form = MarkupForm()
    sql = """
    INSERT INTO markup (
        Taxa_Maquina_Cartao, Percentual_Margem_Lucro
    ) VALUES (?, ?);
    """
    params = (
        form.txmc.data, form.mg.data
    )
    return handle_registration(form, sql, params, 'Markup registrado com sucesso!', 'sig/markup.html', "Registrar Markup")
    
@app_gestao.route('/cadastrar_imposto', methods=['GET', 'POST'])
@login_required
def cadastrar_imposto():
    form = ImpostoForm()
    sql = """
    INSERT INTO impostos (
        Tipo, Aliquota, Descricao
    ) VALUES (?, ?, ?);
    """
    params = (
        form.tipo.data, form.aliquota.data, form.descricao.data
    )
    return handle_registration(form, sql, params, 'Imposto registrado com sucesso!', 'sig/impostos.html', "Registrar Imposto")
    
@app_gestao.route('/cadastrar_servico', methods=['GET', 'POST'])
@login_required
def cadastrar_servico():
    form = ServicoForm()
    sql = """
    INSERT INTO servicos (
        Nome, Descricao, Preco_Base
    ) VALUES (?, ?, ?);
    """
    params = (
        form.nome.data, form.descricao.data, form.preco_base.data
    )
    return handle_registration(form, sql, params, 'Serviço cadastrado com sucesso!', 'sig/servicos.html', "Cadastrar Serviço")

@app_gestao.route('/cadastrar_produto', methods=['GET', 'POST'])
@login_required
def cadastrar_produto():
    form = ProdutoForm()
    sql = """
    INSERT INTO produtos (
        Nome, Descricao, Preco_Custo, Preco_Venda, Quantidade_Estoque
    ) VALUES (?, ?, ?, ?, ?);
    """
    params = (
        form.nome.data, form.descricao.data, form.preco_custo.data,
        form.preco_venda.data, form.quantidade_estoque.data
    )
    return handle_registration(form, sql, params, 'Produto cadastrado com sucesso!', 'sig/produtos.html', "Cadastrar Produto")




# --- Gestão de Impostos ---
class ImpostoForm(FlaskForm):
    tipo = StringField('Tipo de Imposto:', validators=[DataRequired()])
    aliquota = DecimalField('Alíquota (%):', validators=[DataRequired()])
    descricao = TextAreaField('Descrição:')
    enviar = SubmitField('Registrar Imposto')

# --- Gestão de Serviços ---
class ServicoForm(FlaskForm):
    nome = StringField('Nome do Serviço:', validators=[DataRequired()])
    descricao = TextAreaField('Descrição do Serviço:')
    preco_base = DecimalField('Preço Base:', validators=[DataRequired()])
    enviar = SubmitField('Cadastrar Serviço')

# --- Gestão de Produtos ---
class ProdutoForm(FlaskForm):
    nome = StringField('Nome do Produto:', validators=[DataRequired()])
    descricao = TextAreaField('Descrição do Produto:')
    preco_custo = DecimalField('Preço de Custo:', validators=[DataRequired()])
    preco_venda = DecimalField('Preço de Venda:', validators=[DataRequired()])
    quantidade_estoque = IntegerField('Quantidade em Estoque:', validators=[DataRequired()])
    enviar = SubmitField('Cadastrar Produto')
