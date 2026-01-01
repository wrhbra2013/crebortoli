#Carregamento de módulos
from flask import Flask, render_template
from init_db import create_database_if_not_exists, create_tables
from sig.gestao import app_gestao
from paginas.web import app_site
from datetime import datetime # 1. Importe o módulo datetime
from markupsafe import Markup


app = Flask(__name__)

# --- Inicialização Automática do Banco de Dados ---
# Garante que o banco de dados e as tabelas existam antes de o servidor iniciar.
print("Verificando e inicializando o banco de dados...")
create_database_if_not_exists()
create_tables()
print("Inicialização do banco de dados concluída. Servidor Flask iniciando...")
# -----------------------------------------

def nl2br(value):
    """
    Converte quebras de linha em uma string para a tag HTML <br>.
    """
    if value:
        # O uso de Markup é crucial para dizer ao Jinja que o
        # resultado é um HTML seguro e não deve ser escapado.
        return Markup(str(value).replace('\n', '<br>\n'))
    return ""

# Registra a função como um filtro no Jinja2 com o nome 'nl2br'
app.jinja_env.filters['nl2br'] = nl2br

#Chave secreta do forms
app.config['SECRET_KEY'] = '@admin'

# 2. Crie e registre o filtro de data personalizado
@app.template_filter('date')
def format_date(value, format_string='%d/%m/%Y'):
    """
    Formata uma string de data ou um objeto datetime.
    - Uso: {{ variavel_data|date }}
    - Uso com formato: {{ variavel_data|date('%Y-%m-%d') }}
    - Para o ano atual: {{ "now"|date('%Y') }}
    """
    if value == "now":
        return datetime.utcnow().strftime(format_string)
    if isinstance(value, str):
        try:
            # Tenta converter a string para datetime antes de formatar
            # Ajuste o formato de entrada '%Y-%m-%d %H:%M:%S' se o do seu DB for diferente
            return datetime.strptime(value, '%Y-%m-%d %H:%M:%S').strftime(format_string)
        except ValueError:
            return value # Retorna o valor original se a conversão falhar
    if isinstance(value, datetime):
        return value.strftime(format_string)
    return value

#Rota privada -  método Blueprint.
app.register_blueprint(app_gestao)
app.register_blueprint(app_site)

#Rota pública root.
@app.route('/')
def index():
    # #Versão final
    return render_template('paginas/home.html')
    # Versão desenvolvimneto
    # return render_template('sig/sig.html')

#Mapa do site
#print('Mapa do site')
#print(app.url_map)
