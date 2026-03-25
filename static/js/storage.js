/**
 * Sistema de Persistência de Dados com LocalStorage
 */

const DataStore = {
    PREFIX: 'crebortoli_',
    STORAGE_TYPE: 'localStorage',

    save(key, data) {
        try {
            const fullKey = this.PREFIX + key;
            const jsonData = JSON.stringify(data);
            if (this.STORAGE_TYPE === 'localStorage') {
                localStorage.setItem(fullKey, jsonData);
            } else {
                sessionStorage.setItem(fullKey, jsonData);
            }
            this.backupToJson(data, key);
            return true;
        } catch (e) {
            console.error('Erro ao salvar dados:', e);
            return false;
        }
    },

    load(key) {
        try {
            const fullKey = this.PREFIX + key;
            let jsonData = null;
            if (this.STORAGE_TYPE === 'localStorage') {
                jsonData = localStorage.getItem(fullKey);
            }
            if (!jsonData) {
                jsonData = sessionStorage.getItem(fullKey);
            }
            if (!jsonData) {
                const backupData = this.loadFromBackup(key);
                if (backupData) {
                    this.save(key, backupData);
                    return backupData;
                }
            }
            return jsonData ? JSON.parse(jsonData) : null;
        } catch (e) {
            console.error('Erro ao carregar dados:', e);
            return null;
        }
    },

    backupToJson(data, key) {
        try {
            const backups = JSON.parse(localStorage.getItem('crebortoli_backups') || '{}');
            backups[key] = data;
            backups[key + '_updated'] = Date.now();
            localStorage.setItem('crebortoli_backups', JSON.stringify(backups));
        } catch (e) {
            console.warn('Erro no backup:', e);
        }
    },

    loadFromBackup(key) {
        try {
            const backups = JSON.parse(localStorage.getItem('crebortoli_backups') || '{}');
            return backups[key] || null;
        } catch (e) {
            return null;
        }
    },

    remove(key) {
        try {
            const fullKey = this.PREFIX + key;
            localStorage.removeItem(fullKey);
            sessionStorage.removeItem(fullKey);
            return true;
        } catch (e) {
            console.error('Erro ao remover dados:', e);
            return false;
        }
    },

    clear() {
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(this.PREFIX)) {
                    localStorage.removeItem(key);
                }
            });
            return true;
        } catch (e) {
            console.error('Erro ao limpar dados:', e);
            return false;
        }
    },

    getAllKeys() {
        const keys = Object.keys(localStorage);
        return keys
            .filter(key => key.startsWith(this.PREFIX))
            .map(key => key.replace(this.PREFIX, ''));
    }
};

// Sessão de agendamento (form multi-step)
const AgendaStore = {
    KEY: 'agenda_session',

    saveFormData(data) {
        const existing = this.loadFormData();
        const merged = { ...existing, ...data, timestamp: Date.now() };
        return DataStore.save(this.KEY, merged);
    },

    loadFormData() {
        return DataStore.load(this.KEY) || {};
    },

    clearFormData() {
        return DataStore.remove(this.KEY);
    },

    isExpired(maxAgeMs = 3600000) {
        const data = this.loadFormData();
        if (!data.timestamp) return true;
        return Date.now() - data.timestamp > maxAgeMs;
    }
};

// Dados de clientes (simulação de CRUD)
const ClienteStore = {
    KEY: 'clientes',

    getAll() {
        return DataStore.load(this.KEY) || [];
    },

    save(cliente) {
        const clientes = this.getAll();
        if (cliente.id) {
            const index = clientes.findIndex(c => c.id === cliente.id);
            if (index !== -1) {
                clientes[index] = { ...clientes[index], ...cliente, updatedAt: Date.now() };
            } else {
                clientes.push({ ...cliente, updatedAt: Date.now() });
            }
        } else {
            cliente.id = Date.now().toString();
            cliente.createdAt = Date.now();
            clientes.push(cliente);
        }
        return DataStore.save(this.KEY, clientes);
    },

    delete(id) {
        const clientes = this.getAll().filter(c => c.id !== id);
        return DataStore.save(this.KEY, clientes);
    },

    getById(id) {
        const clientes = this.getAll();
        return clientes.find(c => c.id === id) || null;
    },

    search(term) {
        const clientes = this.getAll();
        const lower = term.toLowerCase();
        return clientes.filter(c => 
            (c.nome && c.nome.toLowerCase().includes(lower)) ||
            (c.telefone && c.telefone.includes(term)) ||
            (c.email && c.email.toLowerCase().includes(lower))
        );
    }
};

