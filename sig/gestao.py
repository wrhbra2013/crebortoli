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
         vendas_mes, _ = db_fetch(
             "SELECT SUM(Preco_Final) FROM vendas_servicos WHERE strftime('%Y-%m', Ultima_Atualizacao) = ?;",
             (current_month,), one=True)
         compras_mes, _ = db_fetch(
             "SELECT SUM(Preco_Unitario * Quantidade) FROM compras WHERE strftime('%Y-%m', Ultima_Atualizacao) = ?;",
             (current_month,), one=True)
 
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
 
 @app_gestao.route('/cadastrar_cliente', methods=['GET', 'POST'])
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
 
 
 @app_gestao.route('/cadastrar_compra', methods=['GET', 'POST'])
 @login_required
 def cadastrar_compra():
     form = CompraForm()
     if form.validate_on_submit():
         try:
             sql = "INSERT INTO compras (Produto, Marca, Quantidade, Unidade, Validade, Preco_Unitario) VALUES (?, ?, ?, ?, ?, ?);"
             params = (
                 form.produto.data, form.marca.data, form.quantidade.data, form.unidade.data, form.validade.data,
                 form.preco.data)
             db_execute(sql, params, commit=True)
             flash('Compra registrada com sucesso!', 'success')
             return redirect(url_for('sig.cadastrar_compra'))
         except Exception as e:
             flash(f'Erro ao registrar compra: {e}', 'danger')
         return render_template('sig/compras.html', form=form, titulo="Registrar Compra")
 
 
 @app_gestao.route('/cadastrar_venda_servico', methods=['GET', 'POST'])
 @login_required
 def cadastrar_venda_servico():
     form = VendaServicoForm()
     if form.validate_on_submit():
         try:
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
             db_execute(sql, params, commit=True)
             flash('Venda de serviço registrada com sucesso!', 'success')
             return redirect(url_for('sig.cadastrar_venda_servico'))
         except Exception as e:
             flash(f'Erro ao registrar venda: {e}', 'danger')
         return render_template('sig/vendas_servicos.html', form=form, titulo="Registrar Venda de Serviço")
 
 
 @app_gestao.route('/cadastrar_venda_produto', methods=['GET', 'POST'])
 @login_required
 def cadastrar_venda_produto():
     form = VendaProdutoForm()
     if form.validate_on_submit():
         try:
             sql = """
             INSERT INTO vendas_produtos (
             Cliente, Produto, Marca, Quantidade, Validade,
             Preco_aVista, Desconto, Qtde_Parcelas, Preco_Final
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
             """
             preco_final = form.preco_aVista.data * (1 - form.desconto.data / 100)
             params = (
                 form.cliente.data, form.produto.data, form.marca.data,
                 form.quantidade.data, form.validade.data, form.preco_aVista.data,
                 form.desconto.data, form.qtde_parcelas.data, preco_final
             )
             db_execute(sql, params, commit=True)
             flash('Venda de produto registrada com sucesso!', 'success')
             return redirect(url_for('sig.cadastrar_venda_produto'))
         except Exception as e:
             flash(f'Erro ao registrar venda de produto: {e}', 'danger')
         return render_template('sig/vendas_produtos.html', form=form, titulo="Registrar Venda de Produto")
 
 
 @app_gestao.route('/cadastrar_colaborador', methods=['GET', 'POST'])
 @login_required
 def cadastrar_colaborador():
     form = ColaboradorForm()
     if form.validate_on_submit():
         try:
             sql = """
             INSERT INTO colaboradores (
             Nome, Endereco, Cidade, Email, Telefone,
             Funcao, Regime, Salario, Observacoes
             ) VALUES
             (?, ?, ?, ?, ?, ?, ?, ?, ?);
             """
             params = (
                 form.nome.data, form.endereco.data, form.cidade.data,
                 form.email.data, form.telefone.data, form.funcao.data,
                 form.regime.data, form.salario.data, form.observacoes.data
             )
             db_execute(sql, params, commit=True)
             flash('Colaborador cadastrado com sucesso!', 'success')
             return redirect(url_for('sig.cadastrar_colaborador'))
         except Exception as e:
             flash(f'Erro ao cadastrar colaborador: {e}', 'danger')
         return render_template('sig/colaboradores.html', form=form, titulo="Cadastrar Colaborador")


