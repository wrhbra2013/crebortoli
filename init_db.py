import sqlite3 as sql
#Gerando conexão e o arquivo de banco de dados.
connection  = sql.connect("livro_caixa.db", check_same_thread=False)

#Ativando a conexão
cur = connection.cursor()

#Criar tabelas

cur.execute('''
CREATE TABLE IF NOT EXISTS post(
    id integer PRIMARY KEY AUTOINCREMENT,
    Ultima_Atualizacao DATETIME DEFAULT (CURRENT_TIMESTAMP),
    imagem text,
    tema text,
    post text(10000),
    comentario text(10000)
);''')
cur.execute('''
CREATE TABLE IF NOT EXISTS enquete(
    id integer PRIMARY KEY AUTOINCREMENT,
    resposta text,
    Ultima_Atualizacao DATETIME DEFAULT (CURRENT_TIMESTAMP)  

);''')

cur.execute('''
CREATE TABLE IF NOT EXISTS clientes(
    id integer PRIMARY KEY AUTOINCREMENT,
    nome text,
    cpf text,
    email text(60),
    telefone text(20),
    Ultima_Atualizacao DATETIME DEFAULT (CURRENT_TIMESTAMP)   
);''')

cur.execute('''CREATE TABLE IF NOT EXISTS anaminese(
    id integer PRIMARY KEY AUTOINCREMENT,
    nome text,
    nascimento date,
    profissao text,
    endereco text,
    telefone integer,
    indicacao text,
    queixa_principal text,
    alergia_medicamentos text,
    alergia_aspirina text,
    tratamentos_medicos text,
    cirurgia text,
    uso_medicamentos text,
    proteses text,
    doencas_familiares text,
    diabetes text,
    pressao text,
    doenca_renal text,
    epilepsia text,
    menstruacao text,
    gestacao text,
    tratamento_estetico text,
    uso_cosmeticos text,
    filtro_solar text,
    bronzeamento text,
    observacoes text,
    assinatura text,
    cpf integer,
    Ultima_Atualizacao DATETIME DEFAULT (CURRENT_TIMESTAMP)
); ''')

 
cur.execute('''CREATE TABLE  IF NOT EXISTS agenda(   
    Cliente text,
    Dia DATE,
    Hora TIME,
    Atendimento text(50),
    Ultima_Atualizacao DATETIME DEFAULT (CURRENT_TIMESTAMP) PRIMARY KEY   
    );''')
cur.execute('''
CREATE TABLE IF NOT EXISTS compras (
    id integer PRIMARY KEY AUTOINCREMENT,
    Produto text,
    Marca text,
    Quantidade int,
    Unidade text,
    Validade DATE,
    Preco_Unitario real,
    Custo_Estoque real generated always as (Preco_Unitario * Quantidade) stored,
    Total_Compras real,
    Media_Compras real, 
    Ultima_Atualizacao DATETIME DEFAULT (CURRENT_TIMESTAMP)  
);''')

cur.execute('''
CREATE TABLE IF NOT EXISTS vendas_produtos (
    id integer PRIMARY KEY AUTOINCREMENT,
    Cliente text,
    Produto text,
    Marca text,
    Validade date, 
    Quantidade integer,    
    Preco_aVista real,
    Valor_Total real generated always as (preco_aVista * Quantidade) stored,
    Desconto integer,  
    Preco_Final real generated always as (Valor_Total - ((Valor_Total * Desconto) / 100) )stored,  
    Qtde_Parcelas integer,
    Preco_Parcelado real generated always as (Preco_Final / Qtde_Parcelas) stored, 
    Total_Vendas_Produtos real,
    Media_Vendas_Produtos real, 
    Ultima_Atualizacao DATETIME DEFAULT (CURRENT_TIMESTAMP) 
);''')

cur.execute('''
CREATE TABLE IF NOT EXISTS vendas_servicos (
    id integer PRIMARY KEY AUTOINCREMENT,
    Cliente text,
    Servico text,
    Tempo_Minutos int,
    Desconto int,
    Preco real,
    Preco_Final real generated always as (preco - (preco * desconto / 100)) stored,   
    Observacoes text,
    Total_Vendas_Servicos real,
    Media_Vendas_Servicos real, 
    Ultima_Atualizacao DATETIME DEFAULT (CURRENT_TIMESTAMP) 
); 
''')


cur.execute('''CREATE TABLE IF NOT EXISTS colaboradores (
    id integer PRIMARY KEY AUTOINCREMENT,
    Nome text,   
    Endereco text,
    Cidade text,
    Email text ,
    Telefone integer,    
    Funcao text,
    Regime_Empregaticio text,
    Salario real,
    INSS real generated always as( salario * 0.08) stored,
    Total_INSS real,
    FGTS real generated always as (salario * 0.075) stored,
    Total_FGTS real,
    Total_Contribucoes real generated always as (Total_INSS + Total_FGTS) stored,        
    Media_Contribuicoes real,
    observacoes text,
    Ultima_Atualizacao DATETIME DEFAULT (CURRENT_TIMESTAMP)
     
             
);''')

