# /home/wander/crebortoli/sig/form.py

from flask_wtf import FlaskForm
from wtforms import (StringField, PasswordField, SubmitField, TextAreaField, 
                    IntegerField, DecimalField, EmailField, TelField, 
                    SearchField, DateField, SelectField, TimeField)
from wtforms.validators import DataRequired
import webbrowser

class Login(FlaskForm):
    senha = PasswordField('Senha:', validators=[DataRequired()])
    enviar = SubmitField('Enviar')

# Gestão de Clientes
# Cadastro de Clientes 
class cadClientes(FlaskForm):
    nome = StringField('Nome:', validators=[DataRequired()])
    cpf = IntegerField('CPF', validators=[DataRequired()])
    email = EmailField('Email:', validators=[DataRequired()])
    telefone = TelField('Telefone:', validators=[DataRequired()])
    enviar = SubmitField('Enviar')

# Pesquisa
class formClientes(FlaskForm):
    pesquisa_clientes = SearchField('pesquisa', validators=[DataRequired()])
    enviar_clientes = SubmitField('Enviar')
    
# Gestão de Compras
# Cadastro de Produtos
class cadCompras(FlaskForm):
    produto = StringField('Produto:', validators=[DataRequired()])
    marca  = StringField('Marca:', validators=[DataRequired()])
    quantidade = IntegerField('Quantidade: ', validators=[DataRequired()])
    unidade = StringField('Unidade:', validators=[DataRequired()])
    validade = DateField('Validade', validators=[DataRequired()])
    preco = DecimalField('Preço', validators=[DataRequired()])
    enviar = SubmitField('Enviar')

# Gestão de Vendas
# Vendas de Produtos
class vendaProduto(FlaskForm):
    cliente = StringField('Nome do Cliente:', validators=[DataRequired()])
    produto = TextAreaField('Produto:', validators=[DataRequired()])
    marca  = StringField('Marca:', validators=[DataRequired()])
    quantidade = IntegerField('Quantidade: ', validators=[DataRequired()])
    validade = DateField('Validade:', validators=[DataRequired()])
    preco_aVista = DecimalField('Preço aVista: ', validators=[DataRequired()])
    desconto = DecimalField('Desconto:', validators=[DataRequired()])
    qtde_parcelas = IntegerField('Quantidade de Parcelas:', validators=[DataRequired()])   
    enviar = SubmitField('Enviar')

# Vendas de Serviços
class vendaServicos(FlaskForm):
    cliente = StringField('Nome do Cliente:', validators=[DataRequired()])
    servico = StringField('Serviço:', validators=[DataRequired()])
    tempo_min = TimeField('Tempo/minuto:', validators=[DataRequired()])
    desconto = DecimalField('Desconto:', validators=[DataRequired()])
    preco = DecimalField('Valor:', validators=[DataRequired()])
    observacoes = TextAreaField('Observações', validators=[DataRequired()])
    enviar = SubmitField('Enviar')

# Gestão de Estoque
class formEstoque(FlaskForm):
    pesquisa_estoque = SearchField('pesquisa', validators=[DataRequired()])
    enviar_estoque = SubmitField('Enviar')  

# Gestão de Pessoal
class formPessoal(FlaskForm):
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
    enviar = SubmitField('Enviar')
    
# Ficha de Anaminese
class formAnaminese(FlaskForm):
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
    alergia_aspirina = SelectField('Alergia a Aspirina (Àcido Salicilico):', choices=[('', ''), ('Sim', 'Sim'), ('Não', 'Não')])
    alergia_aspirina_quais = StringField(default='Quais?')
    tratamentos_medicos = SelectField('Fez/Faz Tratamento Médico:', choices=[('', ''), ('Sim', 'Sim'), ('Não', 'Não')])
    tratamentos_medicos_quais = StringField(default='Quais?')
    cirurgias = SelectField('Passou por cirurgias:', choices=[('', ''), ('Sim', 'Sim'), ('Não', 'Não')])
    cirurgias_quais = StringField(default='Quais?')
    medicamentos = SelectField('Usa medicamentos?:', choices=[('', ''), ('Sim', 'Sim'), ('Não', 'Não')])
    medicamentos_quais = StringField(default='Quais?')
    proteses = SelectField('Usa Marcapasso, pinos ou placas?:', choices=[('', ''), ('Sim', 'Sim'), ('Não', 'Não')])
    proteses_quais = StringField(default='Quais?')
    gene = SelectField('Histórico de doenças na Familia?:', choices=[('', ''), ('Sim', 'Sim'), ('Não', 'Não')])
    gene_quais = StringField(default='Quais?')
    diabetes = SelectField('Tem diabetes?:', choices=[('', ''), ('Sim', 'Sim'), ('Não', 'Não')], validators=[DataRequired()])
    pressao = SelectField('Tem problemas de pressão?:', choices=[('', ''), ('Sim', 'Sim'), ('Não', 'Não')]) 
    pressao_quais = StringField(default='Quais?')
    doenca_renal = SelectField('Tem doença renal crônica?:', choices=[('', ''), ('Sim', 'Sim'), ('Não', 'Não')], validators=[DataRequired()])
    epilepsia = SelectField('Tem problemas de epilepsia (convulsões com desmaio)?:', choices=[('', ''), ('Sim', 'Sim'), ('Não', 'Não')])
    epilepsia_quais = StringField(default='Observações:')
    menstruacao = SelectField('Ciclo Menstrual?:', choices=[('', ''), ('Regular', 'Regular'), ('Irregular', 'Irregular')])
    menstruacao_quais = StringField(default='Observações:')
    gestante = SelectField('Esta gestante?:', choices=[('', ''), ('Sim', 'Sim'), ('Não', 'Não')])
    gestante_quais = StringField(default='Quantos meses?')
    tratamento_estetico = SelectField('Faz/Fez Quais tratamentos estéticos?:', choices=[('', ''), ('Sim', 'Sim'), ('Não', 'Não')])
    tratamento_estetico_quais = StringField(default='Quais?')
    cosmeticos = SelectField('Usa cosmeticos?:', choices=[('', ''), ('Sim', 'Sim'), ('Não', 'Não')])
    cosmeticos_quais = StringField(default='Quais?')
    filtro_solar = SelectField('Usa Filtro Solar?:', choices=[('', ''), ('Sim', 'Sim'), ('Não', 'Não')])
    filtro_solar_quais = StringField(default='Quais?')
    bronzeamento = SelectField('Faz bronzeamento?:', choices=[('', ''), ('Sim', 'Sim'), ('Não', 'Não')])
    bronzeamento_quais = StringField(default='Quais?')
    obs = TextAreaField('Observações')
    assinatura = StringField('Campo Assinado:(Nome por extenso)', validators=[DataRequired()])
    documento = StringField('CPF', validators=[DataRequired()])
    data = DateField('Data:', validators=[DataRequired()])
    enviar = SubmitField('Enviar')