// Carrinho/Reservas de serviços
const CarrinhoStore = {
    KEY: 'carrinho',

    getAll() {
        return DataStore.load(this.KEY) || [];
    },

    add(item) {
        const carrinho = this.getAll();
        item.id = Date.now().toString();
        item.adicionadoEm = Date.now();
        carrinho.push(item);
        return DataStore.save(this.KEY, carrinho);
    },

    remove(id) {
        const carrinho = this.getAll().filter(item => item.id !== id);
        return DataStore.save(this.KEY, carrinho);
    },

    clear() {
        return DataStore.remove(this.KEY);
    },

    getTotal() {
        return this.getAll().reduce((sum, item) => sum + (item.valor || 0), 0);
    }
};

// Preferências do usuário
const PreferencesStore = {
    KEY: 'preferences',

    save(prefs) {
        const existing = this.load();
        return DataStore.save(this.KEY, { ...existing, ...prefs });
    },

    load() {
        return DataStore.load(this.KEY) || {
            contraste: false,
            altoContraste: false,
            tamanhoFonte: 'medio'
        };
    },

    toggleContraste() {
        const prefs = this.load();
        prefs.contraste = !prefs.contraste;
        this.save(prefs);
        return prefs.contraste;
    },

    setTamanhoFonte(tamanho) {
        const prefs = this.load();
        prefs.tamanhoFonte = tamanho;
        this.save(prefs);
        return prefs;
    }
};

// Histórico de navegação
const AgendamentoStore = {
    KEY: 'agendamentos',

    getAll() {
        return DataStore.load(this.KEY) || [];
    },

    save(agendamento) {
        const agendamentos = this.getAll();
        agendamento.id = Date.now().toString();
        agendamento.criadoEm = new Date().toISOString();
        agendamento.status = 'PENDENTE';
        agendamentos.push(agendamento);
        DataStore.save(this.KEY, agendamentos);
        return agendamento;
    },

    delete(id) {
        const agendamentos = this.getAll().filter(a => a.id !== id);
        return DataStore.save(this.KEY, agendamentos);
    },

    update(id, dados) {
        const agendamentos = this.getAll();
        const index = agendamentos.findIndex(a => a.id === id);
        if (index !== -1) {
            agendamentos[index] = { ...agendamentos[index], ...dados, atualizadoEm: new Date().toISOString() };
            DataStore.save(this.KEY, agendamentos);
            return agendamentos[index];
        }
        return null;
    },

    getByStatus(status) {
        return this.getAll().filter(a => a.status === status);
    }
};

const SyncService = {
    cache: null,
    
    getJsonUrl() {
        var path = window.location.pathname;
        if (path.indexOf('/paginas/') !== -1 || path.indexOf('/sig/') !== -1) {
            return '../servicos.json';
        }
        return 'servicos.json';
    },
    
    async fetchServicos() {
        try {
            var url = this.getJsonUrl();
            var response = await fetch(url);
            if (!response.ok) throw new Error('HTTP ' + response.status);
            var data = await response.json();
            this.cache = data.servicos;
            console.log('Servicos carregados do JSON:', url, data.servicos);
            return data.servicos;
        } catch (e) {
            console.warn('Erro ao buscar servicos.json:', e);
            return null;
        }
    },
    
    getCached() {
        return this.cache;
    }
};

