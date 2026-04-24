const API_CONFIG = {
    baseUrl: window.API_BASE || 'http://201.54.22.122/crebortoli',
    project: window.API_PROJECT || 'crebortoli',
    token: window.API_TOKEN || 'crebortoli-api-token-2024'
};

const generateId = (prefix) => {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const apiRequest = async (endpoint, options = {}) => {
    const res = await fetch(`${API_CONFIG.baseUrl}${endpoint}`, {
        ...options,
        headers: {
            'Authorization': `Bearer ${API_CONFIG.token}`,
            'Content-Type': 'application/json',
            ...options.headers
        }
    });
    return res.json();
};

const DataSync = {
    _cachedData: {},
    _loaded: false,
    
    async fetchFromAPI(entity) {
        try {
            const result = await apiRequest('/data/' + entity);
            return result || [];
        } catch (e) {
            console.error(`Erro ao buscar ${entity} da API:`, e);
            return [];
        }
    },
    
    async saveToAPI(entity, item) {
        try {
            const result = await apiRequest('/api/create', {
                method: 'POST',
                body: JSON.stringify({
                    project: API_CONFIG.project,
                    table: entity,
                    data: item
                })
            });
            return result.success ? result.data : null;
        } catch (e) {
            console.error(`Erro ao salvar ${entity} na API:`, e);
            return null;
        }
    },
    
    async updateToAPI(entity, id, data) {
        try {
            const result = await apiRequest('/api/update', {
                method: 'POST',
                body: JSON.stringify({
                    project: API_CONFIG.project,
                    table: entity,
                    id: id,
                    data: data
                })
            });
            return result.success ? result.data : null;
        } catch (e) {
            console.error(`Erro ao atualizar ${entity} na API:`, e);
            return null;
        }
    },
    
    async deleteToAPI(entity, id) {
        try {
            const result = await apiRequest('/api/delete', {
                method: 'POST',
                body: JSON.stringify({
                    project: API_CONFIG.project,
                    table: entity,
                    id: id
                })
            });
            return result.success;
        } catch (e) {
            console.error(`Erro ao excluir ${entity} da API:`, e);
            return false;
        }
    },
    
    async loadAll() {
        const entities = ['agendamentos', 'servicos', 'clientes', 'contatos', 'receitas'];
        
        for (const entity of entities) {
            this._cachedData[entity] = await this.fetchFromAPI(entity);
        }
        
        this._loaded = true;
        console.log('Dados carregados da API:', this._cachedData);
        return this._cachedData;
    },
    
    async getAll(entity) {
        if (!this._loaded) {
            await this.loadAll();
        }
        return this._cachedData[entity] || [];
    },
    
    async save(item) {
        const entity = item._entity || 'agendamentos';
        
        if (!item.id) {
            item.id = generateId(entity);
        }
        if (!item.created_at) {
            item.created_at = new Date().toISOString();
        }
        
        const saved = await this.saveToAPI(entity, item);
        if (saved) {
            if (!this._cachedData[entity]) {
                this._cachedData[entity] = [];
            }
            this._cachedData[entity].unshift(saved);
            return saved;
        }
        
        return item;
    },
    
    async delete(item) {
        const entity = item._entity || 'agendamentos';
        await this.deleteToAPI(entity, item.id);
        
        if (this._cachedData[entity]) {
            this._cachedData[entity] = this._cachedData[entity].filter(i => i.id !== item.id);
        }
    },
    
    async update(id, dados, entity) {
        await this.updateToAPI(entity, id, dados);
        
        if (this._cachedData[entity]) {
            const idx = this._cachedData[entity].findIndex(item => item.id === id);
            if (idx >= 0) {
                this._cachedData[entity][idx] = { ...this._cachedData[entity][idx], ...dados, updated_at: new Date().toISOString() };
                return this._cachedData[entity][idx];
            }
        }
        return null;
    },
    
    async getById(entity, id) {
        if (!this._loaded) {
            await this.loadAll();
        }
        return (this._cachedData[entity] || []).find(item => item.id === id);
    },
    
    async search(entity, term) {
        if (!this._loaded) {
            await this.loadAll();
        }
        const items = this._cachedData[entity] || [];
        const lower = term.toLowerCase();
        return items.filter(item => 
            Object.values(item).some(val => 
                typeof val === 'string' && val.toLowerCase().includes(lower)
            )
        );
    },
    
    async getByField(entity, field, value) {
        if (!this._loaded) {
            await this.loadAll();
        }
        return (this._cachedData[entity] || []).filter(item => item[field] === value);
    },
    
    async refresh() {
        this._cachedData = {};
        this._loaded = false;
        return await this.loadAll();
    }
};

function createEntityStore(entityName) {
    return {
        async init() {
            await DataSync.loadAll();
            return this;
        },
        
        async getAll() {
            return await DataSync.getAll(entityName);
        },
        
        async save(item) {
            item._entity = entityName;
            return await DataSync.save(item);
        },
        
        async create(item) {
            item._entity = entityName;
            return await DataSync.save(item);
        },
        
        async update(id, dados) {
            return await DataSync.update(id, dados, entityName);
        },
        
        async delete(id) {
            await DataSync.delete({ id, _entity: entityName });
        },
        
        async getById(id) {
            return await DataSync.getById(entityName, id);
        },
        
        async search(term) {
            return await DataSync.search(entityName, term);
        },
        
        async getByField(field, value) {
            return await DataSync.getByField(entityName, field, value);
        }
    };
}

const AgendamentosStore = createEntityStore('agendamentos');
const ServicosStore = createEntityStore('servicos');
const ClientesStore = createEntityStore('clientes');
const ReceitasStore = createEntityStore('receitas');
const ContatosStore = createEntityStore('contatos');
const UsuariosStore = createEntityStore('usuarios');

const AgendamentoStore = AgendamentosStore;

const DataStore = {
    load(key) { return null; },
    save(key, value) { }
};

if (typeof window !== 'undefined') {
    window.DataSync = DataSync;
    window.DataStore = DataStore;
    window.AgendamentosStore = AgendamentosStore;
    window.AgendamentoStore = AgendamentoStore;
    window.ServicosStore = ServicosStore;
    window.ClientesStore = ClientesStore;
    window.ReceitasStore = ReceitasStore;
    window.ContatosStore = ContatosStore;
    window.UsuariosStore = UsuariosStore;
    window.API_CONFIG = API_CONFIG;
}

DataSync.loadAll();
