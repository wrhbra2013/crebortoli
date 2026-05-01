const API_CONFIG = {
    baseUrl: window.API_BASE_URL || 'https://api.crebortoli.com.br/crebortoli',
    project: window.API_PROJECT || 'crebortoli',
    token: window.API_TOKEN || 'crebortoli-api-token-2024'
};

const generateId = (prefix) => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const apiRequest = async (endpoint, options = {}) => {
    const url = new URL(API_CONFIG.baseUrl + endpoint);
    if (options.params) {
        Object.entries(options.params).forEach(([k, v]) => url.searchParams.set(k, v));
    }
    const fetchOptions = {
        method: options.method || 'GET',
        headers: {
            'Authorization': `Bearer ${API_CONFIG.token}`,
            'Content-Type': 'application/json',
            ...options.headers
        }
    };
    if (API_CONFIG.writeKey && ['POST', 'PUT', 'DELETE'].includes(options.method || 'GET')) {
        fetchOptions.headers['X-Write-Key'] = API_CONFIG.writeKey;
    }
    if (options.body) {
        fetchOptions.body = options.body;
    }
    try {
        const res = await fetch(url.toString(), fetchOptions);
        return await res.json();
    } catch (e) {
        console.error(`API request failed: ${endpoint}`, e);
        return null;
    }
};

const DataSync = {
    _cachedData: {},
    _loaded: false,
    
    async fetchFromAPI(entity) {
        try {
            const url = `${API_CONFIG.baseUrl}/data/${entity}`;
            console.log('[API] Fetching', entity, 'from', url);
            const result = await apiRequest(`/data/${entity}`, {
                method: 'GET'
            });
            console.log('[API] Result for', entity, ':', result?.length || 0, 'rows');
            return Array.isArray(result) ? result : (result?.data || []);
        } catch (e) {
            console.error(`Erro ao buscar ${entity} da API:`, e);
            return [];
        }
    },
    
    async saveToAPI(entity, item) {
        try {
            const cleanItem = { ...item };
            delete cleanItem._entity;
            
            const body = {
                project: API_CONFIG.project,
                table: entity,
                data: cleanItem
            };
            console.log('[API] Saving to', entity, ':', JSON.stringify(cleanItem).substring(0, 200));
            const result = await apiRequest('/create', {
                method: 'POST',
                body: JSON.stringify(body)
            });
            console.log('[API] Save result:', result);
            return result?.success ? result.data : null;
        } catch (e) {
            console.error(`Erro ao salvar ${entity} na API:`, e);
            return null;
        }
    },
    
    async updateToAPI(entity, id, data) {
        try {
            const cleanData = { ...data };
            delete cleanData._entity;
            
            const body = {
                project: API_CONFIG.project,
                table: entity,
                id: id,
                data: cleanData
            };
            console.log('[API] Updating', entity, id, ':', JSON.stringify(cleanData).substring(0, 200));
            const result = await apiRequest('/update', {
                method: 'POST',
                body: JSON.stringify(body)
            });
            console.log('[API] Update result:', result);
            return result?.success ? result.data : null;
        } catch (e) {
            console.error(`Erro ao atualizar ${entity} na API:`, e);
            return null;
        }
    },
    
    async deleteToAPI(entity, id) {
        try {
            const result = await apiRequest('/delete', {
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
        
        if (!this._cachedData[entity]) {
            this._cachedData[entity] = [];
        }
        this._cachedData[entity].unshift(item);
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
    window.hasWriteAccess = !!API_CONFIG.writeKey;
}

DataSync.loadAll();
