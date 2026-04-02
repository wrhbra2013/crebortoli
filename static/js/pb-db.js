import PocketBase from 'https://unpkg.com/pocketbase@0.21.0/dist/pocketbase.esm.mjs';

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

export default pb;