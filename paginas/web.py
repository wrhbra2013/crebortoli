# /home/wander/crebortoli/paginas/web.py

import os
from flask import (
    Blueprint, render_template, url_for, request, redirect, flash, current_app
)
from werkzeug.utils import secure_filename
import sqlite3  # Importa o módulo sqlite3
from init_db import DB_FILE  # Importa a constante DB_FILE

# --- Configuração do Blueprint ---
# Boas práticas: usar o nome do módulo '__name__' e definir template_folder.
app_site = Blueprint(
    'paginas',
    __name__,
    url_prefix='/paginas',
    template_folder='templates'
)

# --- Constantes e Configurações ---
# Centralizar configurações melhora a manutenção.
ALLOWED_EXTENSIONS = {'jpeg', 'jpg', 'png', 'gif', 'pdf', 'docx', 'pptx', 'mp3', 'mp4'}

def is_allowed_file(filename):
    """Verifica se a extensão do arquivo é permitida."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# ==============================================================================
# FUNÇÕES DE INTERAÇÃO COM O BANCO DE DADOS (Refatoradas para Segurança e Consistência)
# ==============================================================================

def get_connection():
    """Retorna uma conexão com o banco de dados."""
    return sqlite3.connect(DB_FILE, check_same_thread=False)

def update_post_comment(post_id, comentario):
    """Atualiza o comentário de um post específico."""
    sql = "UPDATE post SET comentario = ?, Ultima_Atualizacao = CURRENT_TIMESTAMP WHERE id = ?;"
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(sql, (comentario, post_id))
        conn.commit()

def create_cliente(nome, email, telefone):
    """Insere um novo cliente no banco de dados."""
    sql = "INSERT INTO clientes (nome, email, telefone) VALUES (?, ?, ?);"
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(sql, (nome, email, telefone))
        conn.commit()

def create_agendamento(nome, dia, hora, atendimento):
    """Cria um novo agendamento."""
    sql = "INSERT INTO agenda (Cliente, Dia, Hora, Atendimento) VALUES (?, ?, ?, ?);"
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(sql, (nome, dia, hora, atendimento))
        conn.commit()

def create_enquete_response(opiniao):
    """Salva uma resposta da enquete."""
    sql = "INSERT INTO enquete (resposta) VALUES (?);"
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(sql, (opiniao,))
        conn.commit()

def create_post(tema, post_text, imagem_filename=""):
    """Cria um novo post."""
    sql = "INSERT INTO post (imagem, tema, post, comentario) VALUES (?, ?, ?, ?);"
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(sql, (imagem_filename, tema, post_text, ''))  # Comentário inicial vazio
        conn.commit()

def delete_post_by_id(post_id):
    """Deleta um post pelo seu ID."""
    sql = "DELETE FROM post WHERE id = ?;"
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(sql, (post_id,))
        conn.commit()

def update_post_by_id(post_id, tema, post_text):
    """Atualiza o tema e o texto de um post específico."""
    sql = "UPDATE post SET post = ?, tema = ?, Ultima_Atualizacao = CURRENT_TIMESTAMP WHERE id = ?;"
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(sql, (post_text, tema, post_id))
        conn.commit()

def buscar_todos_posts():
    """Busca todas as postagens, ordenadas pela mais recente."""
    sql = """
        SELECT p.post, p.imagem, p.comentario, p.Ultima_Atualizacao
        FROM post p
        ORDER BY p.Ultima_Atualizacao DESC;
    """
    with get_connection() as conn:
        conn.row_factory = sqlite3.Row  # Para acesso aos dados por nome de coluna
        cur = conn.cursor()
        cur.execute(sql)
        posts = cur.fetchall()
        return posts

def buscar_agendamentos():
    """Busca todos os agendamentos, ordenados por dia e hora."""
    sql = "SELECT * FROM agenda ORDER BY Dia, Hora;"
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(sql)
        return cur.fetchall()

# ==============================================================================
# ROTAS (VIEWS)
# ==============================================================================

@app_site.route('/home', methods=['GET', 'POST'])  # Removida a rota duplicada '/'
def home():
    posts = buscar_todos_posts()
    return render_template('paginas/home.html', posts=posts)

@app_site.route('/', methods=['GET', 'POST'])
def index():
    posts = buscar_todos_posts()
    return render_template('paginas/home.html', posts=posts)

@app_site.route('/agenda', methods=['GET', 'POST'])
def agenda():
    if request.method == 'POST':
        nome_cliente = request.form['nome']
        email_cliente = request.form['email']
        telefone_cliente = request.form['tel']
        dia_agendamento = request.form['dia']
        hora_agendamento = request.form['hora']
        tipo_atendimento = request.form['msg']

        create_cliente(nome_cliente, email_cliente, telefone_cliente)
        create_agendamento(nome_cliente, dia_agendamento, hora_agendamento, tipo_atendimento)

        flash('Agendamento realizado com sucesso!', 'success')
        return redirect(url_for('paginas.agenda'))

    return render_template('paginas/agenda.html')

@app_site.route('/admin', methods=['GET', 'POST'])
def admin():
    if request.method == 'POST':
        post_text = request.form['post']
        theme = request.form['tema']
        image_file = request.files.get('imagem')

        if image_file and image_file.filename != '' and is_allowed_file(image_file.filename):
            filename = secure_filename(image_file.filename)
            upload_folder = current_app.config['PASTA_UPLOAD']
            image_file.save(os.path.join(upload_folder, filename))
            create_post(theme, post_text, imagem_filename=filename)
            flash('Post com imagem publicado com sucesso!', 'success')
        else:
            create_post(theme, post_text)
            flash('Post sem imagem publicado com sucesso!', 'success')

        return redirect(url_for('paginas.admin'))

    # Carrega os dados para exibir na página de admin
    agendamentos = buscar_agendamentos()
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM post ORDER BY id DESC;")
        posts = cur.fetchall()

    return render_template('paginas/admin.html', posts=posts, agendamentos=agendamentos)

@app_site.route('/display/<path:filename>')
def display(filename):
    return redirect(url_for('static', filename=filename), code=301)

@app_site.route('/enquete', methods=['GET', 'POST'])
def enquete():
    if request.method == 'POST':
        opiniao = request.form['enquete']
        create_enquete_response(opiniao)
        flash('Obrigado por sua opinião!', 'success')
        return redirect(url_for('paginas.enquete'))
    return render_template('paginas/enquete.html')

@app_site.route('/contato')
def contato():
    return render_template('paginas/contato.html')

@app_site.route('/sobre')
def sobre():
    return render_template('paginas/sobre.html')

@app_site.route('/delete/<int:id>', methods=['POST'])
def delete(id):
    delete_post_by_id(id)
    flash('Post deletado com sucesso!', 'success')
    return redirect(url_for('paginas.admin'))

@app_site.route('/delete_agenda/<string:cliente>/<string:dia>', methods=['POST'])
def delete_agenda(cliente, dia):
    try:
        sql = "DELETE FROM agenda WHERE Cliente = ? AND Dia = ?;"
        with get_connection() as conn:  # Usando get_connection
            cur = conn.cursor()
            cur.execute(sql, (cliente, dia))
            conn.commit()
        flash('Agendamento deletado com sucesso!', 'success')
    except Exception as e:
        flash(f'Erro ao deletar agendamento: {e}', 'danger')
    return redirect(url_for('paginas.admin'))

@app_site.route('/edit/<int:id>', methods=['GET', 'POST'])
def edit(id):
    if request.method == 'POST':
        post_text = request.form['post']
        theme = request.form['tema']
        update_post_by_id(id, theme, post_text)
        flash('Post atualizado com sucesso!', 'success')
        return redirect(url_for('paginas.admin'))

    with get_connection() as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("SELECT * FROM post WHERE id = ?;", (id,))
        post = cur.fetchone()

    if post is None:
        flash('Post não encontrado!', 'danger')
        return redirect(url_for('paginas.admin'))

    return render_template('paginas/edit.html', post=post)

@app_site.route('/servicos')
def servicos():
    return render_template('paginas/servicos.html')  # Assuming you have this template
