#Carregamento de módulos
from flask import Flask, render_template
from sig.gestao import app_gestao
from paginas.web import app_site
from datetime import datetime # 1. Importe o módulo datetime

app = Flask(__name__)

#Chave secreta do forms
app.config['SECRET_KEY'] = 'SECRET_KEY'

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
