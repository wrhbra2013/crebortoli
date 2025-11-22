import os
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

# --- Database Connection Details ---
# It's recommended to use environment variables for security.
DB_NAME = os.environ.get("DB_NAME", "livro_caixa")
DB_USER = os.environ.get("DB_USER", "postgres")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "wander") # Change to your password
DB_HOST = os.environ.get("DB_HOST", "127.0.0.1")
DB_PORT = os.environ.get("DB_PORT", "5432")

def create_database_if_not_exists():
    """Connects to the default 'postgres' database to create the target database if it doesn't exist."""
    try:
        # Connect to the default database
        conn = psycopg2.connect(user=DB_USER, password=DB_PASSWORD, host=DB_HOST, port=DB_PORT, dbname='postgres')
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()

        # Check if the database exists
        cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (DB_NAME,))
        exists = cur.fetchone()

        if not exists:
            print(f"Database '{DB_NAME}' does not exist. Creating it...")
            cur.execute(f"CREATE DATABASE {DB_NAME}")
            print(f"Database '{DB_NAME}' created successfully.")
        else:
            print(f"Database '{DB_NAME}' already exists.")

        cur.close()
        conn.close()
    except psycopg2.OperationalError as e:
        print(f"Error connecting to PostgreSQL or creating database: {e}")
        # This might happen if the postgres server is not running or credentials are wrong.
        # Exit or handle as appropriate for your application.
        raise

def get_connection():
    """Establishes a connection to the PostgreSQL database."""
    conn_string = f"dbname='{DB_NAME}' user='{DB_USER}' password='{DB_PASSWORD}' host='{DB_HOST}' port='{DB_PORT}'"
    try:
        conn = psycopg2.connect(conn_string)
        return conn
    except psycopg2.OperationalError as e:
        print(f"Could not connect to the database '{DB_NAME}'. Please ensure it exists and the server is running. Error: {e}")
        raise

