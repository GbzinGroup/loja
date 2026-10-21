import { db, firestore } from './firebase-config.js';
import { ref, push, set, update, remove, onValue, get } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { collection, doc, setDoc, getDoc, getDocs, query as fsQuery, where, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export const store = {
  // PRODUTOS
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

  // CARRINHO E FAVORITOS
  listenCart(uid, cb) { if (!uid) return () => {}; return onValue(ref(db, `carts/${uid}`), (s) => cb(s.val() || {})); },
  async updateCart(uid, data) { await set(ref(db, `carts/${uid}`), data); },
  listenFavorites(uid, cb) { if (!uid) return () => {}; return onValue(ref(db, `favorites/${uid}`), (s) => cb(s.val() || {})); },
  async toggleFavorite(uid, pid, isFav) {
    const r = ref(db, `favorites/${uid}/${pid}`);
    if (isFav) await remove(r); else await set(r, true);
  },

  // CONFIGURAÇÕES E MANUTENÇÃO
  listenSettings(cb) { return onValue(ref(db, 'settings'), (s) => cb(s.val() || {})); },
  async saveSettings(data) { await update(ref(db, 'settings'), data); },
  listenMaintenance(cb) { return onValue(ref(db, 'maintenance'), (s) => cb(s.val() === true)); },
  async saveMaintenance(status) { await set(ref(db, 'maintenance'), status); },

  // CUPONS
  listenCoupons(cb) { return onValue(ref(db, 'coupons'), (s) => cb(s.val() || {})); },
  async addCoupon(code, discount, type) { 
    const normalized = String(code || '').trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,50}$/.test(normalized)) throw new Error('Use um código de 3 a 50 caracteres: letras, números, hífen ou underline.');
    if (!Number.isFinite(Number(discount)) || Number(discount) <= 0) throw new Error('O desconto precisa ser maior que zero.');
    if (!['fixed', 'percent'].includes(type)) throw new Error('Tipo de desconto inválido.');
    if (type === 'percent' && Number(discount) > 100) throw new Error('O desconto percentual não pode passar de 100%.');
    await set(ref(db, `coupons/${normalized}`), { code: normalized, discount: Number(discount), type, active: true, showInAccount: false }); 
  },
  async setCouponAccountVisibility(code, visible) {
    const normalized = String(code || '').trim().toUpperCase();
    if (!normalized) throw new Error('Código de cupom inválido.');
    await update(ref(db, `coupons/${normalized}`), { showInAccount: Boolean(visible) });
  },
  async removeCoupon(code) {
    await remove(ref(db, `coupons/${code.toUpperCase()}`));
  },
  async validateCoupon(code) {
    try {
      const snap = await get(ref(db, `coupons/${code.toUpperCase()}`));
      return snap.exists() ? snap.val() : null;
    } catch { return null; }
  },

  // PEDIDOS
  async createOrder(uid, name, items, total, method, cpf, extras, coupon, isGift, giftTo) {
    if (!uid) throw new Error('Faça login para finalizar o pedido.');
    if (!Array.isArray(items) || !items.length) throw new Error('O carrinho está vazio.');
    if (!Number.isFinite(Number(total)) || Number(total) < 0) throw new Error('Total do pedido inválido.');
    // Verificação preliminar de estoque; as regras do Firebase também devem estar ativas.
    for (const item of items) {
      if (!item?.productId || !Number.isInteger(Number(item.qty)) || Number(item.qty) < 1) throw new Error('Item do pedido inválido.');
      const productSnap = await get(ref(db, `products/${item.productId}`));
      if (!productSnap.exists()) throw new Error(`O produto "${item.name || item.productId}" não está mais disponível.`);
      const product = productSnap.val();
      if (product.active === false || Number(product.stock || 0) < Number(item.qty)) {
        throw new Error(`Estoque insuficiente para "${item.name || product.name || 'produto'}".`);
      }
    }
    const orderRef = doc(collection(firestore, 'orders'));
    await setDoc(orderRef, { userId: uid, customerName: name, items, total, paymentMethod: method, cpf: cpf || 'N/I', extras: extras || [], coupon: coupon || null, isGift: isGift || false, giftTo: giftTo || null, status: 'pending', createdAt: serverTimestamp() });
    // Não altere estoque pelo navegador: as regras do RTDB permitem escrita em
    // products somente para administradores. A baixa de estoque deve ser feita
    // por uma Cloud Function confiável após validar preço/estoque no servidor.
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
  async updateOrderStatus(orderId, status) { const allowed = ['pending', 'paid', 'shipped', 'canceled', 'completed']; if (!allowed.includes(status)) throw new Error('Status de pedido inválido.'); await setDoc(doc(firestore, 'orders', orderId), { status }, { merge: true }); },

  // CLIENTES E REVIEWS
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
  async addReview(productId, uid, name, rating, comment) {
    const rRef = doc(collection(firestore, 'reviews', productId, 'items'));
    await setDoc(rRef, { userId: uid, userName: name, rating: Number(rating), comment, createdAt: serverTimestamp() });
  },
  async getReviews(productId) {
    const snap = await getDocs(collection(firestore, 'reviews', productId, 'items'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.createdAt?.toMillis()||0) - (a.createdAt?.toMillis()||0));
  }
};
