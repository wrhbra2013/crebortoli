# /home/wander/crebortoli/paginas/web.py

import os
from flask import (
    Blueprint, render_template, url_for, request, redirect, flash, current_app, session
)
from werkzeug.utils import secure_filename
import psycopg2
import stripe
import mercadopago
from psycopg2.extras import DictCursor
from .forms import AgendaForm
from init_db import get_connection

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

# Configuração de Pagamentos (Substitua pelas suas chaves reais ou use variáveis de ambiente)
stripe.api_key = "sk_test_SUA_CHAVE_STRIPE_AQUI"
mp = mercadopago.SDK("SEU_ACCESS_TOKEN_MERCADO_PAGO")


def is_allowed_file(filename):
    """Verifica se a extensão do arquivo é permitida."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# ==============================================================================
# FUNÇÕES DE INTERAÇÃO COM O BANCO DE DADOS (Refatoradas para Segurança e Consistência)
# ==============================================================================

def db_execute(sql, params=(), commit=False):
    """Função genérica para executar comandos SQL (INSERT, UPDATE, DELETE)."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
        if commit:
            conn.commit()
    finally:
        if conn:
            conn.close()

def db_fetch(sql, params=(), one=False):
    """Função genérica para buscar dados (SELECT)."""
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=DictCursor) as cur:
            cur.execute(sql, params)
            return cur.fetchone() if one else cur.fetchall()
    finally:
        if conn:
            conn.close()

def update_post_comment(post_id, comentario):
    """Atualiza o comentário de um post específico."""
    sql = "UPDATE post SET comentario = %s, Ultima_Atualizacao = CURRENT_TIMESTAMP WHERE id = %s;"
    db_execute(sql, (comentario, post_id), commit=True)

def create_cliente(nome, email, telefone):
    """Insere um novo cliente no banco de dados."""
    sql = "INSERT INTO clientes (nome, email, telefone) VALUES (%s, %s, %s);"
    db_execute(sql, (nome, email, telefone), commit=True)

def create_agendamento(nome, dia, hora, atendimento):
    """Cria um novo agendamento."""
    sql = "INSERT INTO agenda (Cliente, Dia, Hora, Atendimento) VALUES (%s, %s, %s, %s);"
    db_execute(sql, (nome, dia, hora, atendimento), commit=True)

def create_enquete_response(opiniao):
    """Salva uma resposta da enquete."""
    sql = "INSERT INTO enquete (resposta) VALUES (%s);"
    db_execute(sql, (opiniao,), commit=True)

def create_post(tema, post_text, imagem_filename=""):
    """Cria um novo post."""
    sql = "INSERT INTO post (imagem, tema, post, comentario) VALUES (%s, %s, %s, %s);"
    db_execute(sql, (imagem_filename, tema, post_text, ''), commit=True)

def delete_post_by_id(post_id):
    """Deleta um post pelo seu ID."""
    sql = "DELETE FROM post WHERE id = %s;"
    db_execute(sql, (post_id,), commit=True)

def update_post_by_id(post_id, tema, post_text):
    """Atualiza o tema e o texto de um post específico."""
    sql = "UPDATE post SET post = %s, tema = %s, Ultima_Atualizacao = CURRENT_TIMESTAMP WHERE id = %s;"
    db_execute(sql, (post_text, tema, post_id), commit=True)

def buscar_todos_posts():
    """Busca todas as postagens, ordenadas pela mais recente."""
    sql = """
        SELECT p.post, p.imagem, p.comentario, p.Ultima_Atualizacao
        FROM post p
        ORDER BY p.Ultima_Atualizacao DESC;
    """
    return db_fetch(sql)

