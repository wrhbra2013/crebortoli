/**
 * Sistema de Persistência de Dados com LocalStorage + JSON
 */

const DataStore = {
    PREFIX: 'crebortoli_',

    save(key, data) {
        try {
            const fullKey = this.PREFIX + key;
            const jsonData = JSON.stringify(data);
            localStorage.setItem(fullKey, jsonData);
            return true;
        } catch (e) {
            console.error('Erro ao salvar dados:', e);
            return false;
        }
    },

    load(key) {
        try {
            const fullKey = this.PREFIX + key;
            const jsonData = localStorage.getItem(fullKey);
            return jsonData ? JSON.parse(jsonData) : null;
        } catch (e) {
            console.error('Erro ao carregar dados:', e);
            return null;
        }
    },

    remove(key) {
        try {
            const fullKey = this.PREFIX + key;
            localStorage.removeItem(fullKey);
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
