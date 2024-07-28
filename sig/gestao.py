#Usando Blueprint como módulo de extensão de Arquitetura da Aplicação
from flask import Blueprint,render_template, redirect, url_for, request, flash, session
import pandas as pd
from datetime import timedelta
import qrcode
from .form import *
from init_db import connection, cur



#Configuração da Partição Blueprint
app_gestao = Blueprint('sig', __name__, url_prefix='/sig/',template_folder='templates')

# Rota de Excessões & Erros:
@app_gestao.errorhandler(404)
def error():
      return render_template('sig/error.html'),404




#Expirar sessão
@app_gestao.before_request
def make_session_permanent():
    session.permanent = True
    app_gestao.permanent_session_lifetime = timedelta(minutes=5)



#Funções de Apoio
#Gerando novas senhas aleatórias
import random
import string

# Gerador de Senhas.
def gerador_senhas():
      length = random.randint(5,9)
      lower = string.ascii_lowercase
      upper = string.ascii_uppercase
      num = string.digits
      #symbols = string.punctuation
    
      all = lower + upper + num #+ symbols

      temp = random.sample(all,length)

      password = "".join(temp)
      print('Nova senha =>',password)
      return password


# Funções Gerais GET E POST.
def post_cliente(nome, cpf, email, telefone):
      cur.execute(f"insert into clientes (nome, cpf, email, telefone) values ('{nome}','{cpf}','{email}','{telefone}');")
      post_cadClientes = connection.commit()
      return post_cadClientes



def get_clientes(pessoa):            
      t1 = 'clientes'
      l1 = cur.execute(f"SELECT  FORMAT('%04d', id), nome, SUBSTR(cpf, 3,3) || '.' || SUBSTR(cpf, 3,3) || '.' || SUBSTR(cpf, 3,3) || '.' || SUBSTR(cpf, 2,2), email , SUBSTR (telefone, 1,0) || '(' || SUBSTR(telefone, 1, 2) || ') ' || SUBSTR(telefone, 3, 5) || ' - ' || SUBSTR(telefone, 7, 4),  STRFTIME('%d/%m/%Y, %H:%M', Ultima_Atualizacao) FROM '{t1}' where  nome like '%{pessoa}%' ;").fetchmany()      
      c1 = cur.execute(f"SELECT name FROM PRAGMA_TABLE_INFO('{t1}');").fetchall()      
      return l1,c1
     

def post_anaminese(nome, nasc, prof, end, tel, ind, queixa,alerg_med, alerg_asp, trat_med, cirurg,medicament, prot, gen, dia, press, dr, epil, menst, gest, te, cos, fs, bronz, observ, assin, doc, dt):
      cur.execute(f"insert into anaminese (nome, nascimento, profissao, endereco, telefone, indicacao, queixa_principal, alergia_medicamentos, alergia_aspirina, tratamentos_medicos, cirurgia, uso_medicamentos, proteses, doencas_familiares, diabetes, presao, doenca_renal, epilepsia, menstruacao, gestacao, tratamento_estetico, uso_cosmeticos, filtro_solar, bronzeamento, observacoes, assinatura, cpf, STRFTIME('%d/%m/%Y, %H:%M', Ultima_Atualizacao)) values ('{nome}','{nasc}','{prof}','{end}','{tel}','{ind}','{queixa}','{alerg_med}','{alerg_asp}','{trat_med}','{cirurg}','{medicament}','{prot}','{gen}','{gen}','{dia}','{press}','{dr}','{epil}','{menst}','{gest}','{te}','{cos}','{fs}','{bronz}','{observ}','{assin}','{doc}','{dt}');")
      post_cadAnaminese = connection.commit()
      return post_cadAnaminese


def post_compras(produto, marca, quantidade, unidade,validade,preco):
      cur.execute(f"insert into compras (Produto, Marca, Quantidade, Unidade, Validade, Preco_Unitario) values('{produto}','{marca}','{quantidade}','{unidade}','{validade}', '{preco}');")
      post_com = connection.commit()        
      return  post_com

def get_compras():
      tn = 'compras'
      vn = cur.execute(f"select * from '{tn}';" ).fetchall()      
      tgc = cur.execute(f"SELECT name FROM PRAGMA_TABLE_XINFO('{tn}');").fetchall()  
      return vn,tgc

