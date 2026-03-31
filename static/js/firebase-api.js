import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore, collection, doc, getDoc, setDoc, getDocs, addDoc, deleteDoc, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function lerDados() {
  const [agendamentosSnap, servicosSnap, clientesSnap] = await Promise.all([
    getDocs(query(collection(db, 'agendamentos'), orderBy('data', 'desc'))),
    getDocs(collection(db, 'servicos')),
    getDocs(query(collection(db, 'clientes'), orderBy('nome')))
  ]);

  return {
    agendamentos: agendamentosSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    servicos: servicosSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    clientes: clientesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  };
}

async function salvarAgendamento(agendamento) {
  await addDoc(collection(db, 'agendamentos'), {
    ...agendamento,
    createdAt: new Date().toISOString()
  });
}

async function salvarServico(servico) {
  await setDoc(doc(db, 'servicos', servico.id), servico);
}

async function salvarCliente(cliente) {
  await addDoc(collection(db, 'clientes'), {
    ...cliente,
    createdAt: new Date().toISOString()
  });
}

async function excluirAgendamento(id) {
  await deleteDoc(doc(db, 'agendamentos', id));
}

export { lerDados, salvarAgendamento, salvarServico, salvarCliente, excluirAgendamento };
