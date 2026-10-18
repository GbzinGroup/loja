import { firestore, db } from './firebase-config.js';
import { collection, doc, setDoc, getDocs, query, where, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { ref, get, update } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
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

  // Baixa o estoque no RTDB
  for (const item of items) {
    const pRef = ref(db, `products/${item.productId}`);
    const snap = await get(pRef);
    if (snap.exists()) {
      const p = snap.val();
      await update(pRef, { 
        stock: Math.max(0, (p.stock || 0) - item.qty), 
        salesCount: (p.salesCount || 0) + item.qty 
      });
    }
  }
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
  await setDoc(doc(firestore, 'orders', orderId), { status: newStatus }, { merge: true });
}
