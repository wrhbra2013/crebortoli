# /home/wander/crebortoli/sig/form.py

from flask_wtf import FlaskForm
from wtforms import (StringField, PasswordField, SubmitField, TextAreaField,
                    IntegerField, DecimalField, EmailField, TelField,
                    SearchField, DateField, SelectField, TimeField)
from wtforms.validators import DataRequired

# ==============================================================================
# FORMULÁRIOS GENÉRICOS E REUTILIZÁVEIS
# ==============================================================================

class LoginForm(FlaskForm):
    """Formulário de login."""
    senha = PasswordField('Senha:', validators=[DataRequired()])
    enviar = SubmitField('Enviar')

class SearchForm(FlaskForm):
    """Formulário de pesquisa genérico."""
    query = SearchField('Pesquisar:', validators=[DataRequired()])
    submit = SubmitField('Buscar')

class DeleteForm(FlaskForm):
    """Formulário genérico para botões de exclusão."""
    submit = SubmitField('Deletar')

# ==============================================================================
# FORMULÁRIOS DE CADASTRO E GESTÃO (Nomes Padronizados)
# ==============================================================================

# --- Gestão de Clientes ---
class ClienteForm(FlaskForm):
    nome = StringField('Nome:', validators=[DataRequired()])
    cpf = IntegerField('CPF', validators=[DataRequired()])
    email = EmailField('Email:', validators=[DataRequired()])
    telefone = TelField('Telefone:', validators=[DataRequired()])
    enviar = SubmitField('Cadastrar Cliente')

# --- Gestão de Compras ---
class CompraForm(FlaskForm):
    produto = StringField('Produto:', validators=[DataRequired()])
    marca  = StringField('Marca:', validators=[DataRequired()])
    quantidade = IntegerField('Quantidade: ', validators=[DataRequired()])
    unidade = StringField('Unidade:', validators=[DataRequired()])
    validade = DateField('Validade', validators=[DataRequired()])
    preco = DecimalField('Preço', validators=[DataRequired()])
    enviar = SubmitField('Registrar Compra')

# --- Gestão de Vendas ---
class VendaProdutoForm(FlaskForm):
    cliente = StringField('Nome do Cliente:', validators=[DataRequired()])
    produto = TextAreaField('Produto:', validators=[DataRequired()])
    marca  = StringField('Marca:', validators=[DataRequired()])
    quantidade = IntegerField('Quantidade: ', validators=[DataRequired()])
    validade = DateField('Validade:', validators=[DataRequired()])
    preco_aVista = DecimalField('Preço a Vista: ', validators=[DataRequired()])
    desconto = DecimalField('Desconto:', validators=[DataRequired()])
    qtde_parcelas = IntegerField('Quantidade de Parcelas:', validators=[DataRequired()])
    enviar = SubmitField('Registrar Venda')

class VendaServicoForm(FlaskForm):
    cliente = StringField('Nome do Cliente:', validators=[DataRequired()])
    servico = StringField('Serviço:', validators=[DataRequired()])
    tempo_min = TimeField('Tempo/minuto:', validators=[DataRequired()])
    desconto = DecimalField('Desconto:', validators=[DataRequired()])
    preco = DecimalField('Valor:', validators=[DataRequired()])
    observacoes = TextAreaField('Observações', validators=[DataRequired()])
    enviar = SubmitField('Registrar Serviço')

# --- Gestão de Pessoal ---
class ColaboradorForm(FlaskForm):
    # DADOS PESSOAIS
    nome =  StringField('Nome:', validators=[DataRequired()])
    endereco =  TextAreaField('Endereço:', validators=[DataRequired()])
    cidade =  StringField('Cidade:', validators=[DataRequired()])
    email  =  StringField('Email:', validators=[DataRequired()])
    telefone = TelField('Telefone')

    # VINCULO EMPREGATICIO
    funcao =  StringField('Função:', validators=[DataRequired()])
    regime =  StringField('Regime Empregaticio:', validators=[DataRequired()])
    salario = IntegerField('Salário:', validators=[DataRequired()])
    observacoes = TextAreaField('Observações:')
    enviar = SubmitField('Cadastrar Colaborador')