def buscar_agendamentos():
    """Busca todos os agendamentos, ordenados por dia e hora."""
    sql = "SELECT * FROM agenda ORDER BY Dia, Hora;"
    return db_fetch(sql)

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
    form = AgendaForm()
    if form.validate_on_submit():
        nome_cliente = form.nome.data
        email_cliente = form.email.data
        telefone_cliente = form.telefone.data
        dia_agendamento = form.data.data
        hora_agendamento = form.hora.data
        tipo_atendimento = form.servico.data
        
        # Obtém o método de pagamento do formulário (campo adicionado manualmente no HTML)
        metodo_pagamento = request.form.get('metodo_pagamento')
        
        # Define um preço fixo para o exemplo (ou implemente uma lógica baseada no serviço)
        preco_servico = 100.00  # R$ 100,00

        # Se o pagamento for no local ou não especificado, segue o fluxo normal
        if not metodo_pagamento or metodo_pagamento == 'local':
            create_cliente(nome_cliente, email_cliente, telefone_cliente)
            create_agendamento(nome_cliente, dia_agendamento, hora_agendamento, tipo_atendimento)
            flash('Agendamento realizado com sucesso!', 'success')
            return redirect(url_for('paginas.agenda'))
        
        # Se for pagamento online, salva os dados na sessão temporariamente
        session['agendamento_pendente'] = {
            'nome': nome_cliente, 'email': email_cliente, 'telefone': telefone_cliente,
            'dia': dia_agendamento.strftime('%Y-%m-%d'), 'hora': hora_agendamento.strftime('%H:%M'),
            'servico': tipo_atendimento
        }

        # Integração Stripe
        if metodo_pagamento == 'stripe':
            try:
                checkout_session = stripe.checkout.Session.create(
                    payment_method_types=['card'],
                    line_items=[{
                        'price_data': {
                            'currency': 'brl',
                            'product_data': {'name': f"Serviço: {tipo_atendimento}"},
                            'unit_amount': int(preco_servico * 100), # Valor em centavos
                        },
                        'quantity': 1,
                    }],
                    mode='payment',
                    success_url=url_for('paginas.payment_success', _external=True),
                    cancel_url=url_for('paginas.agenda', _external=True),
                )
                return redirect(checkout_session.url, code=303)
            except Exception as e:
                flash(f'Erro ao iniciar pagamento Stripe: {e}', 'danger')
                return redirect(url_for('paginas.agenda'))

        # Integração Mercado Pago
        elif metodo_pagamento == 'mercadopago':
            try:
                preference_data = {
                    "items": [{
                        "title": f"Serviço: {tipo_atendimento}",
                        "quantity": 1,
                        "unit_price": float(preco_servico),
                        "currency_id": "BRL"
                    }],
                    "back_urls": {
                        "success": url_for('paginas.payment_success', _external=True),
                        "failure": url_for('paginas.agenda', _external=True),
                        "pending": url_for('paginas.agenda', _external=True)
                    },
                    "auto_return": "approved"
                }
                preference_response = mp.preference().create(preference_data)
                preference = preference_response["response"]
                return redirect(preference["init_point"])
            except Exception as e:
                flash(f'Erro ao iniciar pagamento Mercado Pago: {e}', 'danger')
                return redirect(url_for('paginas.agenda'))

    return render_template('paginas/agenda.html', form=form)

@app_site.route('/payment_success')
def payment_success():
    """Rota de retorno após pagamento bem-sucedido."""
    dados = session.get('agendamento_pendente')
    
    if not dados:
        flash('Sessão de agendamento expirada ou inválida.', 'warning')
        return redirect(url_for('paginas.agenda'))
    
    try:
        # Confirma o agendamento no banco de dados
        create_cliente(dados['nome'], dados['email'], dados['telefone'])
        create_agendamento(dados['nome'], dados['dia'], dados['hora'], dados['servico'])
        
        # Limpa a sessão
        session.pop('agendamento_pendente', None)
        flash('Pagamento confirmado e agendamento realizado com sucesso!', 'success')
    except Exception as e:
        flash(f'Pagamento confirmado, mas houve um erro ao salvar o agendamento: {e}', 'danger')
        
    return redirect(url_for('paginas.agenda'))

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
    posts = db_fetch("SELECT * FROM post ORDER BY id DESC;")
    
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
        sql = "DELETE FROM agenda WHERE Cliente = %s AND Dia = %s;"
        db_execute(sql, (cliente, dia), commit=True)
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

    post = db_fetch("SELECT * FROM post WHERE id = %s;", (id,), one=True)
    if post is None:
        flash('Post não encontrado!', 'danger')
        return redirect(url_for('paginas.admin'))

    return render_template('paginas/edit.html', post=post)

@app_site.route('/servicos')
def servicos():
    return render_template('paginas/servicos.html')  # Assuming you have this template