def get_estoque(produto):
      t2 = 'compras'
      l2 = cur.execute(f"select  * from '{t2}' where  produto like '%{produto}%' ;").fetchmany()      
      c2 = cur.execute(f"SELECT name FROM PRAGMA_TABLE_XINFO('{t2}');").fetchall()   
      return l2,c2

def post_vservicos(cli,servico,tempo_min,desc,pre,obser):
      cur.execute(f"INSERT INTO vendas_servicos (Cliente, Servico, Tempo_Minutos, Desconto, Preco, observacoes) VALUES('{cli}','{servico}','{tempo_min}','{desc}','{pre}','{obser}') ;")
      pvs = connection.commit()
      cur.execute("UPDATE vendas_servicos SET Total_Vendas_Servicos = (SELECT COALESCE(TOTAL(Preco_Final),0)  FROM vendas_servicos)") 
      us = connection.commit()
      cur.execute("UPDATE vendas_servicos SET Media_Vendas_Servicos = (SELECT COALESCE(AVG(Preco_Final),0) FROM vendas_servicos)")
      avgs = connection.commit()    
      return pvs, us, avgs

def get_vservicos():
      t3 = 'vendas_servicos'
      vs = cur.execute(f"SELECT FORMAT('%04d', id), Cliente, Servico, STRFTIME('%H:%M', Tempo_Minutos), FORMAT('%.1f%', Desconto), FORMAT('R$%.2f', Preco), FORMAT('R$%.2f', Preco_Final), Observacoes,FORMAT('R$%.2f', Total_Vendas_Servicos), FORMAT('R$%.2f', Media_Vendas_Servicos),  STRFTIME('%d/%m/%Y, %H:%M', Ultima_Atualizacao) FROM '{t3}';" ).fetchall()      
      tvs = cur.execute(f"SELECT name FROM PRAGMA_TABLE_XINFO('{t3}');").fetchall()  
      return vs,tvs   

def post_vprodutos(cli, prod, mar, quant, val, pa, desco, qp ):
      cur.execute(f"INSERT INTO vendas_produtos(Cliente, Produto,Marca, Quantidade, Validade, Preco_aVista, Desconto, Qtde_Parcelas) VALUES('{cli}', '{prod}','{mar}','{quant}','{val}','{pa}','{desco}','{qp}');")
      pvp = connection.commit()
      cur.execute("UPDATE vendas_produtos SET Total_Vendas_Produtos = (SELECT COALESCE(TOTAL(Preco_Final),0)  FROM vendas_produtos)") 
      vup = connection.commit()
      cur.execute("UPDATE vendas_produtos SET Media_Vendas_Produtos = (SELECT COALESCE(AVG(Preco_Final),0) FROM vendas_produtos)")
      avgv = connection.commit()    
      return pvp, vup, avgv 

def get_vprodutos():
      t11 = 'vendas_produtos'
      vp = cur.execute(f"SELECT FORMAT('%04d', id), Cliente,Produto, Marca, STRFTIME('%d/%m/%Y', Validade), Quantidade, FORMAT('R$%.2f', Preco_aVista), FORMAT('R$%.2f', Valor_Total), FORMAT('%.1f%', Desconto), FORMAT('R$%.2f', Preco_Final), Qtde_Parcelas, FORMAT('R$%.2f', Preco_Parcelado), FORMAT('R$%.2f', Total_Vendas_Produtos), FORMAT('R$%.2f', Media_Vendas_Produtos),  STRFTIME('%d/%m/%Y, %H:%M', Ultima_Atualizacao)  FROM '{t11}';" ).fetchall()      
      tvp = cur.execute(f"SELECT name FROM PRAGMA_TABLE_XINFO('{t11}');").fetchall()  
      return vp, tvp   

def post_relatorioMEI(ap, pj, rs, ppdn, ppen, ssdn, ssen, loc, assin):
      cur.execute(f"insert into relatorioMEI (Apuracao, CNPJ, Razao_Social, Produto_Dispensa_NF, Produto_Emissao_NF, Servico_Dispensa_NF, Servico_Emissao_NF, Local,  Assinatura ) values ('{ap}','{pj}','{rs}','{ppdn}','{ppen}','{ssdn}','{ssen}','{loc}','{assin}');")
      rm = connection.commit()
      return rm

