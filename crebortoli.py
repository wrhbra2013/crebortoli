#Carregamento de módulos
from flask import Flask, render_template
from sig.gestao import app_gestao
from paginas.web import app_site


app = Flask(__name__)

#Rota privada -  método Blueprint.
app.register_blueprint(app_gestao)
app.register_blueprint(app_site)

#Chave secreta do forms
app.config['SECRET_KEY'] = 'SECRET_KEY'

#Rota pública root.
@app.route('/')
def index():
    # #Versão final
    # return render_template('paginas/home.html')
    # Versão desenvolvimneto
    return render_template('sig/sig.html')



#Mapa do site
#print('Mapa do site')
#print(app.url_map)
    
    
    






