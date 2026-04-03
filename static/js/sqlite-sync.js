/**
 * Sistema de Persistência com SQLite Local + Sincronização
 * Usa sql.js para SQLite no browser + sync com servidor
 */

const SQLiteSync = {
    db: null,
    serverUrl: 'api.php',
    
    async init() {
        if (this.db) return;
        
        const SQL = await initSqlJs({
            locateFile: file => `https://sql.js.org/dist/${file}`
        });
        
        this.db = new SQL.Database();
        this.createTables();
        
        const saved = localStorage.getItem('crebortoli_sqlite_db');
        if (saved) {
            const data = Uint8Array.from(atob(saved), c => c.charCodeAt(0));
            this.db = new SQL.Database(data);
        } else {
            await this.syncFromServer();
        }
        
        this.startAutoSync();
    },
    
    createTables() {
        this.db.run(`
            CREATE TABLE IF NOT EXISTS agendamentos (
                id TEXT PRIMARY KEY,
                cliente TEXT,
                servico TEXT,
                data TEXT,
                hora TEXT,
                status TEXT DEFAULT 'pendente',
                created_at TEXT
            )
        `);
        
        this.db.run(`
            CREATE TABLE IF NOT EXISTS servicos (
                id TEXT PRIMARY KEY,
                nome TEXT,
                preco REAL,
                categoria TEXT,
                desconto TEXT
            )
        `);
        
        this.db.run(`
            CREATE TABLE IF NOT EXISTS clientes (
                id TEXT PRIMARY KEY,
                nome TEXT,
                telefone TEXT,
                email TEXT,
                created_at TEXT
            )
        `);
    },
    
    saveToLocalStorage() {
        const data = this.db.export();
        const base64 = btoa(String.fromCharCode.apply(null, data));
        localStorage.setItem('crebortoli_sqlite_db', base64);
    },
    
    async syncFromServer() {
        try {
            const response = await fetch(this.serverUrl + '?t=' + Date.now());
            if (!response.ok) return;
            
            const serverData = await response.json();
            
            if (serverData.agendamentos) {
                this.db.run('DELETE FROM agendamentos');
                serverData.agendamentos.forEach(a => {
                    this.db.run(
                        'INSERT INTO agendamentos (id, cliente, servico, data, hora, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [a.id, a.cliente, a.servico, a.data, a.hora, a.status, a.created_at]
                    );
                });
            }
            
            if (serverData.servicos) {
                this.db.run('DELETE FROM servicos');
                serverData.servicos.forEach(s => {
                    this.db.run(
                        'INSERT INTO servicos (id, nome, preco, categoria, desconto) VALUES (?, ?, ?, ?, ?)',
                        [s.id, s.nome, s.preco, s.categoria, s.desconto]
                    );
                });
            }
            
            if (serverData.clientes) {
                this.db.run('DELETE FROM clientes');
                serverData.clientes.forEach(c => {
                    this.db.run(
                        'INSERT INTO clientes (id, nome, telefone, email, created_at) VALUES (?, ?, ?, ?, ?)',
                        [c.id, c.nome, c.telefone, c.email, c.created_at]
                    );
                });
            }
            
            this.saveToLocalStorage();
            console.log('Dados sincronizados do servidor');
        } catch (e) {
            console.warn('Erro ao sincronizar do servidor:', e);
        }
    },
    
    async syncToServer() {
        try {
            const data = {
                full_data: {
                    agendamentos: this.getAll('agendamentos'),
                    servicos: this.getAll('servicos'),
                    clientes: this.getAll('clientes')
                }
            };
            
            await fetch(this.serverUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            console.log('Dados sincronizados para o servidor');
        } catch (e) {
            console.warn('Erro ao sincronizar para o servidor:', e);
        }
    },
    
    startAutoSync() {
        setInterval(() => this.syncToServer(), 30000);
    },
    
    getAll(table) {
        const stmt = this.db.prepare(`SELECT * FROM ${table}`);
        const results = [];
        while (stmt.step()) {
            results.push(stmt.getAsObject());
        }
        return results;
    },
    
    insert(table, data) {
        const id = data.id || 'id_' + Date.now();
        data.id = id;
        data.created_at = data.created_at || new Date().toISOString();
        
        const columns = Object.keys(data).join(', ');
        const placeholders = Object.keys(data).map(() => '?').join(', ');
        const values = Object.values(data);
        
        this.db.run(`INSERT INTO ${table} (${columns}) VALUES (${placeholders})`, values);
        this.saveToLocalStorage();
        this.syncToServer();
        
        return data;
    },
    
    update(table, id, data) {
        const sets = Object.keys(data).map(k => `${k} = ?`).join(', ');
        const values = [...Object.values(data), id];
        
        this.db.run(`UPDATE ${table} SET ${sets} WHERE id = ?`, values);
        this.saveToLocalStorage();
        this.syncToServer();
    },
    
    delete(table, id) {
        this.db.run(`DELETE FROM ${table} WHERE id = ?`, [id]);
        this.saveToLocalStorage();
        this.syncToServer();
    },
    
    query(table, sql, params = []) {
        const stmt = this.db.prepare(sql);
        stmt.bind(params);
        const results = [];
        while (stmt.step()) {
            results.push(stmt.getAsObject());
        }
        return results;
    }
};

const AgendamentosDB = {
    getAll() { return SQLiteSync.getAll('agendamentos'); },
    save(data) { return SQLiteSync.insert('agendamentos', data); },
    update(id, data) { return SQLiteSync.update('agendamentos', id, data); },
    delete(id) { return SQLiteSync.delete('agendamentos', id); },
    getByStatus(status) { return SQLiteSync.query('agendamentos', 'SELECT * FROM agendamentos WHERE status = ?', [status]); }
};

const ServicosDB = {
    getAll() { return SQLiteSync.getAll('servicos'); },
    save(data) { return SQLiteSync.insert('servicos', data); },
    update(id, data) { return SQLiteSync.update('servicos', id, data); },
    delete(id) { return SQLiteSync.delete('servicos', id); },
    getByCategoria(cat) { return SQLiteSync.query('servicos', 'SELECT * FROM servicos WHERE categoria = ?', [cat]); }
};

const ClientesDB = {
    getAll() { return SQLiteSync.getAll('clientes'); },
    save(data) { return SQLiteSync.insert('clientes', data); },
    update(id, data) { return SQLiteSync.update('clientes', id, data); },
    delete(id) { return SQLiteSync.delete('clientes', id); },
    search(term) { return SQLiteSync.query('clientes', "SELECT * FROM clientes WHERE nome LIKE ? OR telefone LIKE ?", [`%${term}%`, `%${term}%`]); }
};

if (typeof window !== 'undefined') {
    window.SQLiteSync = SQLiteSync;
    window.AgendamentosDB = AgendamentosDB;
    window.ServicosDB = ServicosDB;
    window.ClientesDB = ClientesDB;
}