# --- Ficha de Anamnese ---
class AnamneseForm(FlaskForm):
    # Dados Pessoais
    nome = StringField('Nome:', validators=[DataRequired()])
    nascimento = DateField('Nascimento:', validators=[DataRequired()])
    profissao = StringField('Profissão:', validators=[DataRequired()])
    endereco = StringField('Endereço')
    telefone = TelField('Telefone', validators=[DataRequired()])
    indicacao = StringField('Indicação:')
    queixa_principal = TextAreaField('Queixa Principal:', validators=[DataRequired()])
    # Estado Clinico
    alergia_medicamentos = SelectField('Alergia a Medicamentos:', choices=[('', ''), ('Sim', 'Sim'), ('Não', 'Não')])
    alergia_medicamentos_quais = StringField(default="Quais?")
    alergia_aspirina = SelectField('Alergia a Aspirina (Ácido Salicilico):', choices=[('', ''), ('Sim', 'Sim'), ('Não', 'Não')])
    alergia_aspirina_quais = StringField(default='Quais?')
    tratamentos_medicos = SelectField('Faz ou fez algum tratamento médico?', choices=[('', ''), ('Sim', 'Sim'), ('Não', 'Não')])
    tratamentos_medicos_quais = StringField(default='Quais?')
    cirurgias = SelectField('Fez alguma cirurgia?', choices=[('', ''), ('Sim', 'Sim'), ('Não', 'Não')])
    cirurgias_quais = StringField(default='Quais?')
    medicamentos = SelectField('Faz uso de algum medicamento?', choices=[('', ''), ('Sim', 'Sim'), ('Não', 'Não')])
    medicamentos_quais = StringField(default='Quais?')
    proteses = SelectField('Usa próteses (dentária, metálica, silicone)?', choices=[('', ''), ('Sim', 'Sim'), ('Não', 'Não')])
    proteses_quais = StringField(default='Quais?')
    # Histórico Familiar
    gene = SelectField('Doenças Familiares (câncer, diabetes, pressão alta, etc.)?', choices=[('', ''), ('Sim', 'Sim'), ('Não', 'Não')])
    gene_quais = StringField(default='Quais?')
    diabetes = SelectField('Diabetes?', choices=[('', ''), ('Sim', 'Sim'), ('Não', 'Não')])
    pressao = SelectField('Pressão Alta/Baixa?', choices=[('', ''), ('Sim', 'Sim'), ('Não', 'Não')])
    doenca_renal = SelectField('Doença Renal?', choices=[('', ''), ('Sim', 'Sim'), ('Não', 'Não')])
    epilepsia = SelectField('Epilepsia?', choices=[('', ''), ('Sim', 'Sim'), ('Não', 'Não')])
    # Hábitos e Estilo de Vida
    menstruacao = SelectField('Ciclo Menstrual Regular?', choices=[('', ''), ('Sim', 'Sim'), ('Não', 'Não')])
    gestante = SelectField('Está Grávida ou Amamentando?', choices=[('', ''), ('Sim', 'Sim'), ('Não', 'Não')])
    tratamento_estetico = SelectField('Já fez algum tratamento estético anteriormente?', choices=[('', ''), ('Sim', 'Sim'), ('Não', 'Não')])
    tratamento_estetico_quais = StringField(default='Quais?')
    cosmeticos = SelectField('Faz uso de cosméticos diariamente?', choices=[('', ''), ('Sim', 'Sim'), ('Não', 'Não')])
    cosmeticos_quais = StringField(default='Quais?')
    filtro_solar = SelectField('Faz uso de filtro solar diariamente?', choices=[('', ''), ('Sim', 'Sim'), ('Não', 'Não')])
    filtro_solar_quais = StringField(default='Quais?')
    bronzeamento = SelectField('Faz bronzeamento artificial ou natural?', choices=[('', ''), ('Sim', 'Sim'), ('Não', 'Não')])
    bronzeamento_quais = StringField(default='Quais?')

    # ... (outros campos da anamnese continuam aqui) ...
    obs = TextAreaField('Observações')
    assinatura = StringField('Campo Assinado:(Nome por extenso)', validators=[DataRequired()])
    documento = StringField('CPF', validators=[DataRequired()])
    data = DateField('Data:', validators=[DataRequired()])
    enviar = SubmitField('Registrar Ficha')

