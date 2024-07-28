#Usando Blueprint como módulo de extensão de Arquitetura da Aplicação
import os
from init_db import connection, cur
from flask import (Blueprint,render_template, url_for,request, redirect,flash)
from werkzeug.utils import secure_filename


#Blueprint configuration
app_site = Blueprint('paginas', __name__,url_prefix='/paginas/',template_folder='templates')


#Pastas e extensões
pasta_upload = 'static/uploads'
#app.config['pasta_upload'] = pasta_upload


#Filtro de imagens
extensao_permitida = set(['jpeg','jpg','png','gif', 'pdf','docx','pptx','mp3','mp4'])
def arq_permitido(filename):
    return '.' in filename and filename.rsplit('.',1)[1].lower() in extensao_permitida

#Funções
def post_coments(comentario):
    cur.execute(f"update post set comentario = '{comentario}', last_update=now()::timestamp(0);")
    coments = connection.commit() 
    return coments   

def post_clientes(nome, email, telefone):
    cur.execute(f"insert into clientes (nome, email, telefone) values ('{nome}', '{email}','{telefone}');")
    clients = connection.commit()
    return clients

def post_agenda(nome,dia, hora, atendimento):
    cur.execute(f"insert into agenda (cliente,dia, hora, atendimento) values ('{nome}','{dia}','{hora}','{atendimento}');")
    agend = connection.commit()
    return agend

def post_enquete(opniao):
    cur.execute(f"insert into enquete (resposta) values ('{opniao}');")
    enquete = connection.commit()
    return enquete

@app_site.route('/home',methods=['GET','POST'])
def home():
    cur.execute('select * from post;')
    post = cur.fetchall()
    if request.method == 'POST':
        #Cometários
        ct = request.form['coment']        
        post_coments(ct)
        

        # #Enquete
        # enq = request.form['enquete']
        # post_enquete(enq)


        return redirect(url_for('paginas.home',ct=ct))
    return render_template('paginas/home.html',post=post)
    

@app_site.route('/agenda', methods=['GET','POST'])
def agenda():
    if request.method =='POST':        
            
        #inputs usuario
        nome = request.form['nome']
        email = request.form['email']
        telefone = request.form['tel']
        dia = request.form['dia']
        hora = request.form['hora']
        atendimento = request.form['msg']
        
        post_clientes(nome, email, telefone)
        post_agenda(nome,dia, hora,atendimento)             
          
        
        #Saida.
        return redirect(url_for('paginas.agenda'))
    return render_template('paginas/agenda.html')


@app_site.route('/admin', methods=['GET','POST'])
def admin():
    cur.execute("select * from agenda;")
    post = cur.fetchall()
        
    if request.method == 'POST':
        p = request.form['post']
        t = request.form['tema']
        i = request.files['imagem']
        c = ''

         #Armazenando imagens.
        if i.filename == '':
             filename = ''             
             flash('Sem Imagem.')
             cur.execute(f"insert into post(imagem,tema,post,comentario)values('{filename}','{t}','{p}','{c}');") 

             error = connection.commit() 
             print(error)
             return redirect(url_for('paginas/admin',filename=filename))
              
        if  i and arq_permitido(i.filename):
            filename = secure_filename(i.filename)
            i.save(os.path.join(app.config['pasta_upload'],filename))            
            flash('Imagem Armazenada com sucesso')            
            #Inserir imagem no Banco de Dados            
            cur.execute(f"insert into post(imagem,tema,post,comentario)values('{filename}','{t}','{p}','{c}');") 
            connection.commit()   
            flash('Texto publicado com Sucesso.')  

        return redirect(url_for('paginas/admin',filename=filename))
    return render_template('paginas/admin.html',post=post)
    

#Rota especifica para imagens.
@app_site.route('/display/<filename>')
def display(filename):     
     return redirect(url_for('static', filename='uploads/' + filename),code=301)
 

