/**
 * Sistema de Persistência com LocalStorage + Sync via Servidor
 * Compartilha dados entre dispositivos via api.php (JSON file)
 */

const DataSync = {
    serverUrl: 'api.php',
    storageKey: 'crebortoli_data',
    lastSync: 0,
    
    getLocalData() {
        const data = localStorage.getItem(this.storageKey);
        return data ? JSON.parse(data) : {
            agendamentos: [],
            servicos: [],
            clientes: []
        };
    },
    
    saveLocalData(data) {
        data._updated = Date.now();
        localStorage.setItem(this.storageKey, JSON.stringify(data));
    },
    
    async fetchFromServer() {
        try {
            const response = await fetch(this.serverUrl + '?t=' + Date.now());
            if (!response.ok) return null;
            return await response.json();
        } catch (e) {
            console.warn('Erro ao buscar do servidor:', e);
            return null;
        }
    },
    
    async pushToServer(data) {
        try {
            await fetch(this.serverUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ full_data: data })
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
        await this.pushToServer(merged);
        
        console.log('Sincronizado:', {
            agendamentos: merged.agendamentos.length,
            servicos: merged.servicos.length,
            clientes: merged.clientes.length
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
            clientes: mergeArrays(local.clientes, server.clientes)
        };
    },
    
    getTimestamp() {
        const data = this.getLocalData();
        return data._updated || 0;
    }
};

const AgendamentosStore = {
    KEY: 'agendamentos',
    
    getAll() {
        return DataSync.getLocalData().agendamentos || [];
    },
    
    save(agendamento) {
        const data = DataSync.getLocalData();
        agendamento.id = agendamento.id || 'ag_' + Date.now();
        agendamento.created_at = agendamento.created_at || new Date().toISOString();
        agendamento.status = agendamento.status || 'pendente';
        data.agendamentos.push(agendamento);
        DataSync.saveLocalData(data);
        DataSync.pushToServer(data);
        return agendamento;
    },
    
    update(id, dados) {
        const data = DataSync.getLocalData();
        const idx = data.agendamentos.findIndex(a => a.id === id);
        if (idx >= 0) {
            data.agendamentos[idx] = { ...data.agendamentos[idx], ...dados, updated_at: new Date().toISOString() };
            DataSync.saveLocalData(data);
            DataSync.pushToServer(data);
            return data.agendamentos[idx];
        }
        return null;
    },
    
    delete(id) {
        const data = DataSync.getLocalData();
        data.agendamentos = data.agendamentos.filter(a => a.id !== id);
        DataSync.saveLocalData(data);
        DataSync.pushToServer(data);
    },
    
    getByStatus(status) {
        return this.getAll().filter(a => a.status === status);
    }
};

const ServicosStore = {
    KEY: 'servicos',
    
    getAll() {
        return DataSync.getLocalData().servicos || [];
    },
    
    save(servico) {
        const data = DataSync.getLocalData();
        servico.id = servico.id || 'srv_' + Date.now();
        data.servicos.push(servico);
        DataSync.saveLocalData(data);
        DataSync.pushToServer(data);
        return servico;
    },
    
    update(id, dados) {
        const data = DataSync.getLocalData();
        const idx = data.servicos.findIndex(s => s.id === id);
        if (idx >= 0) {
            data.servicos[idx] = { ...data.servicos[idx], ...dados };
            DataSync.saveLocalData(data);
            DataSync.pushToServer(data);
            return data.servicos[idx];
        }
        return null;
    },
    
    delete(id) {
        const data = DataSync.getLocalData();
        data.servicos = data.servicos.filter(s => s.id !== id);
        DataSync.saveLocalData(data);
        DataSync.pushToServer(data);
    },
    
    getByCategoria(categoria) {
        return this.getAll().filter(s => s.categoria === categoria);
    }
};

const ClientesStore = {
    KEY: 'clientes',
    
    getAll() {
        return DataSync.getLocalData().clientes || [];
    },
    
    save(cliente) {
        const data = DataSync.getLocalData();
        cliente.id = cliente.id || 'cli_' + Date.now();
        cliente.created_at = cliente.created_at || new Date().toISOString();
        data.clientes.push(cliente);
        DataSync.saveLocalData(data);
        DataSync.pushToServer(data);
        return cliente;
    },
    
    update(id, dados) {
        const data = DataSync.getLocalData();
        const idx = data.clientes.findIndex(c => c.id === id);
        if (idx >= 0) {
            data.clientes[idx] = { ...data.clientes[idx], ...dados };
            DataSync.saveLocalData(data);
            DataSync.pushToServer(data);
            return data.clientes[idx];
        }
        return null;
    },
    
    delete(id) {
        const data = DataSync.getLocalData();
        data.clientes = data.clientes.filter(c => c.id !== id);
        DataSync.saveLocalData(data);
        DataSync.pushToServer(data);
    },
    
    search(term) {
        const lower = term.toLowerCase();
        return this.getAll().filter(c => 
            (c.nome && c.nome.toLowerCase().includes(lower)) ||
            (c.telefone && c.telefone.includes(term))
        );
    }
};

if (typeof window !== 'undefined') {
    window.DataSync = DataSync;
    window.AgendamentosStore = AgendamentosStore;
    window.ServicosStore = ServicosStore;
    window.ClientesStore = ClientesStore;
    
    DataSync.sync();
    setInterval(() => DataSync.sync(), 60000);
}
