// src/js/orders.js
import { db } from './firebase-config.js';
import { 
  collection, addDoc, query, where, getDocs, orderBy 
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getState } from './store.js';

// Cria um novo pedido no Firestore
export async function createOrder({ items, total, paymentMethod, extras = [] }) {
  const state = getState();
  if (!state.user) throw new Error('Usuário não autenticado.');

  const orderData = {
    userId: state.user.uid,
    items,
    total,
    paymentMethod,
    extras,
    status: 'pending', // pending, paid, shipped, delivered
    createdAt: Date.now()
  };

  return await addDoc(collection(db, 'orders'), orderData);
}

// Busca o histórico de pedidos do usuário logado
export async function getMyOrders() {
  const state = getState();
  if (!state.user) return [];

  const q = query(
    collection(db, 'orders'),
    where('userId', '==', state.user.uid),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
