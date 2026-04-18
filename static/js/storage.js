const API_URL = localStorage.getItem('api_url') || '/api';
const API_PROJECT = 'crebortoli';

const getAuthHeaders = () => {
    const token = localStorage.getItem('api_token') || sessionStorage.getItem('sig_api_token');
    if (!token) {
        console.warn('Token não configurado. Configure via: localStorage.setItem("api_token", "seu-token")');
    }
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
};

const isAuthenticated = () => {
    return !!(localStorage.getItem('api_token') || sessionStorage.getItem('sig_api_token'));
};

const DataSync = {
    storageKey: 'crebortoli_data',
    isLoaded: false,
    _online: true,
    
    getLocalData() {
        const data = localStorage.getItem(this.storageKey);
        return data ? JSON.parse(data) : {
            agendamentos: [],
            servicos: [],
            clientes: [],
            receitas: [],
            contatos: []
        };
    },
    
    saveLocalData(data) {
        data._updated = Date.now();
        localStorage.setItem(this.storageKey, JSON.stringify(data));
    },
    
    async fetchFromServer() {
        if (!isAuthenticated()) {
            console.warn('API não configurada. Configure via login ou localStorage.setItem("api_token", "token")');
            return {};
        }
        
        const apiUrl = API_URL || '';
        if (!apiUrl) {
            console.warn('API URL não configurada. Configure via localStorage.setItem("api_url", "http://servidor:3000")');
            return {};
        }
        
        const tables = ['agendamentos', 'servicos', 'clientes', 'receitas', 'contatos'];
        const data = {};
        
        for (const table of tables) {
            try {
                const response = await fetch(`${API_URL}/read`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ project: API_PROJECT, table, limit: 1000 })
                });
                if (response.ok) {
                    const result = await response.json();
                    data[table] = result.data || [];
                } else {
                    data[table] = [];
                }
            } catch (e) {
                console.warn(`Erro ao carregar ${table}:`, e);
                data[table] = [];
            }
        }
        
        return data;
    },
    
    async sync() {
        const serverData = await this.fetchFromServer();
        const localData = this.getLocalData();
        
        const merged = this.mergeData(localData, serverData);
        this.saveLocalData(merged);
        this.isLoaded = true;
        
        console.log('Sincronizado com servidor Node API:', {
            agendamentos: merged.agendamentos?.length || 0,
            servicos: merged.servicos?.length || 0,
            clientes: merged.clientes?.length || 0,
            receitas: merged.receitas?.length || 0,
            contatos: merged.contatos?.length || 0
        });
        
        return merged;
    },
    
    mergeData(local, server) {
        const mergeArrays = (localArr, serverArr, key = 'id') => {
            const map = new Map();
            (localArr || []).forEach(item => map.set(item[key], item));
            (serverArr || []).forEach(item => map.set(item[key], item));
            return Array.from(map.values());
        };
        
        return {
            agendamentos: mergeArrays(local.agendamentos, server.agendamentos),
            servicos: mergeArrays(local.servicos, server.servicos),
            clientes: mergeArrays(local.clientes, server.clientes),
            receitas: mergeArrays(local.receitas, server.receitas),
            contatos: mergeArrays(local.contatos, server.contatos)
        };
    },
    
    getTimestamp() {
        const data = this.getLocalData();
        return data._updated || 0;
    },
    
    async save(item) {
        const fullData = this.getLocalData();
        const entity = item._entity || 'agendamentos';
        const items = fullData[entity] || [];
        item.id = item.id || entity + '_' + Date.now();
        item.created_at = item.created_at || new Date().toISOString();
        
        try {
            const response = await fetch(`${API_URL}/create`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ project: API_PROJECT, table: entity, data: item })
            });
            if (response.ok) {
                const result = await response.json();
                if (result.data?.id) {
                    item.id = result.data.id;
                }
            }
        } catch (e) {
            console.warn('Erro ao salvar no servidor, salvando localmente:', e);
        }
        
        const idx = items.findIndex(i => i.id === item.id);
        if (idx >= 0) {
            items[idx] = item;
        } else {
            items.push(item);
        }
        fullData[entity] = items;
        this.saveLocalData(fullData);
        return item;
    },
    
    async delete(item) {
        const fullData = this.getLocalData();
        const entity = item._entity || 'agendamentos';
        const items = (fullData[entity] || []).filter(i => i.id !== item.id);
        
        try {
            await fetch(`${API_URL}/delete`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ project: API_PROJECT, table: entity, id: item.id })
            });
        } catch (e) {
            console.warn('Erro ao excluir do servidor:', e);
        }
        
        fullData[entity] = items;
        this.saveLocalData(fullData);
    },
    
    async update(id, dados, entity) {
        const fullData = this.getLocalData();
        const items = fullData[entity] || [];
        const idx = items.findIndex(item => item.id === id);
        
        if (idx >= 0) {
            items[idx] = { ...items[idx], ...dados, updated_at: new Date().toISOString() };
            fullData[entity] = items;
            
            try {
                await fetch(`${API_URL}/update`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ project: API_PROJECT, table: entity, id, data: items[idx] })
                });
            } catch (e) {
                console.warn('Erro ao atualizar no servidor:', e);
            }
            
            this.saveLocalData(fullData);
            return items[idx];
        }
        return null;
    }
};

function createEntityStore(entityName) {
    return {
        _data: null,
        
        async init() {
            return this;
        },
        
        async getAll() {
            if (this._data) return this._data;
            return DataSync.getLocalData()[entityName] || [];
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
        
        getById(id) {
            const items = DataSync.getLocalData()[entityName] || [];
            return items.find(item => item.id === id);
        },
        
        search(term) {
            const items = DataSync.getLocalData()[entityName] || [];
            const lower = term.toLowerCase();
            return items.filter(item => 
                Object.values(item).some(val => 
                    typeof val === 'string' && val.toLowerCase().includes(lower)
                )
            );
        },
        
        getByField(field, value) {
            const items = DataSync.getLocalData()[entityName] || [];
            return items.filter(item => item[field] === value);
        }
    };
}

const AgendamentosStore = createEntityStore('agendamentos');
const ServicosStore = createEntityStore('servicos');
const ClientesStore = createEntityStore('clientes');
const ReceitasStore = createEntityStore('receitas');
const ContatosStore = createEntityStore('contatos');

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
    
    DataSync.sync();
}