cur.execute(''' CREATE TABLE IF NOT EXISTS relatorioMEI (
            id integer PRIMARY KEY AUTOINCREMENT,
            Apuracao DATETIME,
            CNPJ integer,
            Razao_Social text,
            Produto_Dispensa_NF real,
            Produto_Emissao_NF real,
            Total_Receita_Produtos real generated alaways as (Produto_Dispensa_NF + Produto_Emissao_NF) stored,
            Servico_Dispensa_NF real,
            Servico_Emissao_NF real,
            Total_Receita_Servicos real generated always as (Servico_Dispensa_NF + Servico_Emissao_NF) stored,
            Total_Geral_Receitas real generated always as (Total_Receita_Produtos + Total_Receita_Servicos) stored,
            Local text,
            Data DATETIME DEFAULT (CURRENT_TIMESTAMP),
            Assinatura text
);''')

cur.execute(''' CREATE TABLE IF NOT EXISTS impostos (
            id integer PRIMARY KEY AUTOINCREMENT, 
            aluguel real,
            IPTU real, 
            luz real,
            agua real, 
            internet real,
            telefone real,  
            aluguel_Maquina_Cartao real,
            MEI real,
            Total_Taxas_Impostos real generated always as (aluguel + IPTU + luz + agua + internet + telefone  + aluguel_Maquina_Cartao + MEI) stored,        
            descartaveis real,
            novos_produtos real,
            equipamentos real,
            Total_Manutencao real generated always as (descartaveis + novos_produtos + equipamentos) stored,
            marketing real,
            prolabore real,
            terceiros real, 
            inss real,
            fgts real,
            depreciacao real,
            reserva real,
            Total_Gestao real generated always as (marketing + prolabore + terceiros + inss + fgts + depreciacao + reserva) stored,
            Total_Custos_Fixos real generated always as (Total_Taxas_Impostos + Total_Manutencao + Total_Gestao ) stored,
            Media_Custos_Fixos real,
            Ultima_Atualizacao DATETIME DEFAULT (CURRENT_TIMESTAMP)           

);''')

cur.execute(''' CREATE TABLE IF NOT EXISTS insumos(
            id integer PRIMARY KEY AUTOINCREMENT,
            Tipo_Servico text,
            Nome_Insumo text,
            Quantidade_Fechada integer,
            unidade_total text,
            Preco_Fechado real,
            Quantidade_Fracionada integer,
            unidade_fracionada text,           
            Quantidade_Atendimento real generated always as (Quantidade_Fechada / Quantidade_Fracionada) stored,
            Custo_Secao real generated always as (Preco_Fechado / Quantidade_Atendimento) stored,
            Total_Insumos real, 
            Media_Insumos real, 
            Ultima_Atualizacao DATETIME DEFAULT (CURRENT_TIMESTAMP) 
            
);''')

cur.execute('''CREATE TABLE IF NOT EXISTS depreciacao(
            id integer PRIMARY KEY AUTOINCREMENT,
            Objeto text,
            Preco_Custo real,
            Anos_Uso integer,            
            Valor_Depreciacao real generated always as (Preco_Custo / (Anos_Uso * 12)) stored,
            Total_Depreciacao real,
            Media_Depreciacao real, 
            Ultima_Atualizacao DATETIME DEFAULT (CURRENT_TIMESTAMP)          
);''')

cur.execute('''CREATE TABLE IF NOT EXISTS margem(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            Tipo_Servico text,
            Preco_Ofertado real,
            Prolabore real,
            Prolabore_hora  real generated always as (Prolabore/ 160) stored,
            Total_Insumos real,        
            Custo_Variavel real generated always as (Total_Insumos + Prolabore_hora) stored,           
            Custo_Fixo real,                       
            Pagar_Custo_Fixo real generated always as (Preco_Ofertado - Custo_Variavel) stored,   
            Projecao_Atendimentos real generated always as (Custo_Fixo / Pagar_Custo_Fixo) stored,
            Ultima_Atualizacao DATETIME DEFAULT (CURRENT_TIMESTAMP)       
);''')

cur.execute(''' CREATE TABLE IF NOT EXISTS markup(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            Tipo_Servico text,
            Preco_Ofertado real,
            Impostos real,
            Depreciacao real, 
            Vendas real,
            Custo_Fixo real generated always as ((Impostos + Depreciacao) / Vendas) stored,
            Insumos real,
            Pessoal real,            
            Taxa_Maq_Cartao real,        
            Custo_Variavel real generated always as ((Insumos / (Insumos + Pessoal)) + (Pessoal / (Insumos + Pessoal)) + Taxa_Maq_Cartao) stored,
            Margem_Lucro real,            
            Indice_Markup real generated always as (1 / (1 - Custo_Fixo + Custo_Variavel + Margem_Lucro)) stored,
            Preco_Justo real generated always as (Custo_Variavel * Indice_Markup) stored, 
            Ultima_Atualizacao DATETIME DEFAULT (CURRENT_TIMESTAMP)           
); ''')

print("Tabelas carregadas com SUCESSO!!!")

