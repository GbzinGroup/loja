// src/js/adminOrders.js
import { db } from './firebase-config.js';
import { 
  collection, getDocs, doc, updateDoc, orderBy, query 
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// Lista TODOS os pedidos da loja (Apenas Admin - validado pelas Rules)
export async function getAllOrders() {
  const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Altera o status de um pedido (pending -> paid -> shipped)
export async function updateOrderStatus(orderId, newStatus) {
  const validStatuses = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];
  if (!validStatuses.includes(newStatus)) {
    throw new Error('Status inválido.');
  }

  const orderRef = doc(db, 'orders', orderId);
  await updateDoc(orderRef, { 
    status: newStatus,
    updatedAt: Date.now()
  });
}