# Gestão Financeira
def access():
    url = webbrowser.open("https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/dasnsimei.app/Identificacao", new=0, autoraise=True)
    return url

class formRelatorioMEI(FlaskForm):
    # Relatório Mensal das Receitas Brutas:
    apuracao = DateField('Periodo de Apuração:', validators=[DataRequired()])
    cnpj = StringField('CNPJ:', default='000111222333/0001')
    razao_social = StringField('Razão Social:', default='Estetic Cre Bortoli Depil Site')   
    # Receita Bruta Mensal - Revenda de Mercadorias(Comércio)
    pdn = DecimalField('Receita de Venda de Produtos com Dispensa de emissão de Nota Fiscal')
    pen = DecimalField('Receita de Venda de Produtos com Emissão de Nota Fiscal')
    # Total das vendas de produtos (campo somatório na tabela sql)
    sdn = DecimalField('Receita de Prestação de Serviços com Dispensa de emissão de Nota Fiscal')
    sen = DecimalField('Receita de Prestação de Serviços com Emissão de Nota Fiscal')
    # Total das vendas de prestação de serviços (campo somatório na tabela sql)
    # Total Geral de receitas brutas
    # Rodapé
    local = StringField('Local: ', validators=[DataRequired()])
    data = DateField('Data:', validators=[DataRequired()])
    assinatura = StringField('Assinatura / CPF:', validators=[DataRequired()])
    enviar = SubmitField('Enviar')

# Gestão Financeira
# Custos Fixos
class formImpostos(FlaskForm):   
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
    reserva = DecimalField('Retirada Formação de Reserva de Emergência: (minimo 6 a 12x o total de Custos Fixos.)')
    diluicao = IntegerField('Fator Percentual de Diluição de Custos:')
    minimo = IntegerField('Atendimntos minimos:')
    enviar = SubmitField('Enviar')
    
class formInsumos(FlaskForm):
    tipo_servico = StringField('Tipo de Serviço:', validators=[DataRequired()])
    nome_insumo = StringField('Tipo de Material:')
    qtde_fechada = IntegerField('Quantidade do Pacote Fechado:')
    qfe_unidade = SelectField('Medida:', choices=[('Escolha', 'Escolha'), ('Par', 'Par'), ('Unidade', 'Unidade'), ('Metro', 'Metro'), ('Centimetro', 'Centimetro'), ('Litro', 'Litro'), ('Mililitro', 'Mililitro'), ('Grama', 'Grama'), ('Miligrama', 'Miligrama')])
    qtde_fracionada = DecimalField('Quantidade usada no atendimento: ')
    qfr_unidade = SelectField('Medida:', choices=[('Escolha', 'Escolha'), ('Par', 'Par'), ('Unidade', 'Unidade'), ('Metro', 'Metro'), ('Centimetro', 'Centimetro'), ('Litro', 'Litro'), ('Mililitro', 'Mililitro'), ('Grama', 'Grama'), ('Miligrama', 'Miligrama')])
    preco_fechado = DecimalField('Preço do Pacote Fechado:')
    enviar = SubmitField('Enviar')

class formDepreciacao(FlaskForm):
    obj = StringField('Nome do Equipamento:')
    preco_custo = DecimalField('Preço de Custo do Aparelho: ')
    vida_util = IntegerField('Anos de Uso: ')
    enviar = SubmitField('Enviar')
    
class formMargem(FlaskForm):
    servico = StringField('Tipo de Tratamento:')
    preco_oferta = DecimalField('Preço Ofertado ao Consumidor:')
    enviar = SubmitField('Enviar')
    
class formDelete(FlaskForm):
    delete = SubmitField('Deletar') # Removido o 'confirm' para uma melhor experiência. A confirmação pode ser adicionada no template HTML se necessário.

class formMarkup(FlaskForm):
    txmc = DecimalField('Taxa da Máquina de Cartão: ')
    mg = DecimalField('Percentual de Margem de Lucro:')
    enviar = SubmitField('Enviar')