const ServicosStore = {
    KEY: 'servicos',
    _cachedRemote: null,
    
    async init() {
        const remote = await SyncService.fetchServicos();
        if (remote) {
            this._cachedRemote = remote;
            DataStore.save(this.KEY, remote);
        }
    },
    
    getAll() {
        if (this._cachedRemote && this._cachedRemote.length > 0) {
            DataStore.save(this.KEY, this._cachedRemote);
            return this._cachedRemote;
        }
        const local = DataStore.load(this.KEY);
        if (local && local.length > 0) return local;
        return [
            { id: 'dep_perna', nome: 'Depilação Perna', preco: 25, categoria: 'Depilação' },
            { id: 'dep_virilha', nome: 'Depilação Virilha Completa', preco: 50, categoria: 'Depilação' },
            { id: 'dep_buco', nome: 'Depilação Buço', preco: 15, categoria: 'Depilação' },
            { id: 'dep_axilas', nome: 'Depilação Axilas', preco: 20, categoria: 'Depilação' },
            { id: 'dep_pacote', nome: 'Pacote Mensal Depilação', preco: 90, categoria: 'Depilação', desconto: 'De R$110 por R$90' },
            { id: 'barreira_cutanea', nome: 'Reparação de Barreira Cutânea', preco: 50, categoria: 'Tratamento' },
            { id: 'limpeza_pele', nome: 'Limpeza de Pele', preco: 100, categoria: 'Tratamento' },
            { id: 'massagem', nome: 'Massagem Relaxante', preco: 50, categoria: 'Massagem' }
        ];
    },
    
    getById(id) {
        return this.getAll().find(s => s.id === id);
    },
    
    getByCategoria(categoria) {
        return this.getAll().filter(s => s.categoria === categoria);
    },
    
    saveAll(servicos) {
        DataStore.save(this.KEY, servicos);
    },
    
    add(servico) {
        const servicos = this.getAll();
        servico.id = 'serv_' + Date.now();
        servicos.push(servico);
        this.saveAll(servicos);
    },
    
    update(id, dados) {
        const servicos = this.getAll();
        const index = servicos.findIndex(s => s.id === id);
        if (index !== -1) {
            servicos[index] = { ...servicos[index], ...dados };
            this.saveAll(servicos);
        }
    },
    
    delete(id) {
        const servicos = this.getAll().filter(s => s.id !== id);
        this.saveAll(servicos);
    },
    
    getJsonUrl() {
        return SyncService.getJsonUrl();
    },
    
    refreshFromServer() {
        var self = this;
        return SyncService.fetchServicos().then(function(data) {
            if (data) {
                self._cachedRemote = data;
                DataStore.save(self.KEY, data);
            }
            return data;
        });
    },
    
    exportJson() {
        const servicos = this.getAll();
        const data = { servicos, ultimaAtualizacao: new Date().toISOString().split('T')[0] };
        return JSON.stringify(data, null, 2);
    },
    
    downloadJson() {
        const json = this.exportJson();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'servicos.json';
        a.click();
        URL.revokeObjectURL(url);
    },
    
    importJson(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (data.servicos && Array.isArray(data.servicos)) {
                this.saveAll(data.servicos);
                alert('Importado com sucesso! Baixe o arquivo e atualize no servidor.');
                return true;
            }
        } catch (e) {
            alert('Erro ao importar: ' + e.message);
        }
        return false;
    }
};

const ContatoStore = {
    KEY: 'mensagens',

    getAll() {
        return DataStore.load(this.KEY) || [];
    },

    save(mensagem) {
        const mensagens = this.getAll();
        mensagem.id = Date.now().toString();
        mensagem.criadoEm = new Date().toISOString();
        mensagem.lida = false;
        mensagens.push(mensagem);
        DataStore.save(this.KEY, mensagens);
        return mensagem;
    },

    delete(id) {
        const mensagens = this.getAll().filter(m => m.id !== id);
        return DataStore.save(this.KEY, mensagens);
    },

    markAsRead(id) {
        return this.update(id, { lida: true });
    },

    update(id, dados) {
        const mensagens = this.getAll();
        const index = mensagens.findIndex(m => m.id === id);
        if (index !== -1) {
            mensagens[index] = { ...mensagens[index], ...dados };
            DataStore.save(this.KEY, mensagens);
            return mensagens[index];
        }
        return null;
    },

    getUnreadCount() {
        return this.getAll().filter(m => !m.lida).length;
    }
};

const NavigationStore = {
    KEY: 'navigation_history',
    MAX_ITEMS: 20,

    add(page) {
        let history = DataStore.load(this.KEY) || [];
        history = history.filter(h => h.page !== page);
        history.unshift({ page, timestamp: Date.now() });
        if (history.length > this.MAX_ITEMS) {
            history = history.slice(0, this.MAX_ITEMS);
        }
        return DataStore.save(this.KEY, history);
    },

    getHistory() {
        return DataStore.load(this.KEY) || [];
    },

    clear() {
        return DataStore.remove(this.KEY);
    }
};