@app_gestao.route('/cadastrar_anamnese', methods=['GET', 'POST'])
@login_required
def cadastrar_anamnese():
    form = AnamneseForm()
    if form.validate_on_submit():
        try:
            sql = """
            INSERT INTO anamnese (
                Nome, Nascimento, Profissao, Endereco, Telefone, Indicacao, Queixa_Principal,
                Alergia_Medicamentos, Alergia_Medicamentos_Quais, Alergia_Aspirina, Alergia_Aspirina_Quais,
                Tratamentos_Medicos, Tratamentos_Medicos_Quais, Cirurgias, Cirurgias_Quais,
                Medicamentos, Medicamentos_Quais, Proteses, Proteses_Quais,
                Gene, Gene_Quais, Diabetes, Pressao, Doenca_Renal, Epilepsia,
                Menstruacao, Gestante, Tratamento_Estetico, Tratamento_Estetico_Quais,
                Cosmeticos, Cosmeticos_Quais, Filtro_Solar, Filtro_Solar_Quais,
                Bronzeamento, Bronzeamento_Quais, Obs, Assinatura, Documento, Data
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """
            params= (          form.nome.data, form.nascimento.data, form.profissao.data, form.endereco.data,
                            form.telefone.data, form.indicacao.data, form.queixa_principal.data,
                            form.alergia_medicamentos.data, form.alergia_medicamentos_quais.data,
                            form.alergia_aspirina.data, form.alergia_aspirina_quais.data,
                            form.tratamentos_medicos.data, form.tratamentos_medicos_quais.data,
                            form.cirurgias.data, form.cirurgias_quais.data,
                            form.medicamentos.data, form.medicamentos_quais.data,
                            form.proteses.data, form.proteses_quais.data,
                            form.gene.data, form.gene_quais.data,
                            form.diabetes.data, form.pressao.data, form.doenca_renal.data, form.epilepsia.data,
                            form.menstruacao.data, form.gestante.data,
                            form.tratamento_estetico.data, form.tratamento_estetico_quais.data,
                            form.cosmeticos.data, form.cosmeticos_quais.data,
                            form.filtro_solar.data, form.filtro_solar_quais.data,
                            form.bronzeamento.data, form.bronzeamento_quais.data,
                            form.obs.data, form.assinatura.data, form.documento.data, form.data.data
                        )
                        db_execute(sql, params, commit=True)
                        flash('Ficha de Anamnese registrada com sucesso!', 'success')
                        return redirect(url_for('sig.cadastrar_anamnese'))
                    except Exception as e:
                        flash(f'Erro ao registrar ficha de anamnese: {e}', 'danger')
                    return render_template('sig/anamnese.html', form=form, titulo="Registrar Ficha de Anamnese")
            
            
 @app_gestao.route('/cadastrar_relatorio_mei', methods=['GET', 'POST'])
 @login_required
 def cadastrar_relatorio_mei():
     form = RelatorioMEIForm()
     if form.validate_on_submit():
         try:
             total_receitas = (form.pdn.data or 0) + \
                              (form.pen.data or 0) + \
                              (form.sdn.data or 0) + \
                              (form.sen.data or 0)
 
             sql = """
             INSERT INTO relatorioMEI (
                 Apuracao, CNPJ, Razao_Social, Receita_Produtos_Dispensa_NF,
                 Receita_Produtos_Emissao_NF, Receita_Servicos_Dispensa_NF,
                 Receita_Servicos_Emissao_NF, Total_Geral_Receitas, Local, Data, Assinatura
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
             """
             params = (
                 form.apuracao.data, form.cnpj.data, form.razao_social.data,
                 form.pdn.data, form.pen.data, form.sdn.data, form.sen.data,
                 total_receitas, form.local.data, form.data.data, form.assinatura.data
             )
             db_execute(sql, params, commit=True)
             flash('Relatório MEI registrado com sucesso!', 'success')
             return redirect(url_for('sig.cadastrar_relatorio_mei'))
         except Exception as e:
             flash(f'Erro ao registrar relatório MEI: {e}', 'danger')
     return render_template('sig/relatorioMEI.html', form=form, titulo="Registrar Relatório MEI")
 
 
 @app_gestao.route('/cadastrar_custos_fixos', methods=['GET', 'POST'])
 @login_required
 def cadastrar_custos_fixos():
     form = CustosFixosForm()
     if form.validate_on_submit():
         try:
             sql = """
             INSERT INTO custos_fixos (
                 Aluguel, IPTU, Luz, Agua, Telefone, Internet, Aluguel_Maquina_Cartao,
                 MEI, Material_Descartavel, Investimento_Novos_Produtos, Financiamento_Equipamentos,
                                  Marketing, Pro_Labore, Outros_Funcionarios, Reserva_Emergencia
                              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                              """
                              params = (
                                  form.alu.data, form.IPTU.data, form.luz.data, form.agua.data,
                                  form.tel.data, form.net.data, form.alu_car.data, form.MEI.data,
                                  form.descart.data, form.n_prod.data, form.equip.data,
                                  form.mkt.data, form.prolab.data, form.terc.data, form.reserva.data
                              )
                              db_execute(sql, params, commit=True)
                              flash('Custos fixos registrados com sucesso!', 'success')
                              return redirect(url_for('sig.cadastrar_custos_fixos'))
                          except Exception as e:
                              flash(f'Erro ao registrar custos fixos: {e}', 'danger')
                      return render_template('sig/custos_fixos.html', form=form, titulo="Registrar Custos Fixos")
                 