def get_relatorioMEI( ):
      t4 = 'relatorioMEI'
      grm = cur.execute(f"select * from '{t4}' ;" ).fetchall()
      # Para retornar o nome das colunas use PRAGMA_TABLE_XINFO('table name')
      trm = cur.execute(f"SELECT name FROM PRAGMA_TABLE_XINFO('{t4}');").fetchall() 
      return grm, trm


def  post_impostos(alu, iptu, luz, agua, tel, net, alu_car, mei, descart, n_prod, eq, mk,  pro, terc, res):
      cur.execute(f"INSERT INTO impostos (aluguel, IPTU, luz, agua, internet, telefone, aluguel_Maquina_Cartao, MEI, descartaveis, novos_produtos, equipamentos, marketing, prolabore, terceiros, reserva) VALUES ('{alu}','{iptu}', '{luz}', '{agua}','{tel}','{net}','{alu_car}' , '{mei}','{descart}', '{n_prod}', '{eq}','{mk}', '{pro}','{terc}', '{res}');")
      pc = connection.commit()
      cur.execute("UPDATE impostos SET Total_Custos_Fixos = (SELECT COALESCE(Total_Contribuicoes ,0)  FROM colaboradores)") 
      up = connection.commit()
      cur.execute("UPDATE colaboradores SET Media_Colaboradores= (SELECT COALESCE(AVG(Total_INSS + Total_FGTS),0)  FROM colaboradores)")
      avgi = connection.commit()    
      return pc, up, avgi

def get_impostos():
      t5 = 'impostos'
      gc = cur.execute(f"SELECT FORMAT('%04d', id), FORMAT('R$%.2f', aluguel), FORMAT('R$%.2f', IPTU), FORMAT('R$%.2f', luz),  FORMAT('R$%.2f', agua),  FORMAT('R$%.2f', internet), FORMAT('R$%.2f', telefone),  FORMAT('R$%.2f', aluguel_Maquina_Cartao),  FORMAT('R$%.2f', MEI),  FORMAT('R$%.2f', Total_Taxas_Impostos),  FORMAT('R$%.2f', descartaveis),  FORMAT('R$%.2f', novos_produtos),  FORMAT('R$%.2f', equipamentos),  FORMAT('R$%.2f', Total_Manutencao),  FORMAT('R$%.2f', marketing),  FORMAT('R$%.2f', prolabore),  FORMAT('R$%.2f', terceiros),  FORMAT('R$%.2f', inss),  FORMAT('R$%.2f', fgts),  FORMAT('R$%.2f', depreciacao),  FORMAT('R$%.2f', reserva),  FORMAT('R$%.2f', Total_Gestao),  FORMAT('R$%.2f', Total_Custos_Fixos), FORMAT('R$%.2f', Media_Custos_Fixos), STRFTIME('%d/%m/%Y, %H:%M', Ultima_Atualizacao) FROM '{t5}';" ).fetchall()      
      # Para retornar o nome das colunas use PRAGMA_TABLE_XINFO('table name')
      tc = cur.execute(f"SELECT name FROM PRAGMA_TABLE_XINFO('{t5}');").fetchall()       
      return gc,tc

# Combo Insert + Update
def update_pessoal():
      cur.execute("UPDATE colaboradores SET Total_INSS = (SELECT COALESCE(TOTAL(INSS),0) FROM colaboradores);")
      ppi = connection.commit()
      cur.execute("UPDATE colaboradores SET Total_FGTS = (SELECT COALESCE(TOTAL(FGTS),0) FROM colaboradores) ;")
      ppf = connection.commit() 
      cur.execute("UPDATE colaboradores SET Media_Colaboradores= (SELECT COALESCE(AVG(Total_Contribuicoes),0)  FROM colaboradores)")
      avgp = connection.commit()          
      return ppi, ppf, avgp

def  post_pessoal(nome, end, cid, ema, tel,  fun, regi, sal, obs):
      cur.execute(f"insert into colaboradores (nome, endereco, cidade, email, telefone, funcao, regime_empregaticio, salario, observacoes) values ('{nome}','{end}','{cid}','{ema}', '{tel}','{fun}','{regi}','{sal}', '{obs}');") 
      pp = connection.commit()
      # (Instanciar a função => Chamar.)
      update_pessoal()     
      return pp

