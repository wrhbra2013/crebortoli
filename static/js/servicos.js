/* =============================================================================
   JavaScript da Página de Serviços/Tabela de Preços
   ============================================================================= */

var ServicosPagina = (function() {
    'use strict';
    
    var servicosCarregados = false;
    
    /* -------------------------------------------------------------------------
        Inicialização
        --------------------------------------------------------------------- */
    async function init() {
        await ServicosStore.init();
        var servicos = await ServicosStore.getAll();
        servicosCarregados = true;
        renderizarTabela(servicos);
    }
    
    /* -------------------------------------------------------------------------
        Renderização da Tabela
        --------------------------------------------------------------------- */
    function renderizarTabela(servicos) {
        var tbody = document.getElementById('tabela-corpo');
        var html = '';
        
        servicos.forEach(function(s) {
            var precoNum = parseFloat(s.preco) || 0;
            html += '<tr>' +
                     '<td><span class="categoria-tag">' + s.categoria + '</span><br>' + s.nome +
                     (s.desconto ? '<br><span class="desconto">' + s.desconto + '</span>' : '') +
                     '</td>' +
                     '<td class="preco">R$ ' + precoNum.toFixed(2).replace('.', ',') + '</td>' +
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
