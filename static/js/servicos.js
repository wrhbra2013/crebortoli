/* =============================================================================
   JavaScript da Página de Serviços/Tabela de Preços
   ============================================================================= */

var ServicosPagina = (function() {
    'use strict';
    
    var servicosCarregados = false;
    var servicosFallback = [
        { id: 'dep_perna', nome: 'Depilação Perna', preco: '25', categoria: 'Depilação' },
        { id: 'dep_virilha', nome: 'Depilação Virilha Completa', preco: '50', categoria: 'Depilação' },
        { id: 'dep_buco', nome: 'Depilação Buço', preco: '15', categoria: 'Depilação' },
        { id: 'dep_axilas', nome: 'Depilação Axilas', preco: '20', categoria: 'Depilação' },
        { id: 'dep_pacote', nome: 'Pacote Mensal Depilação', preco: '90', categoria: 'Depilação', desconto: 'De R$110 por R$90' },
        { id: 'barreira_cutanea', nome: 'Reparação de Barreira Cutânea', preco: '50', categoria: 'Tratamento' },
        { id: 'limpeza_pele', nome: 'Limpeza de Pele', preco: '100', categoria: 'Tratamento' },
        { id: 'massagem', nome: 'Massagem Relaxante', preco: '50', categoria: 'Massagem' }
    ];

    var API_CONFIG = {
        baseUrl: window.API_BASE_URL || 'http://201.54.22.122/crebortoli'
    };

    async function fetchFromAPI() {
        var url = new URL(API_CONFIG.baseUrl + '/data/servicos');
        var res = await fetch(url.toString(), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        var result = await res.json();
        return result?.data || result || [];
    }
    
    async function init() {
        try {
            var dados = await fetchFromAPI();
            if (dados && dados.length > 0) {
                servicosCarregados = true;
                renderizarTabela(dados);
                return;
            }
        } catch (e) {
            console.log('API não disponível:', e.message);
        }
        
        console.log('Usando dados locais (fallback)');
        renderizarTabela(servicosFallback);
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