def get_pessoal():
      t5 = 'colaboradores'
      gp = cur.execute(f"SELECT FORMAT('%04d', id), nome, endereco, cidade, email, SUBSTR (telefone, 1,0) || '(' || SUBSTR(telefone, 1, 2) || ') ' || SUBSTR(telefone, 3, 5) || ' - ' || SUBSTR(telefone, 8, 4), funcao, regime_empregaticio, FORMAT('R$%.2f', salario), FORMAT('R$%.2f', INSS), FORMAT('R$%.2f', Total_INSS), FORMAT('R$%.2f', FGTS), FORMAT('R$%.2f', Total_FGTS), FORMAT('R$%.2f', Media_Colaboradores), observacoes, STRFTIME('%d/%m/%Y, %H:%M', Ultima_Atualizacao) FROM '{t5}' ;" ).fetchall()      
      # Para retornar o nome das colunas use PRAGMA_TABLE_XINFO('table name')
      tp = cur.execute(f"SELECT name FROM PRAGMA_TABLE_XINFO('{t5}');").fetchall()       
      return gp, tp


def post_insumos(ts, ni, qfe,ut, pfe, qfr, uf ):
      cur.execute(f"INSERT INTO insumos (Tipo_Servico, Nome_Insumo,Quantidade_Fechada, unidade_total, Preco_Fechado, Quantidade_Fracionada, unidade_fracionada) VALUES('{ts}','{ni}','{qfe}','{ut}','{pfe}','{qfr}','{uf}') ;")
      pi = connection.commit()
      cur.execute(f"UPDATE insumos SET Total_Insumos = (SELECT COALESCE(TOTAL(Custo_Secao),0) FROM insumos);")
      ui = connection.commit()
      cur.execute("UPDATE insumos SET Media_Insumos = (SELECT COALESCE(AVG(Custo_Secao),0) FROM insumos)")
      avgi = connection.commit()
      return pi, ui, avgi

def get_insumos():
      t6 = 'insumos'
      gi = cur.execute(f"select FORMAT('%04d', id), Tipo_Servico, Nome_Insumo, Quantidade_Fechada, unidade_total, FORMAT('R$%.2f', Preco_Fechado),Quantidade_Fracionada, unidade_fracionada,  Quantidade_Atendimento, FORMAT('R$%.2f', Custo_Secao), FORMAT('R$%.2f', Total_Insumos), FORMAT('R$%.2f', Media_Insumos),STRFTIME('%d/%m/%Y, %H:%M', Ultima_Atualizacao) from '{t6}' ;" ).fetchall()      
      # Para retornar o nome das colunas use PRAGMA_TABLE_XINFO('table name')
      ti = cur.execute(f"SELECT name FROM PRAGMA_TABLE_XINFO('{t6}');").fetchall() 

      return gi, ti


def post_depreciacao(ob, pc, vu):
      cur.execute(f"INSERT INTO depreciacao  (Objeto, Preco_Custo, Anos_Uso) VALUES ('{ob}','{pc}', '{vu}');")
      pd = connection.commit()
      cur.execute("UPDATE depreciacao SET Total_Depreciacao = (SELECT COALESCE(SUM(Valor_Depreciacao),0)  FROM depreciacao)")
      ud = connection.commit()
      cur.execute("UPDATE depreciacao SET Media_Depreciacao = (SELECT COALESCE(AVG(Valor_Depreciacao),0)  FROM depreciacao)")
      avgd = connection.commit()
      return pd, ud, avgd

def get_depreciacao():
      t7 = 'depreciacao'
      gd = cur.execute(f"SELECT FORMAT('%04d', id), Objeto, FORMAT('R$%.2f', Preco_Custo) , FORMAT('%.1f Anos', Anos_Uso), FORMAT('R$%.2f', Valor_Depreciacao),  FORMAT('R$%.2f', Total_Depreciacao), FORMAT('R$%.2f', Media_Depreciacao),  STRFTIME('%d/%m/%Y, %H:%M', Ultima_Atualizacao) FROM '{t7}';"  ).fetchall() 
      # Para retornar o nome das colunas use PRAGMA_TABLE_XINFO('table name')
      td = cur.execute(f"SELECT name FROM PRAGMA_TABLE_XINFO('{t7}');").fetchall()
      return gd, td

