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
        
        var agendamentosConfirmados = agendamentosCache.filter(function(a) {
            return a.status === 'CONFIRMADO';
        });
        
        if (agendamentosConfirmados.length === 0) {
            listaTodos.innerHTML = '<div class="sem-agendamentos">Nenhum agendamento confirmado ainda.</div>';
            return;
        }
        
        agendamentosConfirmados.sort(function(a, b) {
            var dA = a.data && a.data.includes('T') ? a.data.split('T')[0] : a.data;
            var dB = b.data && b.data.includes('T') ? b.data.split('T')[0] : b.data;
            return new Date(dB) - new Date(dA);
        });
        
        function gerarHtmlAgendamento(a) {
            return '<div class="meu-agendamento">' +
                   '<div class="info-agendamento">' +
                   '<div class="cliente"><strong>' + (a.cliente || 'Cliente') + '</strong></div>' +
                   '<div class="servico">' + (a.servico_nome || a.servicoNome || 'Serviço') + '</div>' +
                   '<div class="data">' + formatarData(a.data) + ' às ' + (a.hora || '') + '</div>' +
                   '</div>' +
                   '<button class="btn-excluir-agendamento" onclick="AgendaPagina.excluirAgendamento(\'' + a.id + '\')">Excluir</button>' +
                   '</div>';
        }
        
        listaTodos.innerHTML = agendamentosConfirmados.map(gerarHtmlAgendamento).join('');
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
    
        return {
            init: init,
            selecionarDia: selecionarDia,
            fecharModal: fecharModal,
            atualizarPreco: atualizarPreco,
            excluirAgendamento: excluirAgendamento
        };
})();

document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('calendario-grid')) {
        AgendaPagina.init();
    }
});
