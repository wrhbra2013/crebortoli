/**
 * Sistema de Persistência com LocalStorage + API PHP/SQLite
 * Sincroniza dados entre navegador e servidor
 */

const DataSync = {
    apiUrl: '/api.php',
    storageKey: 'crebortoli_data',
    lastSync: 0,
    
    getLocalData() {
        const data = localStorage.getItem(this.storageKey);
        return data ? JSON.parse(data) : {
            agendamentos: [],
            servicos: [],
            clientes: [],
            receitas: []
        };
    },
    
    saveLocalData(data) {
        data._updated = Date.now();
        localStorage.setItem(this.storageKey, JSON.stringify(data));
    },
    
    async fetchFromServer() {
        try {
            const response = await fetch(this.apiUrl + '?t=' + Date.now());
            if (!response.ok) return null;
            return await response.json();
        } catch (e) {
            console.warn('Erro ao buscar do servidor:', e);
            return null;
        }
    },
    
    async pushToServer(data) {
        try {
            await fetch(this.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } catch (e) {
            console.warn('Erro ao enviar para servidor:', e);
        }
    },
    
    async sync() {
        const serverData = await this.fetchFromServer();
        const localData = this.getLocalData();
        
        if (!serverData) {
            console.log('Servidor indisponível, usando dados locais');
            return localData;
        }
        
        const merged = this.mergeData(localData, serverData);
        this.saveLocalData(merged);
        
        console.log('Sincronizado:', {
            agendamentos: merged.agendamentos?.length || 0,
            servicos: merged.servicos?.length || 0,
            clientes: merged.clientes?.length || 0
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
            receitas: mergeArrays(local.receitas, server.receitas)
        };
    },
    
    getTimestamp() {
        const data = this.getLocalData();
        return data._updated || 0;
    }
};

function createEntityStore(entityName) {
    return {
        async init() {
            if (entityName === 'servicos') {
                try {
                    const response = await fetch('servicos.json');
                    const data = await response.json();
                    this._data = data.servicos || [];
                } catch (e) {
                    console.warn('Erro ao carregar servicos.json, usando cache local:', e);
                    this._data = DataSync.getLocalData().servicos || [];
                }
            }
            return this;
        },
        
        getAll() {
            if (this._data) return this._data;
            return DataSync.getLocalData()[entityName] || [];
        },
        
        save(item) {
            const fullData = DataSync.getLocalData();
            const items = fullData[entityName] || [];
            item.id = item.id || entityName + '_' + Date.now();
            item.created_at = item.created_at || new Date().toISOString();
            items.push(item);
            fullData[entityName] = items;
            this._data = items;
            DataSync.saveLocalData(fullData);
            DataSync.pushToServer(fullData);
            return item;
        },
        
        update(id, dados) {
            const fullData = DataSync.getLocalData();
            const items = fullData[entityName] || [];
            const idx = items.findIndex(item => item.id === id);
            if (idx >= 0) {
                items[idx] = { ...items[idx], ...dados, updated_at: new Date().toISOString() };
                fullData[entityName] = items;
                this._data = items;
                DataSync.saveLocalData(fullData);
                DataSync.pushToServer(fullData);
                return items[idx];
            }
            return null;
        },
        
        delete(id) {
            const fullData = DataSync.getLocalData();
            const items = (fullData[entityName] || []).filter(item => item.id !== id);
            fullData[entityName] = items;
            this._data = items;
            DataSync.saveLocalData(fullData);
            DataSync.pushToServer(fullData);
        },
        
        getById(id) {
            return this.getAll().find(item => item.id === id);
        },
        
        search(term) {
            const lower = term.toLowerCase();
            return this.getAll().filter(item => 
                Object.values(item).some(val => 
                    typeof val === 'string' && val.toLowerCase().includes(lower)
                )
            );
        },
        
        getByField(field, value) {
            return this.getAll().filter(item => item[field] === value);
        }
    };
}

const AgendamentosStore = createEntityStore('agendamentos');
const ServicosStore = createEntityStore('servicos');
const ClientesStore = createEntityStore('clientes');
const ReceitasStore = createEntityStore('receitas');

const AgendamentoStore = AgendamentosStore;

if (typeof window !== 'undefined') {
    window.DataSync = DataSync;
    window.AgendamentosStore = AgendamentosStore;
    window.AgendamentoStore = AgendamentoStore;
    window.ServicosStore = ServicosStore;
    window.ClientesStore = ClientesStore;
    window.ReceitasStore = ReceitasStore;
    
    DataSync.sync();
}
