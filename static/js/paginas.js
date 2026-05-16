var AgendaPagina = (function() {
    'use strict';
    
    var dataAtual = new Date();
    var agendamentosCache = [];
    
    function formatarTelefone(tel) {
        if (!tel) return '';
        var digits = tel.replace(/\D/g, '');
        if (digits.length === 11) {
            return '(' + digits.substring(0, 2) + ') ' + digits.substring(2, 7) + '-' + digits.substring(7);
        } else if (digits.length === 10) {
            return '(' + digits.substring(0, 2) + ') ' + digits.substring(2, 6) + '-' + digits.substring(6);
        }
        return tel;
    }
    
    function formatarData(dataStr) {
        if (!dataStr) return '';
        var data = new Date(dataStr);
        var dia = data.getDate().toString().padStart(2, '0');
        var mes = (data.getMonth() + 1).toString().padStart(2, '0');
        var ano = data.getFullYear();
        return dia + '/' + mes + '/' + ano;
    }
    
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
                { id: 'dep_perna', nome: 'Depilação Perna', preco: 25, categoria: 'Depilação' },
                { id: 'dep_virilha', nome: 'Depilação Virilha Completa', preco: 50, categoria: 'Depilação' },
                { id: 'dep_buco', nome: 'Depilação Buço', preco: 15, categoria: 'Depilação' },
                { id: 'dep_axilas', nome: 'Depilação Axilas', preco: 20, categoria: 'Depilação' },
                { id: 'dep_pacote', nome: 'Pacote Mensal Depilação', preco: 90, categoria: 'Depilação' },
                { id: 'barreira_cutanea', nome: 'Reparação de Barreira Cutânea', preco: 50, categoria: 'Tratamento' },
                { id: 'limpeza_pele', nome: 'Limpeza de Pele', preco: 100, categoria: 'Tratamento' },
                { id: 'massagem', nome: 'Massagem Relaxante', preco: 50, categoria: 'Massagem' }
            ];
        }
        
        popularServicos(servicos);
        renderizarCalendario();
        renderizarMeusAgendamentos();
        setupEventListeners();
        processarHash();
    }
    
    async function recarregarAgendamentos() {
        try {
            agendamentosCache = await AgendamentoStore.getAll();
            console.log('Agendamentos recarregados:', agendamentosCache.length);
            renderizarCalendario();
            renderizarMeusAgendamentos();
        } catch(e) {
            console.error('Erro ao recarregar agendamentos:', e);
        }
    }
    
    function setupEventListeners() {
        var form = document.getElementById('form-agendamento');
        if (form) {
            form.addEventListener('submit', handleSubmit);
        }
        var telefoneInput = document.getElementById('telefone');
        if (telefoneInput) {
            telefoneInput.addEventListener('blur', function(e) {
                e.target.value = formatarTelefone(e.target.value);
            });
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
        
        var hoje = new Date();
        hoje.setHours(0,0,0,0);
        
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
            
            var isHoje = data.getTime() === hoje.getTime();
            var isPassado = data < hoje;
            
            if (isPassado) {
                html += '<div class="dia-cell outro-mes"><div class="dia-numero">' + dia + '</div></div>';
            } else {
                var classes = 'dia-cell';
                if (isHoje) classes += ' today';
                
                html += '<div class="' + classes + '" onclick="AgendaPagina.selecionarDia(\'' + dataStr + '\')">';
                html += '<div class="dia-numero">' + dia + '</div>';
                
                if (agendamentosDoDia.length > 0) {
                    var pendentes = agendamentosDoDia.filter(function(a) { return !a.pago && a.status !== 'CONCLUIDO' && a.status !== 'PAGO'; }).length;
                    var pagos = agendamentosDoDia.length - pendentes;
                    
                    if (pendentes > 0) {
                        html += '<span class="agendamento-badge nao-pago">' + pendentes + ' pendente(s)</span>';
                    }
                    if (pagos > 0) {
                        html += '<span class="agendamento-badge pago">' + pagos + ' pago(s)</span>';
                    }
                }
                
                html += '</div>';
            }
        }
        
        grid.innerHTML = html;
    }
    
    function renderizarMeusAgendamentos() {
        var listaTodos = document.getElementById('lista-meus-agendamentos');
        
        if (!listaTodos) {
            console.error('Elemento lista-meus-agendamentos não encontrado');
            return;
        }
        
        console.log('Renderizando Meus Agendamentos:', agendamentosCache.length);
        
        if (!agendamentosCache || agendamentosCache.length === 0) {
            listaTodos.innerHTML = '<div class="sem-agendamentos">Nenhum agendamento ainda. Clique em um dia para agendar!</div>';
            return;
        }
        
        var agendamentosParaExibir = agendamentosCache.filter(function(a) {
            return a.status && a.status.toUpperCase() !== 'CANCELADO';
        });
        
        if (agendamentosParaExibir.length === 0) {
            listaTodos.innerHTML = '<div class="sem-agendamentos">Nenhum agendamento ainda. Clique em um dia para agendar!</div>';
            return;
        }
        
        agendamentosParaExibir.sort(function(a, b) {
            var dA = a.data && a.data.includes('T') ? a.data.split('T')[0] : a.data;
            var dB = b.data && b.data.includes('T') ? b.data.split('T')[0] : b.data;
            return new Date(dB) - new Date(dA);
        });
        
        function gerarHtmlAgendamento(a) {
            var statusBadge = '';
            if (a.status === 'PENDENTE' || (a.status && a.status.toUpperCase() === 'PENDENTE')) {
                statusBadge = '<span class="badge-status pendente">Pendente</span>';
            } else if (a.status === 'CONFIRMADO' || (a.status && a.status.toUpperCase() === 'CONFIRMADO')) {
                statusBadge = '<span class="badge-status confirmado">Confirmado</span>';
            } else if (a.status === 'APROVADO' || (a.status && a.status.toUpperCase() === 'APROVADO')) {
                statusBadge = '<span class="badge-status aprovado">Aprovado</span>';
            }
            
            return '<div class="meu-agendamento">' +
                   '<div class="info-agendamento">' +
                   '<div class="cliente"><strong>' + (a.cliente || 'Cliente') + '</strong></div>' +
                   '<div class="servico">' + (a.servico_nome || a.servicoNome || 'Serviço') + '</div>' +
                   '<div class="data">' + formatarData(a.data) + ' às ' + (a.hora || '') + '</div>' +
                   (statusBadge ? '<div class="status">' + statusBadge + '</div>' : '') +
                   '</div>' +
                   '<button class="btn-excluir-agendamento" onclick="AgendaPagina.excluirAgendamento(\'' + a.id + '\')" title="Excluir agendamento">' +
                   '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>' +
                   '</button>' +
                   '</div>';
        }
        
        listaTodos.innerHTML = agendamentosParaExibir.map(gerarHtmlAgendamento).join('');
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
    
    function fecharModal() {
        var modal = document.getElementById('modal-agendamento');
        if (modal) modal.classList.remove('active');
    }
    
    function atualizarPreco() {
        var select = document.getElementById('servico');
        var precoSpan = document.getElementById('preco-total');
        if (!select || !precoSpan) return;
        
        var selectedOption = select.options[select.selectedIndex];
        if (!selectedOption.value) {
            precoSpan.textContent = '0,00';
            return;
        }
        
        var match = selectedOption.text.match(/R\$\s*([\d,.]+)/);
        var preco = match ? parseFloat(match[1].replace(',', '.')) : 0;
        precoSpan.textContent = preco.toFixed(2).replace('.', ',');
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
    
        async function excluirAgendamento(id) {
            if (!confirm('Tem certeza que deseja excluir este agendamento?')) return;
            
            try {
                await AgendamentoStore.delete(id);
                alert('Agendamento excluído com sucesso!');
                agendamentosCache = await AgendamentoStore.getAll();
                renderizarCalendario();
                renderizarMeusAgendamentos();
            } catch(e) {
                console.error('Erro ao excluir agendamento:', e);
                alert('Erro ao excluir agendamento. Tente novamente.');
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
    
    function navegarMes(direcao) {
        dataAtual.setMonth(dataAtual.getMonth() + direcao);
        renderizarCalendario();
    }
    
    function processarHash() {
        var hash = window.location.hash.substring(1);
        if (!hash) return;
        
        var params = {};
        hash.split('&').forEach(function(pair) {
            var parts = pair.split('=');
            if (parts[0]) params[parts[0]] = decodeURIComponent(parts[1] || '');
        });
        
        var servicoId = params.servico;
        var data = params.data;
        
        if (!data || !servicoId) return;
        
        var select = document.getElementById('servico');
        if (select) {
            for (var i = 0; i < select.options.length; i++) {
                if (select.options[i].value === servicoId) {
                    select.selectedIndex = i;
                    break;
                }
            }
        }
        atualizarPreco();
        
        abrirModal(data);
        
        window.location.hash = '';
    }
    
    return {
        init: init,
        selecionarDia: selecionarDia,
        fecharModal: fecharModal,
        atualizarPreco: atualizarPreco,
        excluirAgendamento: excluirAgendamento,
        recarregarAgendamentos: recarregarAgendamentos,
        navegarMes: navegarMes
    };
})();

document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('calendario-grid')) {
        AgendaPagina.init();
    }
});