def get_margem():
      t10 = 'margem'
      gm = cur.execute(f"SELECT FORMAT('%04d', id), Tipo_Servico, FORMAT('R$%.2f', Preco_Ofertado), FORMAT('R$%.2f', Prolabore), FORMAT('R$%.2f', Total_Insumos), FORMAT('R$%.2f', Prolabore_hora), FORMAT('R$%.2f', Custo_Variavel), FORMAT('R$%.2f', Custo_Fixo),  FORMAT('R$%.2f', Pagar_Custo_Fixo), FORMAT('%.2f',Projecao_Atendimentos),   STRFTIME('%d/%m/%Y, %H:%M', Ultima_Atualizacao)  FROM '{t10}' ;" ).fetchall()
      # Para retornar o nome das colunas use PRAGMA_TABLE_XINFO('table name')
      tm = cur.execute(f"SELECT name FROM PRAGMA_TABLE_XINFO('{t10}');").fetchall() 
      return gm, tm

def post_margem(serv, po):
      cur.execute(f"INSERT INTO margem (Servico, Preco_Ofertado,  Prolabore, Total_Insumos, Custo_Fixo) VALUES ('{serv}','{po}',(SELECT prolabore FROM impostos),(SELECT Total_Insumos FROM insumos),(SELECT Total_Custos FROM impostos));")
      pm = connection.commit()
      return pm

def post_markup(tx, mg):
      cur.execute(f"INSERT INTO markup (Tipo_Servico, Preco_Ofertado, Imposto, Depreciacao, Vendas, Insumos, Pessoal, Taxa_Maq_Cartao, Margem_Lucro, Indice_Markup, Preco_Justo) VALUES ((SELECT Tipo_Servico FROM margem ), (SELECT Preco_Ofertado FROM margem ),(SELECT Media_Custos_Fixos FROM impostos),(SELECT Media_Depreciacao FROM depreciacao), (SELECT Media_Vendas_Servicos FROM vendas_servicos), (SELECT Media_Insumos FROM insumos), (SELECT Media_Colaboradores FROM colaboradores), '{tx}', '{mg}' ));")
      pmk = connection.commit()
      return pmk

def get_markup():
      t13 = 'markup'
      gmk = cur.execute(f"SELECT  FORMAT('%04d', id), Tipo_Servico, FORMAT('R$%.2f', Preco_Ofertado), FORMAT('R$%.2f', Impostos), FORMAT('R$%.2f', Depreciacao), FORMAT('R$%.2f', Vendas), FORMAT('%.1f%', Custo_Fixo), FORMAT('R$%.2f', Insumos), FORMAT('R$%.2f', Pessoal), FORMAT('%.1f%', Taxa_Maq_Cartao), FORMAT('%.1f%', Custo_Variavel), FORMAT('%.1f%', Margem_Lucro), FORMAT('%.2f', Indice_Markup), FORMAT('R$%.2f', Preco_Justo),   STRFTIME('%d/%m/%Y, %H:%M', Ultima_Atualizacao) FROM '{t13}';")
      # Para retornar o nome das colunas use PRAGMA_TABLE_XINFO('table name')
      tmk = cur.execute(f"SELECT name FROM PRAGMA_TABLE_XINFO('{t13}');").fetchall() 
      return gmk, tmk

#Rota delete
@app_gestao.route('/delete/<tabela>/<id>')
def delete(tabela,id):
      cur.execute(f"DELETE FROM '{tabela}' where id = '{id}';")
      connection.commit()
      return (f"Deletado item '{id}' da tabela '{tabela}'")

#Rotas SIG
@app_gestao.route('/sig',methods=['GET','POST'])
def sig():
    get = get_impostos()
    print(get)
    return render_template('sig/sig.html',get=get)



