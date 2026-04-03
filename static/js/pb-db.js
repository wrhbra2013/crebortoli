import PocketBase from 'https://cdnjs.cloudflare.com/ajax/libs/pocketbase/0.21.4/pocketbase.es.mjs';

const pb = new PocketBase('https://www.crebortoli.com.br');
window.pb = pb;

export const db = {
    async getCollection(collectionName) {
        try {
            return await pb.collection(collectionName).getFullList({ sort: '-created' });
        } catch (e) {
            console.error(`Erro ao buscar ${collectionName}:`, e);
            return [];
        }
    },

    async create(collectionName, data) {
        try {
            return await pb.collection(collectionName).create(data);
        } catch (e) {
            console.error(`Erro ao criar em ${collectionName}:`, e);
            return null;
        }
    },

    async update(collectionName, id, data) {
        try {
            return await pb.collection(collectionName).update(id, data);
        } catch (e) {
            console.error(`Erro ao atualizar ${collectionName}:`, e);
            return null;
        }
    },

    async delete(collectionName, id) {
        try {
            await pb.collection(collectionName).delete(id);
            return true;
        } catch (e) {
            console.error(`Erro ao excluir de ${collectionName}:`, e);
            return false;
        }
    }
};

export const agendamentos = {
    getAll: () => db.getCollection('agendamentos'),
    create: (data) => db.create('agendamentos', data),
    update: (id, data) => db.update('agendamentos', id, data),
    delete: (id) => db.delete('agendamentos', id)
};

export const servicos = {
    getAll: () => db.getCollection('servicos'),
    create: (data) => db.create('servicos', data),
    update: (id, data) => db.update('servicos', id, data),
    delete: (id) => db.delete('servicos', id)
};

export const clientes = {
    getAll: () => db.getCollection('clientes'),
    create: (data) => db.create('clientes', data),
    update: (id, data) => db.update('clientes', id, data),
    delete: (id) => db.delete('clientes', id)
};

export const receitas = {
    getAll: () => db.getCollection('receitas'),
    create: (data) => db.create('receitas', data),
    update: (id, data) => db.update('receitas', id, data),
    delete: (id) => db.delete('receitas', id)
};

export const usuarios = {
    login: (email, password) => pb.collection('users').authWithPassword(email, password),
    logout: () => pb.authStore.clear(),
    isAuthenticated: () => pb.authStore.isValid,
    getUser: () => pb.authStore.model
};

export const qr_sessoes = {
    async criar(urlAprovacao) {
        const token = Math.random().toString(36).substring(2, 10).toUpperCase();
        const sessao = {
            token: token,
            status: 'aguardando',
            urlAprovacao: urlAprovacao,
            created: new Date().toISOString()
        };
        return await db.create('qr_sessoes', sessao);
    },

    async verificar(token) {
        const sessoes = await db.getCollection('qr_sessoes');
        const sessao = sessoes.find(s => s.token === token);
        return sessao || null;
    },

    async aprobar(token) {
        const sessoes = await db.getCollection('qr_sessoes');
        const sessao = sessoes.find(s => s.token === token && s.status === 'aguardando');
        if (sessao) {
            return await db.update('qr_sessoes', sessao.id, { 
                status: 'aprovado',
                aprovadoEm: new Date().toISOString()
            });
        }
        return null;
    },

    async negar(token) {
        const sessoes = await db.getCollection('qr_sessoes');
        const sessao = sessoes.find(s => s.token === token);
        if (sessao) {
            return await db.update('qr_sessoes', sessao.id, { 
                status: 'negado',
                negadoEm: new Date().toISOString()
            });
        }
        return null;
    },

    async limparExpiradas() {
        const sessoes = await db.getCollection('qr_sessoes');
        const agora = new Date().getTime();
        for (const sessao of sessoes) {
            const created = new Date(sessao.created).getTime();
            const idade = agora - created;
            if (idade > 60000 && sessao.status === 'aguardando') {
                await db.update('qr_sessoes', sessao.id, { status: 'expirado' });
            }
        }
    }
};

export default pb;