var AgendaPagina = (function() {
    'use strict';
    
    var dataAtual = new Date();
    var agendamentosCache = [];
    
    async function init() {
        try {
            agendamentosCache = await AgendamentoStore.getAll();
            console.log('Agendamentos carregados:', agendamentosCache.length);
        } catch(e) {
            console.error('Erro ao carregar agendamentos:', e);
            agendamentosCache = [];
        }
        
        var servicos = [];
        try {
            servicos = await ServicosStore.getAll();
        } catch(e) {
            console.error('Erro ao carregar servicos:', e);
        }
        
        if (!servicos || servicos.length === 0) {
            servicos = [
                { id: 'massagem', nome: 'Massagem', preco: '50' }
            ];
        }
        
        popularServicos(servicos);
        renderizarCalendario();
        renderizarMeusAgendamentos();
        setupEventListeners();
    }
    
    function setupEventListeners() {
        var form = document.getElementById('form-agendamento');
        if (form) {
            form.addEventListener('submit', handleSubmit);
        }
    }
    
    function renderizarCalendario() {
        var grid = document.getElementById('calendario-grid');
        var mesAno = document.getElementById('mes-ano');
        if (!grid || !mesAno) return;
        
        var ano = dataAtual.getFullYear();
        var mes = dataAtual.getMonth();
        var nomesMeses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
        mesAno.textContent = nomesMeses[mes] + ' ' + ano;
        
        var primeiroDia = new Date(ano, mes, 1);
        var ultimoDia = new Date(ano, mes + 1, 0);
        var diaSemana = primeiroDia.getDay();
        
        var html = '';
        for (var i = 0; i < diaSemana; i++) {
            var dia = new Date(ano, mes, -diaSemana + i + 1);
            html += '<div class="dia-cell outro-mes"><div class="dia-numero">' + dia.getDate() + '</div></div>';
        }
        
        for (var dia = 1; dia <= ultimoDia.getDate(); dia++) {
            var data = new Date(ano, mes, dia);
            var dataStr = data.toISOString().split('T')[0];
            
            var agendamentosDoDia = agendamentosCache.filter(function(a) {
                var d = a.data && a.data.includes('T') ? a.data.split('T')[0] : a.data;
                return d === dataStr;
            });
            
            if (data < new Date().setHours(0,0,0,0)) {
                html += '<div class="dia-cell outro-mes"><div class="dia-numero">' + dia + '</div></div>';
            } else {
                html += '<div class="dia-cell" onclick="AgendaPagina.selecionarDia(\'' + dataStr + '\')">';
                html += '<div class="dia-numero">' + dia + '</div>';
                if (agendamentosDoDia.length > 0) {
                    html += '<span class="agendamento-badge">' + agendamentosDoDia.length + ' agendado(s)</span>';
                }
                html += '</div>';
            }
        }
        
        grid.innerHTML = html;
    }
    
    function renderizarMeusAgendamentos() {
        var lista = document.getElementById('lista-meus-agendamentos');
        if (!lista) {
            console.error('Elemento lista-meus-agendamentos não encontrado');
            return;
        }
        
        console.log('Renderizando Meus Agendamentos:', agendamentosCache.length);
        
        if (!agendamentosCache || agendamentosCache.length === 0) {
            lista.innerHTML = '<div class="sem-agendamentos">Nenhum agendamento ainda. Clique em um dia para agendar!</div>';
            return;
        }
        
        agendamentosCache.sort(function(a, b) {
            var dA = a.data && a.data.includes('T') ? a.data.split('T')[0] : a.data;
            var dB = b.data && b.data.includes('T') ? b.data.split('T')[0] : b.data;
            return new Date(dB) - new Date(dA);
        });
        
        var html = agendamentosCache.map(function(a) {
            return '<div class="meu-agendamento">' +
                   '<div class="info-agendamento">' +
                   '<div class="servico">' + (a.servico_nome || a.servicoNome || 'Serviço') + '</div>' +
                   '<div class="data">' + a.data + ' às ' + (a.hora || '') + '</div>' +
                   '<div class="valor">R$ ' + (a.valor || 0).toFixed(2).replace('.', ',') + '</div>' +
                   '</div>' +
                   '<div><button class="btn-excluir" onclick="AgendaPagina.excluirAgendamento(\'' + a.id + '\')">Excluir</button></div>' +
                   '</div>';
        }).join('');
        
        lista.innerHTML = html;
    }
    
    function selecionarDia(data) {
        abrirModal(data);
    }
    
    function abrirModal(data) {
        var modal = document.getElementById('modal-agendamento');
        if (!modal) return;
        
        document.getElementById('data-selecao').value = data;
        document.getElementById('data-input').value = data;
        document.getElementById('nome').value = '';
        document.getElementById('telefone').value = '';
        modal.classList.add('active');
    }
    
    function handleSubmit(e) {
        e.preventDefault();
        
        var servicoId = document.getElementById('servico').value;
        var data = document.getElementById('data-input').value;
        var nome = document.getElementById('nome').value;
        var telefone = document.getElementById('telefone').value.replace(/\D/g, '');
        var horario = document.getElementById('horario').value;
        
        if (!data || !servicoId || !nome || !telefone || !horario) {
            alert('Preencha todos os campos.');
            return;
        }
        
        AgendamentoStore.save({
            data: data,
            hora: horario,
            cliente: nome,
            telefone: telefone,
            servico: servicoId,
            status: 'PENDENTE',
            pago: false
        }).then(function() {
            alert('Agendamento realizado!');
            return AgendamentoStore.getAll();
        }).then(function(dados) {
            agendamentosCache = dados;
            renderizarCalendario();
            renderizarMeusAgendamentos();
            document.getElementById('modal-agendamento').classList.remove('active');
        });
    }
    
    function excluirAgendamento(id) {
        if (confirm('Tem certeza que deseja excluir este agendamento?')) {
            AgendamentoStore.delete(id).then(function() {
                alert('Agendamento excluido!');
                return AgendamentoStore.getAll();
            }).then(function(dados) {
                agendamentosCache = dados;
                renderizarCalendario();
                renderizarMeusAgendamentos();
            });
        }
    }
    
    function popularServicos(servicos) {
        var select = document.getElementById('servico');
        if (!select) return;
        
        var options = '<option value="">Selecione...</option>';
        servicos.forEach(function(s) {
            options += '<option value="' + s.id + '">' + s.nome + ' - R$ ' + parseFloat(s.preco || 0).toFixed(2).replace('.', ',') + '</option>';
        });
        select.innerHTML = options;
    }
    
    return {
        init: init,
        selecionarDia: selecionarDia,
        excluirAgendamento: excluirAgendamento
    };
})();

document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('calendario-grid')) {
        AgendaPagina.init();
    }
});
