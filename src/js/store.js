import { db, firestore } from './firebase-config.js';
import { ref, push, set, update, remove, onValue, get } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { collection, doc, setDoc, getDoc, getDocs, query as fsQuery, where, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export const store = {
  /* ================= PRODUTOS E CATÁLOGO ================= */
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
      name: data.name, price: Number(data.price), promoPrice: Number(data.promoPrice) || 0,
      stock: Number(data.stock), category: data.category, rarity: data.rarity || 'Comum',
      isLimited: data.isLimited || false, expiresAt: Number(data.expiresAt) || 0,
      isPackage: data.isPackage || false, packageItems: data.packageItems || '',
      description: data.description, image: data.image, active: true, salesCount: 0, createdAt: Date.now()
    });
  },

  async updateProduct(id, data) {
    await update(ref(db, `products/${id}`), {
      name: data.name, price: Number(data.price), promoPrice: Number(data.promoPrice) || 0,
      stock: Number(data.stock), category: data.category, rarity: data.rarity,
      isLimited: data.isLimited, expiresAt: Number(data.expiresAt), 
      isPackage: data.isPackage, packageItems: data.packageItems,
      description: data.description, image: data.image
    });
  },

  async toggleProductStatus(id, currentStatus) { await update(ref(db, `products/${id}`), { active: !currentStatus }); },
  async deleteProduct(id) { await remove(ref(db, `products/${id}`)); },
  
  // Incrementa vendas (chamado ao comprar)
  async incrementSales(productId, qty) {
    const pRef = ref(db, `products/${productId}/salesCount`);
    const snap = await get(pRef);
    const current = snap.exists() ? snap.val() : 0;
    await set(pRef, current + qty);
  },

  /* ================= CARRINHO E FAVORITOS ================= */
  listenCart(userId, callback) {
    if (!userId) return () => {};
    return onValue(ref(db, `carts/${userId}`), (snap) => callback(snap.val() || {}));
  },
  
  async updateCart(userId, cartData) { await set(ref(db, `carts/${userId}`), cartData); },

  listenFavorites(userId, callback) {
    if (!userId) return () => {};
    return onValue(ref(db, `favorites/${userId}`), (snap) => callback(snap.val() || {}));
  },
  async toggleFavorite(userId, productId, isFav) {
    const refFav = ref(db, `favorites/${userId}/${productId}`);
    if (isFav) await remove(refFav); else await set(refFav, true);
  },

  /* ================= CUPONS E CONFIGURAÇÕES ================= */
  async validateCoupon(code) {
    const snap = await get(ref(db, `coupons/${code.toUpperCase()}`));
    return snap.exists() ? snap.val() : null;
  },
  
  async addCoupon(code, discount, type) {
    await set(ref(db, `coupons/${code.toUpperCase()}`), { code: code.toUpperCase(), discount: Number(discount), type, active: true });
  },
  listenCoupons(callback) { return onValue(ref(db, 'coupons'), (s) => callback(s.val() || {})); },
  listenSettings(callback) { return onValue(ref(db, 'settings'), (s) => callback(s.val() || {})); },
  async saveSettings(data) { await update(ref(db, 'settings'), data); },

  /* ================= PEDIDOS E AVALIAÇÕES ================= */
  async createOrder(userId, customerName, items, total, paymentMethod, cpf, extras, couponUsed, isGift, giftTo) {
    const orderRef = doc(collection(firestore, 'orders'));
    const orderData = {
      userId, customerName, items, total, paymentMethod, cpf: cpf || 'Não informado',
      extras: extras || [], couponUsed: couponUsed || null,
      isGift: isGift || false, giftTo: giftTo || null,
      status: 'pending', createdAt: serverTimestamp()
    };
    await setDoc(orderRef, orderData);
    
    // Baixa estoque e incrementa vendas
    for (const item of items) {
      const pRef = ref(db, `products/${item.productId}`);
      const snap = await get(pRef);
      if (snap.exists()) {
        const p = snap.val();
        await update(pRef, { stock: Math.max(0, (p.stock || 0) - item.qty), salesCount: (p.salesCount || 0) + item.qty });
      }
    }
    return orderRef.id;
  },

  async getMyOrders(userId) {
    if (!userId) return [];
    const q = fsQuery(collection(firestore, 'orders'), where('userId', '==', userId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
  },

  async getAllOrders() {
    try {
      const snap = await getDocs(collection(firestore, 'orders'));
      return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
    } catch { return []; }
  },

  async updateOrderStatus(orderId, newStatus) { await setDoc(doc(firestore, 'orders', orderId), { status: newStatus }, { merge: true }); },

  async addReview(productId, userId, userName, rating, comment) {
    const reviewRef = doc(collection(firestore, 'reviews', productId, 'items'));
    await setDoc(reviewRef, { userId, userName, rating, comment, createdAt: serverTimestamp() });
  },

  async getReviews(productId) {
    const snap = await getDocs(collection(firestore, 'reviews', productId, 'items'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
  },

  /* ================= CLIENTES E VENDEDORES ================= */
  async saveCustomerProfile(user, extra = {}) {
    const userRef = doc(firestore, 'customers', user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) await setDoc(userRef, { email: user.email, name: extra.name || 'Cliente', createdAt: serverTimestamp() });
  },
  async getCustomerProfile(userId) {
    const snap = await getDoc(doc(firestore, 'customers', userId));
    return snap.exists() ? snap.data() : null;
  },
  listenVendedores(callback) { return onValue(ref(db, 'vendedores'), (s) => callback(s.val() || {})); },
  async addVendedor(email, nome) { await set(ref(db, `vendedores/${email.replace(/\./g, ',')}`), { email, nome, addedAt: Date.now() }); },
  async removeVendedor(email) { await remove(ref(db, `vendedores/${email.replace(/\./g, ',')}`)); }
};