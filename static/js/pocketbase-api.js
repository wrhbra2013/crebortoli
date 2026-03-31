import PocketBase from 'https://unpkg.com/pocketbase@0.21.0/dist/pocketbase.esm.mjs';

const pb = new PocketBase('https://www.crebortoli.com.br');

window.pb = pb;

async function lerDados() {
  const [agendamentos, servicos, clientes] = await Promise.all([
    pb.collection('agendamentos').getFullList({ sort: '-data' }),
    pb.collection('servicos').getFullList(),
    pb.collection('clientes').getFullList({ sort: 'nome' })
  ]);

  return { agendamentos, servicos, clientes };
}

async function salvarAgendamento(agendamento) {
  return await pb.collection('agendamentos').create({
    cliente: agendamento.cliente,
    servico: agendamento.servico,
    data: agendamento.data,
    hora: agendamento.hora,
    status: agendamento.status || 'pendente'
  });
}

async function atualizarAgendamento(id, agendamento) {
  return await pb.collection('agendamentos').update(id, agendamento);
}

async function excluirAgendamento(id) {
  return await pb.collection('agendamentos').delete(id);
}

async function salvarServico(servico) {
  return await pb.collection('servicos').upsert(servico.id, {
    nome: servico.nome,
    preco: servico.preco,
    categoria: servico.categoria,
    desconto: servico.desconto
  });
}

async function salvarCliente(cliente) {
  return await pb.collection('clientes').create({
    nome: cliente.nome,
    telefone: cliente.telefone,
    email: cliente.email
  });
}

async function login(email, password) {
  return await pb.collection('users').authWithPassword(email, password);
}

async function logout() {
  pb.authStore.clear();
}

function isAuthenticated() {
  return pb.authStore.isValid;
}

function subscribe(callback) {
  pb.collection('agendamentos').subscribe('*', callback);
}

function unsubscribe() {
  pb.collection('agendamentos').unsubscribe('*');
}

export { 
  lerDados, 
  salvarAgendamento, 
  atualizarAgendamento, 
  excluirAgendamento,
  salvarServico, 
  salvarCliente,
  login,
  logout,
  isAuthenticated,
  subscribe,
  unsubscribe
};