@app_gestao.route('/login',methods=['GET','POST'])
def login():      
      senha = 'CreBortoli2023'
      #senha = gerador_senhas()
      qr = qrcode.make(senha)
      qr.save("static/auth/password.png")

      
      form = Login(request.form)
      if request.method == 'POST':    
            #val = request.form['valor']
            valor = form.senha.data
            print(valor)          
            if senha == valor :
                  return redirect(url_for('sig.sig' ))
            else:
                  flash('Token Incorreto!!!')
                       
      return render_template('sig/login.html', form=form)

@app_gestao.route('/getclientes',methods=['GET','POST'])
def getclientes():  
      pesquisa = {} 
      tab = 'clientes'  
      #FlaskForm
      form2 = formClientes(request.form) 
      #Busca de Clientes     
      if request.method == 'POST':           
         pesquisa = form2.pesquisa_clientes.data 
         return redirect(url_for('sig.tabela',nome=pesquisa,get=get))  
      get = get_clientes(pesquisa)
      
      return render_template('sig/getclientes.html', form2=form2,get=get, tab=tab)


@app_gestao.route('/postclientes',methods=['GET','POST'])
def postclientes():
      #FlaskForm
      form3 = cadClientes(request.form)
      if request.method == 'POST':
            #Cadastro de Clientes
            nome = form3.nome.data
            cpf = form3.cpf.data
            email = form3.email.data
            tel = form3.telefone.data
            
            #Funçao insert into
            post_cliente(nome,cpf,email,tel) 
            return redirect(url_for('sig.postclientes'))   
      return render_template('sig/postclientes.html', form3=form3)

@app_gestao.route('/anaminese',methods=['GET','POST'])
def anaminese():
      #FlaskForm
      form4 = formAnaminese(request.form)
      if request.method == 'POST':
            #Ficha-Formulário de Anaminese
            nome = form4.nome.data
            nasc = form4.nascimento.data
            prof = form4.profissao.data
            end = form4.endereco.data
            tel = form4.telefone.data
            ind = form4.indicacao.data
            queixa = form4.queixa_principal.data
            alerg_med = form4.alergia_medicamentos.data
            alerg_asp = form4.alergia_aspirina.data
            trat_med = form4.tratamentos_medicos.data
            cirurg = form4.cirurgias.data
            medicament = form4.medicamentos.data
            prot = form4.proteses.data
            gen = form4.gene.data
            dia = form4.diabetes.data
            press = form4.pressao.data
            dr = form4.doenca_renal.data
            epil = form4.epilepsia.data
            menst = form4.menstruacao.data
            gest = form4.gestante.data
            te = form4.tratamento_estetico.data
            cos = form4.cosmeticos.data
            fs = form4.filtro_solar.data
            bronz = form4.bronzeamento.data
            observ = form4.obs.data
            assin = form4.assinatura.data
            doc = form4.documento.data
            dt = form4.data.data

            #Função insert into
            post_anaminese(nome, nasc, prof, end, tel, ind, queixa,alerg_med, alerg_asp, trat_med, cirurg,medicament, prot, gen, dia, press, dr, epil, menst, gest, te, cos, fs, bronz, observ, assin, doc, dt)

            return redirect(url_for('sig.anaminese'))
      return render_template('sig/anaminese.html',form4=form4) 


@app_gestao.route('/compras',methods=['GET','POST'])
def compras():
      #FlaskForm
      form5= cadCompras(request.form)
      get = get_compras()
      tab = 'compras'
      if request.method == 'POST':
            produto = form5.produto.data
            marca = form5.marca.data
            quantidade = form5.quantidade.data
            unidade = form5.unidade.data
            validade = form5.validade.data
            preco = form5.preco.data
            post_compras(produto,marca,quantidade,unidade,validade,preco)
            return redirect(url_for('sig.compras'))
      return render_template('sig/compras.html',form5=form5,get=get,tab=tab) 



@app_gestao.route('/estoque',methods=['GET','POST'])
def estoque():
      busca = []
      tab = 'compras'
      form7 = formEstoque(request.form)
    
      if request.method == 'POST':
            busca = form7.pesquisa_estoque.data
            return redirect(url_for('sig.tabela2',item=busca))
      get = get_estoque(busca)
      return render_template('sig/estoque.html',form7=form7,get=get, tab=tab)

