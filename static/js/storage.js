/**
 * Sistema de Persistência Local (LocalStorage)
 * Usado para dados temporários do usuário no navegador.
 * Para dados persistentes, use pb-db.js (PocketBase).
 */

const DataStore = {
    storageKey: 'crebortoli_data',
    
    load(key) {
        const data = localStorage.getItem(this.storageKey);
        const parsed = data ? JSON.parse(data) : {};
        return key ? parsed[key] : parsed;
    },
    
    save(key, value) {
        const data = this.load() || {};
        data[key] = value;
        data._updated = Date.now();
        localStorage.setItem(this.storageKey, JSON.stringify(data));
    },
    
    remove(key) {
        const data = this.load() || {};
        delete data[key];
        localStorage.setItem(this.storageKey, JSON.stringify(data));
    },
    
    clear() {
        localStorage.removeItem(this.storageKey);
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
                    this._data = DataStore.load(entityName) || [];
                }
            }
            return this;
        },
        
        getAll() {
            if (this._data) return this._data;
            return DataStore.load(entityName) || [];
        },
        
        save(item) {
            const items = this.getAll();
            item.id = item.id || entityName + '_' + Date.now();
            item.created_at = item.created_at || new Date().toISOString();
            items.push(item);
            this._data = items;
            DataStore.save(entityName, items);
            return item;
        },
        
        update(id, dados) {
            const items = this.getAll();
            const idx = items.findIndex(item => item.id === id);
            if (idx >= 0) {
                items[idx] = { ...items[idx], ...dados, updated_at: new Date().toISOString() };
                this._data = items;
                DataStore.save(entityName, items);
                return items[idx];
            }
            return null;
        },
        
        delete(id) {
            const items = this.getAll().filter(item => item.id !== id);
            this._data = items;
            DataStore.save(entityName, items);
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
const ColaboradoresStore = createEntityStore('colaboradores');
const ComprasStore = createEntityStore('compras');
const VendasServicosStore = createEntityStore('vendas_servicos');
const VendasProdutosStore = createEntityStore('vendas_produtos');
const InsumosStore = createEntityStore('insumos');
const CustosFixosStore = createEntityStore('custos_fixos');
const RelatoriosMeiStore = createEntityStore('relatorios_mei');
const AnamneseStore = createEntityStore('anamnese');

const AgendamentoStore = AgendamentosStore;

if (typeof window !== 'undefined') {
    window.DataStore = DataStore;
    window.AgendamentosStore = AgendamentosStore;
    window.AgendamentoStore = AgendamentoStore;
    window.ServicosStore = ServicosStore;
    window.ClientesStore = ClientesStore;
    window.ColaboradoresStore = ColaboradoresStore;
    window.ComprasStore = ComprasStore;
    window.VendasServicosStore = VendasServicosStore;
    window.VendasProdutosStore = VendasProdutosStore;
    window.InsumosStore = InsumosStore;
    window.CustosFixosStore = CustosFixosStore;
    window.RelatoriosMeiStore = RelatoriosMeiStore;
    window.AnamneseStore = AnamneseStore;
}
