/* =====================================================================
   store.js — Core de dados (Realtime DB + Firestore)
   ===================================================================== */
import { db, firestore } from './firebase-config.js';
import {
  ref, push, set, update, remove, onValue, get
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import {
  collection, doc, setDoc, getDoc, getDocs, query as fsQuery,
  where, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export const store = {
  /* =====================================================================
     PRODUTOS (Realtime Database)
     ===================================================================== */
  listenProducts(callback) {
    return onValue(ref(db, 'products'), (snapshot) => {
      const data = snapshot.val() || {};
      const list = Object.entries(data).map(([id, v]) => ({ id, ...v }));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      callback(list);
    });
  },

  async addProduct(data) {
    const newRef = push(ref(db, 'products'));
    await set(newRef, {
      name: data.name || '',
      price: Number(data.price) || 0,
      stock: Number(data.stock) || 0,
      category: data.category || 'Geral',
      description: data.description || '',
      image: data.image || '',
      active: true,
      createdAt: Date.now()
    });
    return newRef.key;
  },

  async updateProduct(id, data) {
    await update(ref(db, `products/${id}`), {
      name: data.name,
      price: Number(data.price),
      stock: Number(data.stock),
      category: data.category,
      description: data.description,
      image: data.image
    });
  },

  async toggleProductStatus(id, currentStatus) {
    await update(ref(db, `products/${id}`), { active: !currentStatus });
  },

  async deleteProduct(id) {
    await remove(ref(db, `products/${id}`));
  },

  /* =====================================================================
     CARRINHO (Realtime Database)
     ===================================================================== */
  listenCart(userId, callback) {
    if (!userId) return () => {};
    return onValue(ref(db, `carts/${userId}`), (snap) => callback(snap.val() || {}));
  },

  async addToCart(userId, productId, qty = 1) {
    if (!userId) return;
    const itemRef = ref(db, `carts/${userId}/${productId}`);
    const snap = await get(itemRef);
    const current = snap.exists() ? (snap.val().qty || 0) : 0;
    await set(itemRef, { qty: current + qty });
  },

  async setQty(userId, productId, qty) {
    if (!userId) return;
    if (qty <= 0) return this.removeFromCart(userId, productId);
    await set(ref(db, `carts/${userId}/${productId}`), { qty });
  },

  async removeFromCart(userId, productId) {
    if (!userId) return;
    await remove(ref(db, `carts/${userId}/${productId}`));
  },

  async clearCart(userId) {
    if (!userId) return;
    await remove(ref(db, `carts/${userId}`));
  },

  /* =====================================================================
     PEDIDOS E VENDAS (Firestore)
     ===================================================================== */
  async createOrder(userId, customerName, items, total, paymentMethod, cpf) {
    const orderRef = doc(collection(firestore, 'orders'));
    const orderData = {
      userId,
      customerName: customerName || 'Cliente',
      items, 
      total,
      paymentMethod: paymentMethod || 'PIX',
      cpf: cpf || 'Não informado',
      status: 'pending', 
      createdAt: serverTimestamp()
    };
    await setDoc(orderRef, orderData);
    
    // Baixa de estoque automática
    for (const item of items) {
      const pRef = ref(db, `products/${item.productId}/stock`);
      const snap = await get(pRef);
      if (snap.exists()) {
        const currentStock = snap.val();
        const newStock = Math.max(0, currentStock - item.qty);
        await set(pRef, newStock);
      }
    }
    return orderRef.id;
  },

  async getMyOrders(userId) {
    if (!userId) return [];
    try {
      const q = fsQuery(collection(firestore, 'orders'), where('userId', '==', userId));
      const snap = await getDocs(q);
      const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return orders.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
    } catch (error) {
      console.error("Erro ao buscar meus pedidos:", error);
      return [];
    }
  },

  async getAllOrders() {
    try {
      const snap = await getDocs(collection(firestore, 'orders'));
      const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return orders.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
    } catch (error) {
      console.error("Erro ao buscar todos os pedidos (permissão?):", error);
      return [];
    }
  },

  async updateOrderStatus(orderId, newStatus) {
    try {
      const orderRef = doc(firestore, 'orders', orderId);
      await setDoc(orderRef, { status: newStatus }, { merge: true });
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
    }
  },

  /* =====================================================================
     CLIENTES (Firestore)
     ===================================================================== */
  async saveCustomerProfile(user, extra = {}) {
    if (!user) return;
    try {
      const userRef = doc(firestore, 'customers', user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          email: user.email || '',
          name: extra.name || user.displayName || 'Cliente',
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error("Erro ao salvar perfil:", error);
    }
  },

  async getCustomerProfile(userId) {
    if (!userId) return null;
    try {
      const snap = await getDoc(doc(firestore, 'customers', userId));
      return snap.exists() ? snap.data() : null;
    } catch (error) {
      return null;
    }
  },

  /* =====================================================================
     VENDEDORES (Realtime Database)
     ===================================================================== */
  listenVendedores(callback) {
    return onValue(ref(db, 'vendedores'), (snapshot) => callback(snapshot.val() || {}));
  },

  async addVendedor(email, nome) {
    const safeEmail = email.replace(/\./g, ',');
    await set(ref(db, `vendedores/${safeEmail}`), { email, nome: nome || 'Vendedor', addedAt: Date.now() });
  },

  async removeVendedor(email) {
    const safeEmail = email.replace(/\./g, ',');
    await remove(ref(db, `vendedores/${safeEmail}`));
  },

  /* =====================================================================
     CONFIGURAÇÕES (Realtime Database)
     ===================================================================== */
  listenSettings(callback) {
    return onValue(ref(db, 'settings'), (snapshot) => callback(snapshot.val() || {}));
  },

  async saveSettings(data) {
    await update(ref(db, 'settings'), data);
  }
};