@app_gestao.route('/vendas_serviços',methods=['GET','POST'])
def vendas_servicos():
      form8 = vendaServicos(request.form)
      get = get_vservicos()
      tab = 'vends_servicos'
      if request.method == 'POST':
            cli = form8.cliente.data
            servico = form8.servico.data
            tempo_min = form8.tempo_min.data
            desc = form8.desconto.data
            pre = form8.preco.data
            obser = form8.observacoes.data
            post_vservicos(cli,servico,tempo_min,desc,pre,obser)
            return redirect(url_for('sig.vendas_servicos'))            
      return render_template('sig/vendas_servicos.html',form8=form8,get=get,tab=tab)

@app_gestao.route('/vendas_produtos',methods=['GET','POST'])
def vendas_produtos():
      get =  get_vprodutos()
      tab='vendas_produtos'
      form9 = vendaProduto(request.form)
     
      if request.method == 'POST':
            cli = form9.cliente.data 
            prod = form9.produto.data
            mar = form9.marca.data 
            quant  = form9.quantidade.data 
            val = form9.validade.data
            pa = form9.preco_aVista.data     
            desco = form9.desconto.data
            qp = form9.qtde_parcelas.data
            post_vprodutos(cli, prod, mar, quant,val, pa, desco, qp)
            return redirect(url_for('sig.vendas_produtos'))                 
      return render_template('sig/vendas_produtos.html',form9=form9,get=get,tab=tab)

@app_gestao.route('/pessoal',methods=['GET','POST'])
def pessoal():
      get = get_pessoal()
      tab = 'colaboradores'
      form10 = formPessoal(request.form)
      if request.method == 'POST':
            nome = form10.nome.data
            end = form10.endereco.data 
            cid = form10.cidade.data 
            ema = form10.email.data 
            tel = form10.telefone.data             
            fun = form10.funcao.data 
            regi = form10.regime.data 
            sal = form10.salario.data 
            obs = form10.observacoes.data
            post_pessoal(nome, end, cid, ema, tel, fun, regi, sal, obs)
            return redirect(url_for('sig.pessoal'))           
      return render_template('sig/pessoal.html', form10=form10,get=get,tab=tab)


@app_gestao.route('/nota')
def nota():
      return render_template('sig/nota.html')





@app_gestao.route('/relatorioMEI',methods=['GET','POST'])
def relatorioMEI():
     get = get_relatorioMEI()  
     tab = 'relatorioMEI'  
     form13 = formRelatorioMEI(request.form)
     if request.method == 'POST':
           ap = form13.apuracao.data
           pj = form13.cnpj.data
           rs = form13.razao_social.data           
           ppdn = form13.pdn.data
           ppen = form13.pen.data
           ssdn = form13.sdn.data
           ssen = form13.sen.data
           loc = form13.local.data
           assin = form13.assinatura.data
           post_relatorioMEI(ap, pj, rs, ppdn, ppen, ssdn, ssen, loc,  assin)
           return redirect(url_for('sig.relatorioMEI'))           
     return render_template('sig/relatorioMEI.html',form13=form13,get=get,tab=tab)

@app_gestao.route('/impostos', methods=['GET','POST'])
def impostos():
      get = get_impostos()
      tab = 'impostos'
      form14 = formImpostos(request.form)
      if request.method == 'POST':           
            alu = form14.alu.data
            iptu = form14.IPTU.data
            luz = form14.luz.data
            agua =  form14.agua.data
            tel = form14.tel.data
            net = form14.net.data
            alu_car = form14.alu_car.data
            mei = form14.MEI.data
            descart = form14.descart.data
            n_prod =  form14.n_prod.data 
            eq = form14.equip.data 
            mk = form14.mkt.data 
            pro = form14.prolab.data             
            terc = form14.terc.data           
            res = form14.reserva.data
            post_impostos(alu, iptu, luz, agua, tel, net, alu_car, mei, descart, n_prod, eq, mk,  pro, terc, res)
            
            return redirect(url_for('sig.impostos'))      
      return render_template('sig/impostos.html',form14=form14,get=get, tab=tab)

