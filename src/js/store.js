import { db, firestore } from './firebase-config.js';
import { ref, push, set, update, remove, onValue, get } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { collection, doc, setDoc, getDoc, getDocs, query as fsQuery, where, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export const store = {
  // ========== PRODUTOS ==========
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
    await set(newRef, { ...data, active: data.active !== undefined ? data.active : true, salesCount: 0, createdAt: Date.now() });
    return newRef.key;
  },
  async updateProduct(id, data) { await update(ref(db, `products/${id}`), data); },
  async toggleProductStatus(id, current) { await update(ref(db, `products/${id}`), { active: !current }); },
  async deleteProduct(id) { await remove(ref(db, `products/${id}`)); },

  // ========== CARRINHO E FAVORITOS ==========
  listenCart(uid, cb) { if (!uid) return () => {}; return onValue(ref(db, `carts/${uid}`), (s) => cb(s.val() || {})); },
  async updateCart(uid, data) { await set(ref(db, `carts/${uid}`), data); },
  listenFavorites(uid, cb) { if (!uid) return () => {}; return onValue(ref(db, `favorites/${uid}`), (s) => cb(s.val() || {})); },
  async toggleFavorite(uid, pid, isFav) {
    const r = ref(db, `favorites/${uid}/${pid}`);
    if (isFav) await remove(r); else await set(r, true);
  },

  // ========== CONFIGURAÇÕES E MANUTENÇÃO ==========
  listenSettings(cb) { return onValue(ref(db, 'settings'), (s) => cb(s.val() || {})); },
  async saveSettings(data) { await update(ref(db, 'settings'), data); },
  listenMaintenance(cb) { return onValue(ref(db, 'maintenance'), (s) => cb(s.val() === true)); },
  async saveMaintenance(status) { await set(ref(db, 'maintenance'), status); },

  // ========== CUPONS ==========
  listenCoupons(cb) { return onValue(ref(db, 'coupons'), (s) => cb(s.val() || {})); },
  async addCoupon(code, discount, type) { await set(ref(db, `coupons/${code.toUpperCase()}`), { code: code.toUpperCase(), discount: Number(discount), type, active: true }); },
  async validateCoupon(code) {
    const snap = await get(ref(db, `coupons/${code.toUpperCase()}`));
    return snap.exists() ? snap.val() : null;
  },

  // ========== PEDIDOS ==========
  async createOrder(uid, name, items, total, method, cpf, extras, coupon, isGift, giftTo) {
    const orderRef = doc(collection(firestore, 'orders'));
    await setDoc(orderRef, { userId: uid, customerName: name, items, total, paymentMethod: method, cpf: cpf || 'N/I', extras: extras || [], coupon: coupon || null, isGift: isGift || false, giftTo: giftTo || null, status: 'pending', createdAt: serverTimestamp() });
    for (const item of items) {
      const pRef = ref(db, `products/${item.productId}`);
      const pSnap = await get(pRef);
      if (pSnap.exists()) {
        const p = pSnap.val();
        await update(pRef, { stock: Math.max(0, (p.stock || 0) - item.qty), salesCount: (p.salesCount || 0) + item.qty });
      }
    }
    return orderRef.id;
  },
  async getMyOrders(uid) {
    if (!uid) return [];
    const q = fsQuery(collection(firestore, 'orders'), where('userId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.createdAt?.toMillis()||0) - (a.createdAt?.toMillis()||0));
  },
  async getAllOrders() {
    const snap = await getDocs(collection(firestore, 'orders'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.createdAt?.toMillis()||0) - (a.createdAt?.toMillis()||0));
  },
  async updateOrderStatus(orderId, status) { await setDoc(doc(firestore, 'orders', orderId), { status }, { merge: true }); },

  // ========== CLIENTES E AVALIAÇÕES ==========
  async saveCustomerProfile(user, extra = {}) {
    if (!user) return;
    const userRef = doc(firestore, 'customers', user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) await setDoc(userRef, { email: user.email, name: extra.name || user.displayName || 'Cliente', createdAt: serverTimestamp() });
  },
  async getCustomerProfile(uid) {
    if (!uid) return null;
    const snap = await getDoc(doc(firestore, 'customers', uid));
    return snap.exists() ? snap.data() : null;
  },
  async getAllCustomers() {
    const snap = await getDocs(collection(firestore, 'customers'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async addReview(productId, uid, name, rating, comment) {
    const rRef = doc(collection(firestore, 'reviews', productId, 'items'));
    await setDoc(rRef, { userId: uid, userName: name, rating: Number(rating), comment, createdAt: serverTimestamp() });
  },
  async getReviews(productId) {
    const snap = await getDocs(collection(firestore, 'reviews', productId, 'items'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.createdAt?.toMillis()||0) - (a.createdAt?.toMillis()||0));
  }
};
