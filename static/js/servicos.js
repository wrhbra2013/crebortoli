/* =============================================================================
   JavaScript da Página de Serviços/Tabela de Preços
   ============================================================================= */

var ServicosPagina = (function() {
    'use strict';
    
    var servicosCarregados = false;
    
    /* -------------------------------------------------------------------------
       Inicialização
       --------------------------------------------------------------------- */
    function init() {
        ServicosStore.init().then(function() {
            servicosCarregados = true;
            renderizarTabela();
        }).catch(function(err) {
            console.error('Erro ao carregar servicos:', err);
            renderizarTabela();
        });
    }
    
    /* -------------------------------------------------------------------------
       Renderização da Tabela
       --------------------------------------------------------------------- */
    function renderizarTabela() {
        var servicos = ServicosStore.getAll();
        var tbody = document.getElementById('tabela-corpo');
        var html = '';
        
        servicos.forEach(function(s) {
            html += '<tr>' +
                     '<td><span class="categoria-tag">' + s.categoria + '</span><br>' + s.nome +
                     (s.desconto ? '<br><span class="desconto">' + s.desconto + '</span>' : '') +
                     '</td>' +
                     '<td class="preco">R$ ' + s.preco.toFixed(2).replace('.', ',') + '</td>' +
                     '<td><button class="btn-agendar-servico" onclick="ServicosPagina.agendarServico(\'' + s.id + '\')">Agendar</button></td>' +
                     '</tr>';
        });
        
        tbody.innerHTML = html;
    }
    
    /* -------------------------------------------------------------------------
       Agendar Serviço
       --------------------------------------------------------------------- */
    function agendarServico(servicoId) {
        var hoje = new Date();
        var dataStr = hoje.toISOString().split('T')[0];
        window.location.href = 'agenda.html?servico=' + encodeURIComponent(servicoId) + '&data=' + dataStr;
    }
    
    /* -------------------------------------------------------------------------
       API Pública
       --------------------------------------------------------------------- */
    return {
        init: init,
        agendarServico: agendarServico
    };
    
})();

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('tabela-corpo')) {
        ServicosPagina.init();
    }
});
