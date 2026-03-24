/* =============================================================================
   JavaScript da Página de Agenda
   ============================================================================= */

var AgendaPagina = (function() {
    'use strict';
    
    var dataAtual = new Date();
    var agendamentoSelecionado = null;
    var servicosCarregados = false;
    var nomeUsuario = '';
    var telefoneUsuario = '';
    
    var nomesMeses = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    
    /* -------------------------------------------------------------------------
       Inicialização
       --------------------------------------------------------------------- */
    function init() {
        carregarDadosUsuario();
        
        ServicosStore.init().then(function() {
            servicosCarregados = true;
            popularServicos();
            renderizarCalendario();
            renderizarMeusAgendamentos();
            verificarParametroURL();
        }).catch(function(err) {
            console.error('Erro ao carregar servicos:', err);
            popularServicos();
            renderizarCalendario();
            renderizarMeusAgendamentos();
        });
        
        setupEventListeners();
    }
    
    function setupEventListeners() {
        document.getElementById('form-agendamento').addEventListener('submit', handleSubmit);
        
        document.getElementById('data-input').addEventListener('change', function() {
            var data = this.value;
            if (data) {
                document.getElementById('data-selecionada').textContent = formatarData(data);
            }
        });
        
        var telInput = document.getElementById('telefone');
        if (telInput) {
            telInput.addEventListener('input', function(e) {
                formatarTelefone(e.target);
            });
            telInput.addEventListener('blur', function(e) {
                if (e.target.value.length >= 10) {
                    formatarTelefone(e.target);
                }
            });
        }
    }
    
    function formatarTelefone(input) {
        var value = input.value.replace(/\D/g, '');
        if (value.length > 11) value = value.slice(0, 11);
        
        if (value.length > 7) {
            value = '(' + value.slice(0,2) + ') ' + value.slice(2,7) + '-' + value.slice(7);
        } else if (value.length > 2) {
            value = '(' + value.slice(0,2) + ') ' + value.slice(2);
        } else if (value.length > 0) {
            value = '(' + value;
        }
        
        input.value = value;
    }
    
    function limparTelefone(telefone) {
        return telefone.replace(/\D/g, '');
    }
    
    function carregarDadosUsuario() {
        nomeUsuario = localStorage.getItem('crebortoli_nome') || '';
        telefoneUsuario = localStorage.getItem('crebortoli_telefone') || '';
    }
    
    function salvarDadosUsuario(nome, telefoneFormatado) {
        localStorage.setItem('crebortoli_nome', nome);
        localStorage.setItem('crebortoli_telefone', telefoneFormatado);
    }
    
    /* -------------------------------------------------------------------------
       Renderização do Calendário
       --------------------------------------------------------------------- */
    function renderizarCalendario() {
        var grid = document.getElementById('calendario-grid');
        var mesAno = document.getElementById('mes-ano');
        
        if (!grid || !mesAno) return;
        
        var ano = dataAtual.getFullYear();
        var mes = dataAtual.getMonth();
        
        mesAno.textContent = nomesMeses[mes] + ' ' + ano;
        
        var primeiroDia = new Date(ano, mes, 1);
        var ultimoDia = new Date(ano, mes + 1, 0);
        var inicioSemana = primeiroDia.getDay();
        
        var html = '';
        
        for (var i = 0; i < inicioSemana; i++) {
            var dia = new Date(ano, mes, -inicioSemana + i + 1);
            html += '<div class="dia-cell outro-mes"><div class="dia-numero">' + dia.getDate() + '</div></div>';
        }
        
        for (var dia = 1; dia <= ultimoDia.getDate(); dia++) {
            var data = new Date(ano, mes, dia);
            var dataStr = data.toISOString().split('T')[0];
            var isToday = data.toDateString() === new Date().toDateString();
            var isPast = data < new Date().setHours(0,0,0,0);
            
            var agendamentosDoDia = AgendamentoStore.getAll().filter(function(a) { 
                return a.data === dataStr; 
            });
            
            var badgeClass = '';
            var badgeText = '';
            
            if (agendamentosDoDia.length > 0) {
                var temNaoPago = agendamentosDoDia.some(function(a) { return !a.pago; });
                var temPago = agendamentosDoDia.some(function(a) { return a.pago; });
                
                if (temNaoPago && temPago) {
                    badgeClass = 'nao-pago';
                    badgeText = 'Agendado(s)';
                } else if (temNaoPago) {
                    badgeClass = 'nao-pago';
                    badgeText = agendamentosDoDia.length + ' agendado(s)';
                } else {
                    badgeClass = 'pago';
                    badgeText = 'Pago(s)';
                }
            }
            
            if (isPast) {
                html += '<div class="dia-cell outro-mes"><div class="dia-numero">' + dia + '</div></div>';
            } else {
                html += '<div class="dia-cell ' + (isToday ? 'today' : '') + '" onclick="AgendaPagina.selecionarDia(\'' + dataStr + '\')">' +
                        '<div class="dia-numero">' + dia + '</div>';
                
                if (agendamentosDoDia.length > 0) {
                    html += '<span class="agendamento-badge ' + badgeClass + '">' + badgeText + '</span>';
                } else {
                    html += '<span style="font-size:0.75rem; color:#999;">Disponível</span>';
                }
                
                html += '</div>';
            }
        }
        
        grid.innerHTML = html;
    }
    
    function navegarMes(direcao) {
        dataAtual.setMonth(dataAtual.getMonth() + direcao);
        renderizarCalendario();
    }
    
    /* -------------------------------------------------------------------------
       Modal de Agendamento
       --------------------------------------------------------------------- */
    function selecionarDia(data) {
        abrirModal(data);
    }
    
    function abrirModal(data, servicoId) {
        var modal = document.getElementById('modal-agendamento');
        if (!modal) return;
        
        document.getElementById('data-selecao').value = data;
        document.getElementById('data-input').value = data;
        document.getElementById('data-selecionada').textContent = formatarData(data);
        
        document.getElementById('nome').value = nomeUsuario;
        document.getElementById('telefone').value = telefoneUsuario;
        document.getElementById('pagar-agora').checked = false;
        
        popularServicos(servicoId);
        
        modal.classList.add('active');
    }
    
    function fecharModal() {
        document.getElementById('modal-agendamento').classList.remove('active');
        document.getElementById('form-agendamento').reset();
        document.getElementById('preco-total').textContent = '0,00';
        document.getElementById('pagar-agora').checked = false;
    }
    
    function popularServicos(servicoIdPreselecionado) {
        if (!servicosCarregados) return;
        
        var servicos = ServicosStore.getAll();
        var select = document.getElementById('servico');
        var options = '<option value="">Selecione...</option>';
        
        servicos.forEach(function(s) {
            options += '<option value="' + s.id + '" data-preco="' + s.preco + '">' + 
                       s.nome + ' - R$ ' + s.preco.toFixed(2).replace('.', ',') + '</option>';
        });
        
        select.innerHTML = options;
        
        if (servicoIdPreselecionado) {
            for (var i = 0; i < select.options.length; i++) {
                if (select.options[i].value === servicoIdPreselecionado) {
                    select.selectedIndex = i;
                    atualizarPreco();
                    break;
                }
            }
        }
    }
    
    function atualizarPreco() {
        var select = document.getElementById('servico');
        var option = select.options[select.selectedIndex];
        if (option && option.dataset.preco) {
            document.getElementById('preco-total').textContent = parseFloat(option.dataset.preco).toFixed(2).replace('.', ',');
        } else {
            document.getElementById('preco-total').textContent = '0,00';
        }
    }
    
    /* -------------------------------------------------------------------------
       Submit do Formulário
       --------------------------------------------------------------------- */
    function handleSubmit(e) {
        e.preventDefault();
        
        var servicoId = document.getElementById('servico').value;
        var servico = ServicosStore.getById(servicoId);
        var data = document.getElementById('data-input').value;
        var nome = document.getElementById('nome').value;
        var telefoneFormatado = document.getElementById('telefone').value;
        var telefoneLimpo = limparTelefone(telefoneFormatado);
        var pagarAgora = document.getElementById('pagar-agora').checked;
        
        if (!data || !servicoId || !nome || !telefoneLimpo) {
            alert('Por favor, preencha todos os campos.');
            return;
        }
        
        if (telefoneLimpo.length < 10 || telefoneLimpo.length > 11) {
            alert('Por favor, insira um número de WhatsApp válido.');
            return;
        }
        
        salvarDadosUsuario(nome, telefoneFormatado);
        
        var agendamento = {
            data: data,
            hora: 'A confirmar',
            cliente: nome,
            telefone: telefoneLimpo,
            telefoneFormatado: telefoneFormatado,
            servico: servicoId,
            servicoNome: servico ? servico.nome : '',
            valor: servico ? servico.preco : 0,
            status: pagarAgora ? 'PAGO' : 'PENDENTE',
            pago: pagarAgora
        };
        
        AgendamentoStore.save(agendamento);
        
        var whatsappMsg = 'Olá! Acabei de fazer um agendamento no site:\n\n' +
            '📅 Data: ' + formatarData(agendamento.data) + '\n' +
            '👤 Nome: ' + agendamento.cliente + '\n' +
            '📱 WhatsApp: ' + telefoneFormatado + '\n' +
            '💇 Serviço: ' + agendamento.servicoNome + '\n' +
            '💰 Valor: R$ ' + agendamento.valor.toFixed(2).replace('.', ',');
        
        if (pagarAgora) {
            whatsappMsg += '\n\n✅ Pagamento: Efetuado via PIX';
        }
        
        fecharModal();
        renderizarCalendario();
        renderizarMeusAgendamentos();
        
        alert('Agendamento realizado com sucesso!' + (pagarAgora ? '\nPagamento registrado!' : ''));
        window.open('https://api.whatsapp.com/send?phone=5514996638056&text=' + encodeURIComponent(whatsappMsg), '_blank');
    }
    
    /* -------------------------------------------------------------------------
       Modal de Pagamento
       --------------------------------------------------------------------- */
    function abrirModalPagamento(id) {
        agendamentoSelecionado = AgendamentoStore.getAll().find(function(a) { 
            return a.id === id; 
        });
        
        if (!agendamentoSelecionado) return;
        
        document.getElementById('info-pagamento-selecionado').innerHTML = 
            '<p><strong>Serviço:</strong> ' + agendamentoSelecionado.servicoNome + '</p>' +
            '<p><strong>Data:</strong> ' + formatarData(agendamentoSelecionado.data) + '</p>' +
            '<p><strong>Valor:</strong> <span style="font-size:1.3rem; color:#2e7d32; font-weight:bold;">R$ ' + 
            agendamentoSelecionado.valor.toFixed(2).replace('.', ',') + '</span></p>';
        
        document.getElementById('modal-pagamento').classList.add('active');
    }
    
    function fecharModalPagamento() {
        document.getElementById('modal-pagamento').classList.remove('active');
        agendamentoSelecionado = null;
    }
    
    function copiarChavePix() {
        navigator.clipboard.writeText('14996638056').then(function() {
            alert('Chave PIX copiada!');
        });
    }
    
    function confirmarPagamento() {
        if (!agendamentoSelecionado) return;
        
        AgendamentoStore.update(agendamentoSelecionado.id, { pago: true, status: 'PAGO' });
        
        var whatsappMsg = 'Olá! Já fiz o pagamento do meu agendamento:\n\n' +
            '📅 Data: ' + formatarData(agendamentoSelecionado.data) + '\n' +
            '💇 Serviço: ' + agendamentoSelecionado.servicoNome + '\n' +
            '💰 Valor: R$ ' + agendamentoSelecionado.valor.toFixed(2).replace('.', ',') + '\n\n' +
            'Por favor, confirmem o recebimento!';
        
        fecharModalPagamento();
        renderizarCalendario();
        renderizarMeusAgendamentos();
        
        alert('Pagamento registrado! Entraremos em contato para confirmar.');
        window.open('https://api.whatsapp.com/send?phone=5514996638056&text=' + encodeURIComponent(whatsappMsg), '_blank');
    }
    
    /* -------------------------------------------------------------------------
       Meus Agendamentos
       --------------------------------------------------------------------- */
    function renderizarMeusAgendamentos() {
        var lista = document.getElementById('lista-meus-agendamentos');
        if (!lista) return;
        
        var agendamentos = AgendamentoStore.getAll().sort(function(a, b) {
            return new Date(a.data) - new Date(b.data);
        });
        
        if (agendamentos.length === 0) {
            lista.innerHTML = '<div class="sem-agendamentos">Nenhum agendamento ainda. Clique em um dia para agendar!</div>';
            return;
        }
        
        var html = agendamentos.map(function(a) {
            var badgePago = a.pago ? 
                '<span class="badge-pago">✓ Pago</span>' : 
                '<button class="btn-pix" onclick="AgendaPagina.abrirModalPagamento(\'' + a.id + '\')">Pagar PIX</button>';
            
            return '<div class="meu-agendamento ' + (a.pago ? 'pago' : 'nao-pago') + '">' +
                   '<div class="info-agendamento">' +
                   '<div class="servico">' + a.servicoNome + '</div>' +
                   '<div class="data">' + formatarData(a.data) + '</div>' +
                   '<div class="valor">R$ ' + a.valor.toFixed(2).replace('.', ',') + '</div>' +
                   '</div>' +
                   '<div>' + badgePago + '</div>' +
                   '</div>';
        }).join('');
        
        lista.innerHTML = html;
    }
    
    /* -------------------------------------------------------------------------
       Parâmetros da URL
       --------------------------------------------------------------------- */
    function verificarParametroURL() {
        var params = new URLSearchParams(window.location.search);
        var servicoId = params.get('servico');
        var data = params.get('data');
        
        if (servicoId || data) {
            if (!data) {
                data = new Date().toISOString().split('T')[0];
            }
            abrirModal(data, servicoId);
        }
    }
    
    /* -------------------------------------------------------------------------
       Utilitários
       --------------------------------------------------------------------- */
    function formatarData(dataStr) {
        if (!dataStr) return '';
        var data = new Date(dataStr + 'T00:00:00');
        return data.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    }
    
    /* -------------------------------------------------------------------------
       API Pública
       --------------------------------------------------------------------- */
    return {
        init: init,
        selecionarDia: selecionarDia,
        navegarMes: navegarMes,
        fecharModal: fecharModal,
        atualizarPreco: atualizarPreco,
        abrirModalPagamento: abrirModalPagamento,
        fecharModalPagamento: fecharModalPagamento,
        copiarChavePix: copiarChavePix,
        confirmarPagamento: confirmarPagamento,
        abrirModal: abrirModal
    };
    
})();

document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('calendario-grid')) {
        AgendaPagina.init();
    }
});