@app_gestao.route('/cadastrar_insumo', methods=['GET', 'POST'])
@login_required
def cadastrar_insumo():
                     form = InsumoForm()
                     if form.validate_on_submit():
                         try:
                             sql = """
                             INSERT INTO insumos (
                                 Tipo_Servico, Nome_Insumo, Quantidade_Fechada, Unidade_Fechada,
                                 Quantidade_Fracionada, Unidade_Fracionada, Preco_Pacote_Fechado
                             ) VALUES (?, ?, ?, ?, ?, ?, ?);
                             """
                             params = (
                                 form.tipo_servico.data, form.nome_insumo.data, form.qtde_fechada.data,
                                 form.qfe_unidade.data, form.qtde_fracionada.data, form.qfr_unidade.data,
                                 form.preco_fechado.data
                             )
                             db_execute(sql, params, commit=True)
                                         flash('Insumo registrado com sucesso!', 'success')
                                         return redirect(url_for('sig.cadastrar_insumo'))
                                     except Exception as e:
                                         flash(f'Erro ao registrar insumo: {e}', 'danger')
                                 return render_template('sig/insumos.html', form=form, titulo="Registrar Insumo")
                             
                             
                             @app_gestao.route('/cadastrar_depreciacao', methods=['GET', 'POST'])
                             @login_required
                             def cadastrar_depreciacao():
                                 form = DepreciacaoForm()
                                 if form.validate_on_submit():
                                     try:
                                         sql = """
                                         INSERT INTO depreciacao (
                                             Nome_Equipamento, Preco_Custo, Anos_Uso
                                         ) VALUES (?, ?, ?);
                                         """
                                         params = (
                                             form.obj.data, form.preco_custo.data, form.vida_util.data
                                         )
                                         db_execute(sql, params, commit=True)
                                         flash('Depreciação registrada com sucesso!', 'success')
                                         return redirect(url_for('sig.cadastrar_depreciacao'))
                                     except Exception as e:
                                         flash(f'Erro ao registrar depreciação: {e}', 'danger')
                                 return render_template('sig/depreciacao.html', form=form, titulo="Registrar Depreciação")
                             
                             
                             @app_gestao.route('/cadastrar_margem', methods=['GET', 'POST'])
                             @login_required
                             def cadastrar_margem():
                                 form = MargemForm()
                                 if form.validate_on_submit():
                                     try:
                                         sql = """
                                         INSERT INTO margem (
                                             Tipo_Tratamento, Preco_Ofertado
                                         ) VALUES (?, ?);
                                         """
                                         params = (
                                             form.servico.data, form.preco_oferta.data
                                         )
                                         db_execute(sql, params, commit=True)
                                         flash('Margem registrada com sucesso!', 'success')
                                         return redirect(url_for('sig.cadastrar_margem'))
                                     except Exception as e:
                                         flash(f'Erro ao registrar margem: {e}', 'danger