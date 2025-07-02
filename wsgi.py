import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from crebortoli import app 
 
 # A variável 'application' é o padrão que servidores de produção (como Gunicorn)
 # procuram para rodar a aplicação.
application = app

# Este bloco só será executado quando você rodar o arquivo diretamente com "python wsgi.py"
if __name__ == '__main__':
     # Inicia o servidor de desenvolvimento do Flask
     app.run(debug=True, host='0.0.0.0', port=5000)
 
 