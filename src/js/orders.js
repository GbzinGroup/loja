import { firestore } from './firebase-config.js';
import { collection, doc, setDoc, getDocs, query, where, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

export async function createOrder({ items, total, paymentMethod }) {
  const user = getAuth().currentUser;
  if (!user) throw new Error('Usuário não autenticado.');

  const orderRef = doc(collection(firestore, 'orders'));
  await setDoc(orderRef, {
    userId: user.uid,
    items,
    total,
    paymentMethod: paymentMethod || 'PIX',
    status: 'pending',
    createdAt: serverTimestamp()
  });

  // O estoque não é alterado no navegador: as regras permitem escrita em
  // products somente para administradores. Use uma Cloud Function para baixa segura.
  return orderRef.id;
}

export async function getMyOrders() {
  const user = getAuth().currentUser;
  if (!user) return [];
  
  const q = query(collection(firestore, 'orders'), where('userId', '==', user.uid));
  const snap = await getDocs(q);
  
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
}

export async function getAllOrders() {
  const snap = await getDocs(collection(firestore, 'orders'));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
}

export async function updateOrderStatus(orderId, newStatus) {
  const allowed = ['pending', 'paid', 'shipped', 'canceled', 'completed'];
  if (!allowed.includes(newStatus)) throw new Error('Status de pedido inválido.');
  await setDoc(doc(firestore, 'orders', orderId), { status: newStatus }, { merge: true });
}
