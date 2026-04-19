const STORAGE_KEY = 'crebortoli_data';

const getDefaultData = () => ({
    agendamentos: [],
    servicos: [],
    clientes: [],
    receitas: [],
    contatos: [],
    usuarios: [],
    sessoes: [],
    _updated: Date.now()
});

const getLocalData = () => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : getDefaultData();
    } catch (e) {
        console.error('Erro ao carregar dados:', e);
        return getDefaultData();
    }
};

const saveLocalData = (data) => {
    try {
        data._updated = Date.now();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.error('Erro ao salvar dados:', e);
    }
};

const generateId = (prefix) => {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const DataSync = {
    storageKey: STORAGE_KEY,
    isLoaded: true,
    _online: false,
    
    getLocalData,
    
    saveLocalData,
    
    async sync() {
        const data = getLocalData();
        this.isLoaded = true;
        console.log('Dados carregados do localStorage:', {
            agendamentos: data.agendamentos?.length || 0,
            servicos: data.servicos?.length || 0,
            clientes: data.clientes?.length || 0,
            receitas: data.receitas?.length || 0,
            contatos: data.contatos?.length || 0
        });
        return data;
    },
    
    async save(item) {
        const fullData = getLocalData();
        const entity = item._entity || 'agendamentos';
        const items = fullData[entity] || [];
        
        if (!item.id) {
            item.id = generateId(entity);
        }
        if (!item.created_at) {
            item.created_at = new Date().toISOString();
        }
        
        const idx = items.findIndex(i => i.id === item.id);
        if (idx >= 0) {
            items[idx] = { ...items[idx], ...item };
        } else {
            items.push(item);
        }
        
        fullData[entity] = items;
        saveLocalData(fullData);
        return item;
    },
    
    async delete(item) {
        const fullData = getLocalData();
        const entity = item._entity || 'agendamentos';
        const items = (fullData[entity] || []).filter(i => i.id !== item.id);
        fullData[entity] = items;
        saveLocalData(fullData);
    },
    
    async update(id, dados, entity) {
        const fullData = getLocalData();
        const items = fullData[entity] || [];
        const idx = items.findIndex(item => item.id === id);
        
        if (idx >= 0) {
            items[idx] = { ...items[idx], ...dados, updated_at: new Date().toISOString() };
            fullData[entity] = items;
            saveLocalData(fullData);
            return items[idx];
        }
        return null;
    },
    
    getById(entity, id) {
        const fullData = getLocalData();
        return (fullData[entity] || []).find(item => item.id === id);
    },
    
    search(entity, term) {
        const fullData = getLocalData();
        const items = fullData[entity] || [];
        const lower = term.toLowerCase();
        return items.filter(item => 
            Object.values(item).some(val => 
                typeof val === 'string' && val.toLowerCase().includes(lower)
            )
        );
    },
    
    getByField(entity, field, value) {
        const fullData = getLocalData();
        return (fullData[entity] || []).filter(item => item[field] === value);
    },
    
    clear() {
        localStorage.removeItem(STORAGE_KEY);
    },
    
    export() {
        return JSON.stringify(getLocalData(), null, 2);
    },
    
    import(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            saveLocalData(data);
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
            return this;
        },
        
        async getAll() {
            return getLocalData()[entityName] || [];
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
            return DataSync.getById(entityName, id);
        },
        
        search(term) {
            return DataSync.search(entityName, term);
        },
        
        getByField(field, value) {
            return DataSync.getByField(entityName, field, value);
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
    
    DataSync.sync();
}