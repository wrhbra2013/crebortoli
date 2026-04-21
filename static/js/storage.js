const STORAGE_KEY = 'crebortoli_data';

const API_CONFIG = {
    baseUrl: window.API_BASE || 'http://201.54.22.122/crebortoli',
    project: window.API_PROJECT || 'crebortoli',
    token: window.API_TOKEN || 'crebortoli-api-token-2024'
};

const getDefaultData = async () => {
    const defaultData = {
        agendamentos: [],
        servicos: [],
        clientes: [],
        receitas: [],
        contatos: [],
        usuarios: [],
        sessoes: [],
        _updated: Date.now()
    };
    
    try {
        const response = await fetch('../servicos.json');
        const servicosData = await response.json();
        if (servicosData.servicos && servicosData.servicos.length > 0) {
            defaultData.servicos = servicosData.servicos;
            console.log('Carregados serviços do arquivo JSON:', servicosData.servicos.length);
        }
    } catch (e) {
        console.log('Arquivo servicos.json não encontrado, usando dados vazios');
    }
    
    return defaultData;
};

const getLocalData = async () => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
            return JSON.parse(data);
        }
    } catch (e) {}
    return await getDefaultData();
};

const saveLocalData = (data) => {
    try {
        data._updated = Date.now();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.error('Erro ao salvar no localStorage:', e);
    }
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
    storageKey: STORAGE_KEY,
    isLoaded: false,
    _online: false,
    _cachedData: null,
    
    async fetchFromAPI(entity) {
        try {
            const result = await apiRequest('/api/read', {
                method: 'POST',
                body: JSON.stringify({
                    project: API_CONFIG.project,
                    table: entity,
                    order_by: 'created_at',
                    order_dir: 'DESC',
                    limit: 1000
                })
            });
            return result.data || [];
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
    
    async checkConnection() {
        try {
            const result = await apiRequest('/health');
            this._online = result.status === 'ok';
            return this._online;
        } catch (e) {
            this._online = false;
            return false;
        }
    },
    
    async getLocalData() {
        if (this._cachedData) {
            return this._cachedData;
        }
        this._cachedData = await getLocalData();
        return this._cachedData;
    },
    
    saveLocalData(data) {
        this._cachedData = data;
        saveLocalData(data);
    },
    
    async sync() {
        const isOnline = await this.checkConnection();
        
        if (isOnline) {
            const entities = ['agendamentos', 'servicos', 'clientes', 'contatos'];
            const data = {};
            
            for (const entity of entities) {
                data[entity] = await this.fetchFromAPI(entity);
            }
            
            this._cachedData = data;
            saveLocalData(data);
            console.log('Dados sincronizados do PostgreSQL:', data);
        } else {
            console.log('API offline, usando localStorage');
            this._cachedData = await getLocalData();
        }
        
        this.isLoaded = true;
        return this._cachedData;
    },
    
    async save(item) {
        const entity = item._entity || 'agendamentos';
        
        if (!item.id) {
            item.id = generateId(entity);
        }
        if (!item.created_at) {
            item.created_at = new Date().toISOString();
        }
        
        this._online = this._online || await this.checkConnection();
        
        if (this._online) {
            const saved = await this.saveToAPI(entity, item);
            if (saved) {
                const fullData = await this.getLocalData();
                const items = fullData[entity] || [];
                const idx = items.findIndex(i => i.id === item.id);
                if (idx >= 0) {
                    items[idx] = saved;
                } else {
                    items.unshift(saved);
                }
                fullData[entity] = items;
                this.saveLocalData(fullData);
                return saved;
            }
        }
        
        const fullData = await this.getLocalData();
        const items = fullData[entity] || [];
        const idx = items.findIndex(i => i.id === item.id);
        if (idx >= 0) {
            items[idx] = { ...items[idx], ...item };
        } else {
            items.push(item);
        }
        fullData[entity] = items;
        this.saveLocalData(fullData);
        return item;
    },
    
    async delete(item) {
        const entity = item._entity || 'agendamentos';
        
        if (this._online) {
            await this.deleteToAPI(entity, item.id);
        }
        
        const fullData = await this.getLocalData();
        const items = (fullData[entity] || []).filter(i => i.id !== item.id);
        fullData[entity] = items;
        this.saveLocalData(fullData);
    },
    
    async update(id, dados, entity) {
        if (this._online) {
            await this.updateToAPI(entity, id, dados);
        }
        
        const fullData = await this.getLocalData();
        const items = fullData[entity] || [];
        const idx = items.findIndex(item => item.id === id);
        
        if (idx >= 0) {
            items[idx] = { ...items[idx], ...dados, updated_at: new Date().toISOString() };
            fullData[entity] = items;
            this.saveLocalData(fullData);
            return items[idx];
        }
        return null;
    },
    
    async getById(entity, id) {
        const fullData = await this.getLocalData();
        return (fullData[entity] || []).find(item => item.id === id);
    },
    
    async search(entity, term) {
        const fullData = await this.getLocalData();
        const items = fullData[entity] || [];
        const lower = term.toLowerCase();
        return items.filter(item => 
            Object.values(item).some(val => 
                typeof val === 'string' && val.toLowerCase().includes(lower)
            )
        );
    },
    
    async getByField(entity, field, value) {
        const fullData = await this.getLocalData();
        return (fullData[entity] || []).filter(item => item[field] === value);
    },
    
    clear() {
        localStorage.removeItem(STORAGE_KEY);
        this._cachedData = null;
    },
    
    async export() {
        const data = await this.getLocalData();
        return JSON.stringify(data, null, 2);
    },
    
    import(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            this.saveLocalData(data);
            return true;
        } catch (e) {
            console.error('Erro ao importar dados:', e);
            return false;
        }
    }
};

function createEntityStore(entityName) {
    return {
        async init() {
            await DataSync.sync();
            return this;
        },
        
        async getAll() {
            const data = await DataSync.getLocalData();
            return data[entityName] || [];
        },
        
        async save(item) {
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
    load(key) {
        try {
            return JSON.parse(localStorage.getItem(key));
        } catch {
            return null;
        }
    },
    save(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }
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
    window.STORAGE_KEY = STORAGE_KEY;
    window.API_CONFIG = API_CONFIG;
    
    DataSync.sync();
}