# --- Gestão Financeira ---
class RelatorioMEIForm(FlaskForm):
    apuracao = DateField('Periodo de Apuração:', validators=[DataRequired()])
    cnpj = StringField('CNPJ:', default='000111222333/0001')
    razao_social = StringField('Razão Social:', default='Estetic Cre Bortoli Depil Site')
    pdn = DecimalField('Receita de Venda de Produtos com Dispensa de NF')
    pen = DecimalField('Receita de Venda de Produtos com Emissão de NF')
    sdn = DecimalField('Receita de Prestação de Serviços com Dispensa de NF')
    sen = DecimalField('Receita de Prestação de Serviços com Emissão de NF')
    local = StringField('Local: ', validators=[DataRequired()])
    data = DateField('Data:', validators=[DataRequired()])
    assinatura = StringField('Assinatura / CPF:', validators=[DataRequired()])
    enviar = SubmitField('Registrar Relatório')

class CustosFixosForm(FlaskForm):
    alu = DecimalField('Aluguel: ')
    IPTU = DecimalField('IPTU: ')
    luz = DecimalField('Taxa de Luz:')
    agua = DecimalField('Taxa de Agua:')
    tel = DecimalField('Gastos com Telefone:')
    net = DecimalField('Gastos com Internet:')
    alu_car = DecimalField('Taxa de Aluguel da Máquina de Cartão:', validators=[DataRequired()])
    MEI = DecimalField('Taxa MEI:', validators=[DataRequired()])
    descart = DecimalField('Gastos com Material Descartável: ')
    n_prod = DecimalField('Investimento em Novos Produtos & Lançamentos:')
    equip = DecimalField(' Financimanto de Equipamentos:')
    mkt = DecimalField('Gastos com Marketing:')
    prolab = DecimalField('Retirada de Pró-Labore:', validators=[DataRequired()])
    terc = DecimalField('Outros funcionários ou Prestadores de Serviços: ')
    reserva = DecimalField('Retirada Formação de Reserva de Emergência:')
    enviar = SubmitField('Registrar Custos')

class InsumoForm(FlaskForm):
    tipo_servico = StringField('Tipo de Serviço:', validators=[DataRequired()])
    nome_insumo = StringField('Tipo de Material:')
    qtde_fechada = IntegerField('Quantidade do Pacote Fechado:')
    qfe_unidade = SelectField('Medida:', choices=[('Escolha', 'Escolha'), ('Par', 'Par'), ('Unidade', 'Unidade'), ('Metro', 'Metro'), ('Centimetro', 'Centimetro'), ('Litro', 'Litro'), ('Mililitro', 'Mililitro'), ('Grama', 'Grama'), ('Miligrama', 'Miligrama')])
    qtde_fracionada = DecimalField('Quantidade usada no atendimento: ')
    qfr_unidade = SelectField('Medida:', choices=[('Escolha', 'Escolha'), ('Par', 'Par'), ('Unidade', 'Unidade'), ('Metro', 'Metro'), ('Centimetro', 'Centimetro'), ('Litro', 'Litro'), ('Mililitro', 'Mililitro'), ('Grama', 'Grama'), ('Miligrama', 'Miligrama')])
    preco_fechado = DecimalField('Preço do Pacote Fechado:')
    enviar = SubmitField('Registrar Insumo')

class DepreciacaoForm(FlaskForm):
    obj = StringField('Nome do Equipamento:')
    preco_custo = DecimalField('Preço de Custo do Aparelho: ')
    vida_util = IntegerField('Anos de Uso: ')
    enviar = SubmitField('Registrar Depreciação')

class MargemForm(FlaskForm):
    servico = StringField('Tipo de Tratamento:')
    preco_oferta = DecimalField('Preço Ofertado ao Consumidor:')
    enviar = SubmitField('Registrar Margem')

class MarkupForm(FlaskForm):
    txmc = DecimalField('Taxa da Máquina de Cartão: ')
    mg = DecimalField('Percentual de Margem de Lucro:')
    enviar = SubmitField('Registrar Markup')

