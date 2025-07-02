import sqlite3 as sql

# Database file name
DB_FILE = "livro_caixa.db"

def create_tables():
    """Creates database tables if they don't exist."""
    with sql.connect(DB_FILE, check_same_thread=False) as connection:
        cur = connection.cursor()

        # Helper function for executing SQL
        def execute_sql(sql_statement):
            cur.execute(sql_statement)

        # Table creation statements with improved formatting and comments
        execute_sql("""
            CREATE TABLE IF NOT EXISTS post (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                Ultima_Atualizacao DATETIME DEFAULT (CURRENT_TIMESTAMP),
                imagem TEXT,
                tema TEXT,
                post TEXT(10000),
                comentario TEXT(10000)
            );
        """)

        execute_sql("""
            CREATE TABLE IF NOT EXISTS enquete (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                resposta TEXT,
                Ultima_Atualizacao DATETIME DEFAULT (CURRENT_TIMESTAMP)  
            );
        """)

        execute_sql("""
            CREATE TABLE IF NOT EXISTS clientes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT,
                cpf TEXT,
                email TEXT(60),
                telefone TEXT(20),
                Ultima_Atualizacao DATETIME DEFAULT (CURRENT_TIMESTAMP)   
            );
        """)

        execute_sql("""
            CREATE TABLE IF NOT EXISTS anaminese (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT,
                nascimento DATE,
                profissao TEXT,
                endereco TEXT,
                telefone INTEGER,
                indicacao TEXT,
                queixa_principal TEXT,
                alergia_medicamentos TEXT,
                alergia_aspirina TEXT,
                tratamentos_medicos TEXT,
                cirurgia TEXT,
                uso_medicamentos TEXT,
                proteses TEXT,
                doencas_familiares TEXT,
                diabetes TEXT,
                pressao TEXT,
                doenca_renal TEXT,
                epilepsia TEXT,
                menstruacao TEXT,
                gestacao TEXT,
                tratamento_estetico TEXT,
                uso_cosmeticos TEXT,
                filtro_solar TEXT,
                bronzeamento TEXT,
                observacoes TEXT,
                assinatura TEXT,
                cpf INTEGER,
                Ultima_Atualizacao DATETIME DEFAULT (CURRENT_TIMESTAMP)
            ); 
        """)

        execute_sql("""
            CREATE TABLE IF NOT EXISTS agenda (   
                Cliente TEXT,
                Dia DATE,
                Hora TIME,
                Atendimento TEXT(50),
                Ultima_Atualizacao DATETIME DEFAULT (CURRENT_TIMESTAMP),
                PRIMARY KEY (Ultima_Atualizacao)  -- Assuming this is intended as the primary key
            );
        """)

        execute_sql("""
            CREATE TABLE IF NOT EXISTS compras (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                Produto TEXT,
                Marca TEXT,
                Quantidade INTEGER,
                Unidade TEXT,
                Validade DATE,
                Preco_Unitario REAL,
                Custo_Estoque REAL GENERATED ALWAYS AS (Preco_Unitario * Quantidade) STORED,
                Total_Compras REAL,
                Media_Compras REAL, 
                Ultima_Atualizacao DATETIME DEFAULT (CURRENT_TIMESTAMP)  
            );
        """)

        execute_sql("""
            CREATE TABLE IF NOT EXISTS vendas_produtos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                Cliente TEXT,
                Produto TEXT,
                Marca TEXT,
                Validade DATE, 
                Quantidade INTEGER,    
                Preco_aVista REAL,
                Valor_Total REAL GENERATED ALWAYS AS (preco_aVista * Quantidade) STORED,
                Desconto INTEGER,  
                Preco_Final REAL GENERATED ALWAYS AS (Valor_Total - ((Valor_Total * Desconto) / 100) )STORED,  
                Qtde_Parcelas INTEGER,
                Preco_Parcelado REAL GENERATED ALWAYS AS (Preco_Final / Qtde_Parcelas) STORED, 
                Total_Vendas_Produtos REAL,
                Media_Vendas_Produtos REAL, 
                Ultima_Atualizacao DATETIME DEFAULT (CURRENT_TIMESTAMP) 
            );
        """)

        execute_sql("""
            CREATE TABLE IF NOT EXISTS vendas_servicos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                Cliente TEXT,
                Servico TEXT,
                Tempo_Minutos INTEGER,
                Desconto INTEGER,
                Preco REAL,
                Preco_Final REAL GENERATED ALWAYS AS (preco - (preco * desconto / 100)) STORED,   
                Observacoes TEXT,
                Total_Vendas_Servicos REAL,
                Media_Vendas_Servicos REAL, 
                Ultima_Atualizacao DATETIME DEFAULT (CURRENT_TIMESTAMP) 
            ); 
        """)

        execute_sql("""
            CREATE TABLE IF NOT EXISTS colaboradores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                Nome TEXT,   
                Endereco TEXT,
                Cidade TEXT,
                Email TEXT,
                Telefone INTEGER,    
                Funcao TEXT,
                Regime_Empregaticio TEXT,
                Salario REAL,
                INSS REAL GENERATED ALWAYS AS (salario * 0.08) STORED,
                Total_INSS REAL,
                FGTS REAL GENERATED ALWAYS AS (salario * 0.075) STORED,
                Total_FGTS REAL,
                Total_Contribuicoes REAL GENERATED ALWAYS AS (Total_INSS + Total_FGTS) STORED,        
                Media_Contribuicoes REAL,
                observacoes TEXT,
                Ultima_Atualizacao DATETIME DEFAULT (CURRENT_TIMESTAMP)
            );
        """)

        execute_sql("""
            CREATE TABLE IF NOT EXISTS relatorioMEI (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                Apuracao DATETIME,
                CNPJ INTEGER,
                Razao_Social TEXT,
                Produto_Dispensa_NF REAL,
                Produto_Emissao_NF REAL,
                Total_Receita_Produtos REAL GENERATED ALWAYS AS (Produto_Dispensa_NF + Produto_Emissao_NF) STORED,
                Servico_Dispensa_NF REAL,
                Servico_Emissao_NF REAL,
                Total_Receita_Servicos REAL GENERATED ALWAYS AS (Servico_Dispensa_NF + Servico_Emissao_NF) STORED,
                Total_Geral_Receitas REAL GENERATED ALWAYS AS (Total_Receita_Produtos + Total_Receita_Servicos) STORED,
                Local TEXT,
                Data DATETIME DEFAULT (CURRENT_TIMESTAMP),
                Assinatura TEXT
            );
        """)

        execute_sql("""
            CREATE TABLE IF NOT EXISTS impostos (
                id INTEGER PRIMARY KEY AUTOINCREMENT, 
                aluguel REAL,
                IPTU REAL, 
                luz REAL,
                agua REAL, 
                internet REAL,
                telefone REAL,  
                aluguel_Maquina_Cartao REAL,
                MEI REAL,
                Total_Taxas_Impostos REAL GENERATED ALWAYS AS (aluguel + IPTU + luz + agua + internet + telefone  + aluguel_Maquina_Cartao + MEI) STORED,        
                descartaveis REAL,
                novos_produtos REAL,
                equipamentos REAL,
                Total_Manutencao REAL GENERATED ALWAYS AS (descartaveis + novos_produtos + equipamentos) STORED,
                marketing REAL,
                prolabore REAL,
                terceiros REAL, 
                inss REAL,
                fgts REAL,
                depreciacao REAL,
                reserva REAL,
                Total_Gestao REAL GENERATED ALWAYS AS (marketing + prolabore + terceiros + inss + fgts + depreciacao + reserva) STORED,
                Total_Custos_Fixos REAL GENERATED ALWAYS AS (Total_Taxas_Impostos + Total_Manutencao + Total_Gestao ) STORED,
                Media_Custos_Fixos REAL,
                Ultima_Atualizacao DATETIME DEFAULT (CURRENT_TIMESTAMP)           
            );
        """)

        execute_sql("""
            CREATE TABLE IF NOT EXISTS insumos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                Tipo_Servico TEXT,
                Nome_Insumo TEXT,
                Quantidade_Fechada INTEGER,
                unidade_total TEXT,
                Preco_Fechado REAL,
                Quantidade_Fracionada INTEGER,
                unidade_fracionada TEXT,           
                Quantidade_Atendimento REAL GENERATED ALWAYS AS (Quantidade_Fechada / Quantidade_Fracionada) STORED,
                Custo_Secao REAL GENERATED ALWAYS AS (Preco_Fechado / Quantidade_Atendimento) STORED,
                Total_Insumos REAL, 
                Media_Insumos REAL, 
                Ultima_Atualizacao DATETIME DEFAULT (CURRENT_TIMESTAMP)             
            );
        """)

        execute_sql("""
            CREATE TABLE IF NOT EXISTS depreciacao (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                Objeto TEXT,
                Preco_Custo REAL,
                Anos_Uso INTEGER,            
                Valor_Depreciacao REAL GENERATED ALWAYS AS (Preco_Custo / (Anos_Uso * 12)) STORED,
                Total_Depreciacao REAL,
                Media_Depreciacao REAL, 
                Ultima_Atualizacao DATETIME DEFAULT (CURRENT_TIMESTAMP)          
            );
        """)

        execute_sql("""
            CREATE TABLE IF NOT EXISTS margem (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                Tipo_Servico TEXT,
                Preco_Ofertado REAL,
                Prolabore REAL,
                Prolabore_hora REAL GENERATED ALWAYS AS (Prolabore/ 160) STORED,
                Total_Insumos REAL,        
                Custo_Variavel REAL GENERATED ALWAYS AS (Total_Insumos + Prolabore_hora) STORED,           
                Custo_Fixo REAL,                       
                Pagar_Custo_Fixo REAL GENERATED ALWAYS AS (Preco_Ofertado - Custo_Variavel) STORED,   
                Projecao_Atendimentos REAL GENERATED ALWAYS AS (Custo_Fixo / Pagar_Custo_Fixo) STORED,
                Ultima_Atualizacao DATETIME DEFAULT (CURRENT_TIMESTAMP)       
            );
        """)

        execute_sql("""
            CREATE TABLE IF NOT EXISTS markup (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                Tipo_Servico TEXT,
                Preco_Ofertado REAL,
                Impostos REAL,
                Depreciacao REAL, 
                Vendas REAL,
                Custo_Fixo REAL GENERATED ALWAYS AS ((Impostos + Depreciacao) / Vendas) STORED,
                Insumos REAL,
                Pessoal REAL,            
                Taxa_Maq_Cartao REAL,        
                Custo_Variavel REAL GENERATED ALWAYS AS ((Insumos / (Insumos + Pessoal)) + (Pessoal / (Insumos + Pessoal)) + Taxa_Maq_Cartao) STORED,
                Margem_Lucro REAL,            
                Indice_Markup REAL GENERATED ALWAYS AS (1 / (1 - Custo_Fixo + Custo_Variavel + Margem_Lucro)) STORED,
                Preco_Justo REAL GENERATED ALWAYS AS (Custo_Variavel * Indice_Markup) STORED, 
                Ultima_Atualizacao DATETIME DEFAULT (CURRENT_TIMESTAMP)           
            ); 
        """)

        print("Base de Dados ATIVA!")

# Initialize the database
create_tables()