def create_tables():
    """Creates database tables if they don't exist using a PostgreSQL connection."""
    commands = [
        """
        CREATE TABLE IF NOT EXISTS post (
            id SERIAL PRIMARY KEY,
            Ultima_Atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            imagem TEXT,
            tema TEXT,
            post TEXT,
            comentario TEXT
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS enquete (
            id SERIAL PRIMARY KEY,
            resposta TEXT,
            Ultima_Atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS clientes (
            id SERIAL PRIMARY KEY,
            nome TEXT,
            cpf TEXT,
            email VARCHAR(60),
            telefone VARCHAR(20),
            Ultima_Atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS anaminese (
            id SERIAL PRIMARY KEY,
            nome TEXT,
            nascimento DATE,
            profissao TEXT,
            endereco TEXT,
            telefone TEXT,
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
            cpf TEXT,
            Ultima_Atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS agenda (
            Cliente TEXT,
            Dia DATE,
            Hora TIME,
            Atendimento VARCHAR(50),
            Ultima_Atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (Ultima_Atualizacao)
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS compras (
            id SERIAL PRIMARY KEY,
            Produto TEXT,
            Marca TEXT,
            Quantidade INTEGER,
            Unidade TEXT,
            Validade DATE,
            Preco_Unitario REAL,
            Custo_Estoque REAL GENERATED ALWAYS AS (Preco_Unitario * Quantidade) STORED,
            Total_Compras REAL,
            Media_Compras REAL,
            Ultima_Atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS vendas_produtos (
            id SERIAL PRIMARY KEY,
            Cliente TEXT,
            Produto TEXT,
            Marca TEXT,
            Validade DATE,
            Quantidade INTEGER,
            Preco_aVista REAL,
            Valor_Total REAL GENERATED ALWAYS AS (Preco_aVista * Quantidade) STORED,
            Desconto INTEGER,
            Preco_Final REAL GENERATED ALWAYS AS ((Preco_aVista * Quantidade) * (1 - (Desconto / 100.0))) STORED,
            Qtde_Parcelas INTEGER,
            Preco_Parcelado REAL GENERATED ALWAYS AS (CASE WHEN Qtde_Parcelas > 0 THEN ((Preco_aVista * Quantidade) * (1 - (Desconto / 100.0))) / Qtde_Parcelas ELSE 0 END) STORED,
            Total_Vendas_Produtos REAL,
            Media_Vendas_Produtos REAL,
            Ultima_Atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS vendas_servicos (
            id SERIAL PRIMARY KEY,
            Cliente TEXT,
            Servico TEXT,
            Tempo_Minutos INTEGER,
            Desconto INTEGER,
            Preco REAL,
            Preco_Final REAL GENERATED ALWAYS AS (preco - (preco * desconto / 100.0)) STORED,
            Observacoes TEXT,
            Total_Vendas_Servicos REAL,
            Media_Vendas_Servicos REAL,
            Ultima_Atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS colaboradores (
            id SERIAL PRIMARY KEY,
            Nome TEXT,
            Endereco TEXT,
            Cidade TEXT,
            Email TEXT,
            Telefone TEXT,
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
            Ultima_Atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS relatorioMEI (
            id SERIAL PRIMARY KEY,
            Apuracao TIMESTAMP,
            CNPJ BIGINT,
            Razao_Social TEXT,
            Produto_Dispensa_NF REAL,
            Produto_Emissao_NF REAL,
            Total_Receita_Produtos REAL GENERATED ALWAYS AS (Produto_Dispensa_NF + Produto_Emissao_NF) STORED,
            Servico_Dispensa_NF REAL,
            Servico_Emissao_NF REAL,
            Total_Receita_Servicos REAL GENERATED ALWAYS AS (Servico_Dispensa_NF + Servico_Emissao_NF) STORED,
            Total_Geral_Receitas REAL GENERATED ALWAYS AS ((Produto_Dispensa_NF + Produto_Emissao_NF) + (Servico_Dispensa_NF + Servico_Emissao_NF)) STORED,
            Local TEXT,
            Data TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            Assinatura TEXT
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS impostos (
            id SERIAL PRIMARY KEY,
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
            Total_Custos_Fixos REAL GENERATED ALWAYS AS (
                (aluguel + IPTU + luz + agua + internet + telefone  + aluguel_Maquina_Cartao + MEI) + 
                (descartaveis + novos_produtos + equipamentos) + 
                (marketing + prolabore + terceiros + inss + fgts + depreciacao + reserva)
            ) STORED,
            Media_Custos_Fixos REAL,
            Ultima_Atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS insumos (
            id SERIAL PRIMARY KEY,
            Tipo_Servico TEXT,
            Nome_Insumo TEXT,
            Quantidade_Fechada INTEGER,
            unidade_total TEXT,
            Preco_Fechado REAL,
            Quantidade_Fracionada INTEGER,
            unidade_fracionada TEXT,
            Quantidade_Atendimento REAL GENERATED ALWAYS AS (CASE WHEN Quantidade_Fracionada > 0 THEN Quantidade_Fechada::REAL / Quantidade_Fracionada ELSE 0 END) STORED,
            Custo_Secao REAL GENERATED ALWAYS AS (
                CASE 
                    WHEN Quantidade_Fracionada > 0 AND Quantidade_Fechada > 0 THEN (Preco_Fechado * Quantidade_Fracionada) / Quantidade_Fechada::REAL 
                    ELSE 0 
                END
            ) STORED,
            Total_Insumos REAL,
            Media_Insumos REAL,
            Ultima_Atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS depreciacao (
            id SERIAL PRIMARY KEY,
            Objeto TEXT,
            Preco_Custo REAL,
            Anos_Uso INTEGER,
            Valor_Depreciacao REAL GENERATED ALWAYS AS (CASE WHEN Anos_Uso > 0 THEN Preco_Custo / (Anos_Uso * 12) ELSE 0 END) STORED,
            Total_Depreciacao REAL,
            Media_Depreciacao REAL,
            Ultima_Atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS margem (
            id SERIAL PRIMARY KEY,
            Tipo_Servico TEXT,
            Preco_Ofertado REAL,
            Prolabore REAL,
            Prolabore_hora REAL GENERATED ALWAYS AS (Prolabore / 160.0) STORED,
            Total_Insumos REAL,
            Custo_Variavel REAL GENERATED ALWAYS AS (Total_Insumos + (Prolabore / 160.0)) STORED,
            Custo_Fixo REAL,
            Pagar_Custo_Fixo REAL GENERATED ALWAYS AS (Preco_Ofertado - (Total_Insumos + (Prolabore / 160.0))) STORED,
            Projecao_Atendimentos REAL GENERATED ALWAYS AS (
                CASE 
                    WHEN (Preco_Ofertado - (Total_Insumos + (Prolabore / 160.0))) > 0 THEN Custo_Fixo / (Preco_Ofertado - (Total_Insumos + (Prolabore / 160.0))) 
                    ELSE 0 
                END
            ) STORED,
            Ultima_Atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS markup (
            id SERIAL PRIMARY KEY,
            Tipo_Servico TEXT,
            Preco_Ofertado REAL,
            Impostos REAL,
            Depreciacao REAL,
            Vendas REAL,
            Custo_Fixo REAL GENERATED ALWAYS AS (CASE WHEN Vendas > 0 THEN (Impostos + Depreciacao) / Vendas ELSE 0 END) STORED,
            Insumos REAL,
            Pessoal REAL,
            Taxa_Maq_Cartao REAL,
            Custo_Variavel REAL GENERATED ALWAYS AS (
                CASE 
                    WHEN (Insumos + Pessoal) > 0 THEN (Insumos / (Insumos + Pessoal)) + (Pessoal / (Insumos + Pessoal)) + Taxa_Maq_Cartao
                    ELSE Taxa_Maq_Cartao 
                END
            ) STORED,
            Margem_Lucro REAL,
            Indice_Markup REAL GENERATED ALWAYS AS (
                CASE 
                    WHEN (1 - ((CASE WHEN Vendas > 0 THEN (Impostos + Depreciacao) / Vendas ELSE 0 END) + (CASE WHEN (Insumos + Pessoal) > 0 THEN 1 + Taxa_Maq_Cartao ELSE Taxa_Maq_Cartao END) + Margem_Lucro)) != 0 
                    THEN 1 / (1 - ((CASE WHEN Vendas > 0 THEN (Impostos + Depreciacao) / Vendas ELSE 0 END) + (CASE WHEN (Insumos + Pessoal) > 0 THEN 1 + Taxa_Maq_Cartao ELSE Taxa_Maq_Cartao END) + Margem_Lucro))
                    ELSE 0 
                END
            ) STORED,
            Preco_Justo REAL GENERATED ALWAYS AS (
                (CASE WHEN (Insumos + Pessoal) > 0 THEN 1 + Taxa_Maq_Cartao ELSE Taxa_Maq_Cartao END) * 
                (CASE 
                    WHEN (1 - ((CASE WHEN Vendas > 0 THEN (Impostos + Depreciacao) / Vendas ELSE 0 END) + (CASE WHEN (Insumos + Pessoal) > 0 THEN 1 + Taxa_Maq_Cartao ELSE Taxa_Maq_Cartao END) + Margem_Lucro)) != 0 
                    THEN 1 / (1 - ((CASE WHEN Vendas > 0 THEN (Impostos + Depreciacao) / Vendas ELSE 0 END) + (CASE WHEN (Insumos + Pessoal) > 0 THEN 1 + Taxa_Maq_Cartao ELSE Taxa_Maq_Cartao END) + Margem_Lucro))
                    ELSE 0 
                END)
            ) STORED,
            Ultima_Atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
    ]
    conn = None
    try:
        # Get a connection from the connection pool
        conn = get_connection()
        with conn.cursor() as cur:
            for command in commands:
                cur.execute(command)
        # Commit the changes
        conn.commit()
        print("Tables created successfully!")
    except (Exception, psycopg2.DatabaseError) as error:
        print(error)
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    # First, ensure the database itself exists
    create_database_if_not_exists()
    # Then, connect to it and create the tables
    create_tables()
    print("Database initialization process finished.")