@app_gestao.route('/insumos',methods=['GET','POST'])
def insumos():
      get = get_insumos()
      tab = 'insumos'      
     
      form15 = formInsumos(request.form)
      if request.method == 'POST':
            ts = form15.tipo_servico.data
            ni = form15.nome_insumo.data
            qfe = form15.qtde_fechada.data
            ut = form15.qfe_unidade.data
            pfe = form15.preco_fechado.data 
            qfr = form15.qtde_fracionada.data
            uf = form15.qfr_unidade.data           
            post_insumos(ts, ni, qfe,ut, pfe, qfr, uf ) 
            return redirect(url_for('sig.insumos'))    
      return render_template('sig/insumos.html',form15=form15,get=get,tab=tab)

@app_gestao.route('/depreciacao', methods=['GET','POST'])
def depreciacao():
      get = get_depreciacao()
      tab = 'depreciacao'
      form16 = formDepreciacao()
      if request.method == 'POST':
            ob = form16.obj.data
            pc = form16.preco_custo.data
            vu = form16.vida_util.data
            post_depreciacao(ob, pc, vu)       

            return redirect(url_for('sig.depreciacao'))
      return render_template('sig/depreciacao.html', form16=form16,get=get, tab=tab)

@app_gestao.route('/margemlucro',methods=['GET','POST'])
def margemlucro():
      get=get_margem()
      tab = 'margem'
      form12 = formMargem(request.form)
      if request.method == 'POST':
            serv = form12.servico.data
            po = form12.preco_oferta.data
            post_margem(serv, po)
            return redirect(url_for('sig.margemlucro'))
      return render_template('sig/margemlucro.html',form12=form12, get=get, tab=tab)  

@app_gestao.route('/markup', methods=['GET','POST'])
def markup():
      get = get_markup()
      tab = 'markup'
      form13 = formMarkup(request.form)
      if request.method == 'POST':
            tx = form13.txmc.data
            mg = form13.mg.data
            post_markup(tx, mg)
            return redirect(url_for('sig.markup'))
      return render_template('sig/markup.html',form13=form13, get=get, tab = tab)


# Tabelas
@app_gestao.route('/tabela/<nome>')
def tabela(nome):
           
      get = get_clientes(nome)
     
     

      try:
            return render_template('sig/tabela.html',get=get)
      except Exception:
            return render_template('sig/error.html')

@app_gestao.route('/tabela2/<item>')
def tabela2(item):      
      get = get_estoque(item)
      try:
            return render_template('sig/tabela2.html',get=get)
      except Exception:
            return render_template('sig/error.html')

@app_gestao.route('/tabela3')
def tabela3():      
      get = get_vservicos()
      try:
            return render_template('sig/tabela3.html',get=get)
      except Exception:
            return render_template('sig/error.html')

@app_gestao.route('/tabela4')
def tabela4():      
      get = get_relatorioMEI()
      try:
            return render_template('sig/tabela4.html',get=get)
      except Exception:
            return render_template('sig/error.html')

@app_gestao.route('/tabela5')
def tabela5():      
      get = get_impostos()
      
      try:
            return render_template('sig/tabela5.html',get=get)
      except Exception:
            return render_template('sig/error.html')
      

@app_gestao.route('/tabela6')
def tabela6():      
      get = get_insumos()      
      try:
            return render_template('sig/tabela6.html',get=get)
      except Exception:
            return render_template('sig/error.html')
      

@app_gestao.route('/tabela7')
def tabela7():      
      get = get_depreciacao() 
      try:
            return render_template('sig/tabela7.html',get=get)
      except Exception:
            return render_template('sig/error.html')
      
@app_gestao.route('/tabela8')
def tabela8():      
      get = get_compras()      
      try:
            return render_template('sig/tabela8.html',get=get)
      except Exception as e:
            return render_template('sig/error.html',e=e)
      
@app_gestao.route('/tabela9')
def tabela9():      
      get = get_pessoal()
      
      try:
            return render_template('sig/tabela9.html',get=get)
      except Exception:
            return render_template('sig/error.html')
      
@app_gestao.route('/tabela10',methods=['GET','POST'])
def tabela10():
      tab = 'margem'

      get = get_margem()  
             
      try:
            return render_template('sig/tabela10.html',get=get)
            
      except Exception:
            return render_template('sig/error.html')

@app_gestao.route('/tabela11')
def tabela11():      
      get = get_vprodutos()      
      try:
            return render_template('sig/tabela11.html',get=get)
      except Exception as e:
            return render_template('sig/error.html',e=e)
      

      