// Store Genérico para CRUD
function createStore(name) {
    return {
        KEY: name,
        
        getAll() {
            return DataStore.load(this.KEY) || [];
        },
        
        save(item) {
            const items = this.getAll();
            if (item.id) {
                const index = items.findIndex(i => i.id === item.id);
                if (index !== -1) {
                    items[index] = { ...items[index], ...item, updatedAt: Date.now() };
                } else {
                    items.push({ ...item, updatedAt: Date.now() });
                }
            } else {
                item.id = Date.now().toString();
                item.createdAt = Date.now();
                items.push(item);
            }
            return DataStore.save(this.KEY, items);
        },
        
        delete(id) {
            const items = this.getAll().filter(i => i.id !== id);
            return DataStore.save(this.KEY, items);
        },
        
        getById(id) {
            return this.getAll().find(i => i.id === id) || null;
        }
    };
}

// Stores específicos
const ColaboradorStore = createStore('colaboradores');
const CompraStore = createStore('compras');
const VendaServicoStore = createStore('vendas_servicos');
const VendaProdutoStore = createStore('vendas_produtos');
const InsumoStore = createStore('insumos');
const CustosFixosStore = createStore('custos_fixos');
const RelatorioMeiStore = createStore('relatorios_mei');
const AnamneseStore = createStore('anamnese');

// Sincronização com servidor
const ServerSync = {
    DATA_FILE: 'data.json',
    
    getDataUrl() {
        const path = window.location.pathname;
        if (path.includes('/paginas/') || path.includes('/sig/')) {
            return '../' + this.DATA_FILE;
        }
        return this.DATA_FILE;
    },
    
    async load() {
        try {
            const response = await fetch(this.getDataUrl() + '?t=' + Date.now());
            if (!response.ok) return null;
            const data = await response.json();
            return data;
        } catch (e) {
            console.warn('Não foi possível carregar dados do servidor:', e);
            return null;
        }
    },
    
    async save(data) {
        localStorage.setItem('crebortoli_server_data', JSON.stringify(data));
        console.log('Dados salvos localmente (sync com servidor não disponível)');
    },
    
    init() {
        this.load().then(serverData => {
            if (serverData) {
                Object.keys(serverData).forEach(key => {
                    if (!localStorage.getItem('crebortoli_' + key) || 
                        serverData[key + '_updated'] > this.getLocalUpdateTime(key)) {
                        DataStore.save(key, serverData[key]);
                    }
                });
                console.log('Dados sincronizados do servidor');
            }
        });
    },
    
    getLocalUpdateTime(key) {
        const data = DataStore.load(key);
        return data ? (data._updated || 0) : 0;
    }
};

// Inicializar sincronização se na página de agendamento
if (typeof window !== 'undefined') {
    window.ServerSync = ServerSync;
}

// Sobrescrever AgendamentoStore para sincronizar com servidor
(function() {
    const originalSave = AgendamentoStore.save.bind(AgendamentoStore);
    const originalUpdate = AgendamentoStore.update.bind(AgendamentoStore);
    const originalDelete = AgendamentoStore.delete.bind(AgendamentoStore);
    
    AgendamentoStore.save = function(agendamento) {
        const result = originalSave(agendamento);
        this.syncToServer();
        return result;
    };
    
    AgendamentoStore.update = function(id, dados) {
        const result = originalUpdate(id, dados);
        this.syncToServer();
        return result;
    };
    
    AgendamentoStore.delete = function(id) {
        const result = originalDelete(id);
        this.syncToServer();
        return result;
    };
    
    AgendamentoStore.syncToServer = async function() {
        const data = {
            agendamentos: this.getAll()
        };
        
        try {
            await fetch('../api.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } catch (e) {
            console.warn('Erro ao sincronizar com servidor:', e);
        }
    };
    
    AgendamentoStore.syncFromServer = async function() {
        try {
            const response = await fetch('../api.php?t=' + Date.now());
            if (response.ok) {
                const data = await response.json();
                if (data.agendamentos && data.agendamentos.length > 0) {
                    const local = this.getAll();
                    data.agendamentos.forEach(serv => {
                        if (!local.find(a => a.id === serv.id)) {
                            AgendamentoStore.save(serv);
                        }
                    });
                }
            }
        } catch (e) {
            console.warn('Erro ao buscar do servidor:', e);
        }
    };
})();
