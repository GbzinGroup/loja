import { db, firestore } from './firebase-config.js';
import { ref, push, set, update, remove, onValue, get } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { collection, doc, setDoc, getDoc, getDocs, query as fsQuery, where, serverTimestamp, runTransaction } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

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
  async saveProductDelivery(id, content) { if (!id) throw new Error('Produto inválido.'); const path = ref(db, `productDeliveries/${id}`); if (!String(content || '').trim()) await remove(path); else await set(path, { content: String(content).slice(0, 12000), updatedAt: Date.now() }); },
  async getProductDelivery(id) { const snap = await get(ref(db, `productDeliveries/${id}`)); return snap.exists() ? snap.val() : null; },

  // CARRINHO E FAVORITOS
  listenCart(uid, cb) { if (!uid) return () => {}; return onValue(ref(db, `carts/${uid}`), (s) => cb(s.val() || {})); },
  async updateCart(uid, data) { await set(ref(db, `carts/${uid}`), data); },
  async getCart(uid) { const snapshot = await get(ref(db, `carts/${uid}`)); return snapshot.exists() ? (snapshot.val() || {}) : {}; },
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
  // A coleção completa é reservada ao painel. A lista pública contém somente
  // cupons explicitamente publicados pelo administrador.
  listenCoupons(cb, onError = () => {}) {
    return onValue(ref(db, 'coupons'), (s) => cb(s.val() || {}), onError);
  },
  listenPublicCoupons(cb, onError = () => {}) {
    return onValue(ref(db, 'publicCoupons'), (s) => cb(s.val() || {}), (err) => {
      console.warn('[Gbzin Shop] Não foi possível carregar cupons públicos:', err?.code || err?.message || err);
      onError(err);
    });
  },
  async addCoupon(code, discount, type) {
    const normalized = String(code || '').trim().toUpperCase();
    const amount = Number(discount);
    if (!/^[A-Z0-9_-]{3,50}$/.test(normalized)) throw new Error('Use de 3 a 50 caracteres: letras, números, hífen ou underline.');
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) throw new Error('Informe um desconto maior que zero e dentro do limite.');
    if (!['fixed', 'percent'].includes(type)) throw new Error('Tipo de desconto inválido.');
    if (type === 'percent' && amount > 100) throw new Error('O desconto percentual não pode passar de 100%.');
    const couponRef = ref(db, `coupons/${normalized}`);
    const existing = await get(couponRef);
    if (existing.exists()) throw new Error('Já existe um cupom com esse código.');
    await set(couponRef, { code: normalized, discount: amount, type, active: true, showInAccount: false });
  },
  async syncPublicCoupon(code, coupon) {
    const normalized = String(code || '').trim().toUpperCase();
    if (!normalized) throw new Error('Código de cupom inválido.');
    const publicRef = ref(db, `publicCoupons/${normalized}`);
    if (coupon && coupon.active === true && coupon.showInAccount === true) {
      await set(publicRef, {
        code: normalized,
        discount: Number(coupon.discount),
        type: coupon.type,
        active: true,
        showInAccount: true
      });
    } else {
      await remove(publicRef);
    }
  },
  async setCouponAccountVisibility(code, visible) {
    const normalized = String(code || '').trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,50}$/.test(normalized)) throw new Error('Código de cupom inválido.');
    const couponRef = ref(db, `coupons/${normalized}`);
    const snap = await get(couponRef);
    if (!snap.exists()) throw new Error('Este cupom não existe mais.');
    const coupon = { ...snap.val(), showInAccount: Boolean(visible) };
    await update(couponRef, { showInAccount: Boolean(visible) });
    await this.syncPublicCoupon(normalized, coupon);
  },
  async setCouponActive(code, active) {
    const normalized = String(code || '').trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,50}$/.test(normalized)) throw new Error('Código de cupom inválido.');
    const couponRef = ref(db, `coupons/${normalized}`);
    const snap = await get(couponRef);
    if (!snap.exists()) throw new Error('Este cupom não existe mais.');
    const coupon = { ...snap.val(), active: Boolean(active) };
    await update(couponRef, { active: Boolean(active) });
    await this.syncPublicCoupon(normalized, coupon);
  },
  async removeCoupon(code) {
    const normalized = String(code || '').trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,50}$/.test(normalized)) throw new Error('Código de cupom inválido.');
    await Promise.all([
      remove(ref(db, `coupons/${normalized}`)),
      remove(ref(db, `publicCoupons/${normalized}`))
    ]);
  },
  async validateCoupon(code) {
    const normalized = String(code || '').trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,50}$/.test(normalized)) return null;
    try {
      const snap = await get(ref(db, `coupons/${normalized}`));
      if (!snap.exists()) return null;
      const coupon = snap.val();
      const amount = Number(coupon.discount);
      if (coupon.code !== normalized || coupon.active !== true ||
          !Number.isFinite(amount) || amount <= 0 ||
          !['fixed', 'percent'].includes(coupon.type) ||
          (coupon.type === 'percent' && amount > 100)) return null;
      return { code: normalized, discount: amount, type: coupon.type, active: true };
    } catch (error) {
      console.warn('[Gbzin Shop] Validação de cupom indisponível:', error?.code || error?.message || error);
      return null;
    }
  },

  // PEDIDOS — criação e confirmação de pagamento são feitas apenas pelo backend.
  async createOrder() { throw new Error('Pedidos Pix devem ser criados pelo checkout seguro do servidor.'); },
  async getMyOrders(uid) {
    if (!uid) return [];
    const q = fsQuery(collection(firestore, 'orders'), where('userId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.createdAt?.toMillis?.()||0) - (a.createdAt?.toMillis?.()||0));
  },
  async getAllOrders() {
    const snap = await getDocs(collection(firestore, 'orders'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.createdAt?.toMillis?.()||0) - (a.createdAt?.toMillis?.()||0));
  },
  async getPaymentEvents() { const snap = await getDocs(collection(firestore, 'paymentEvents')); return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.receivedAt?.toMillis?.()||0) - (a.receivedAt?.toMillis?.()||0)).slice(0,100); },
  async updateOrderStatus(orderId, status) {
    const allowed = ['shipped', 'canceled', 'completed'];
    if (!allowed.includes(status)) throw new Error('Status permitido: enviado, cancelado ou concluído. Pagamento só é confirmado pelo Mercado Pago.');
    await setDoc(doc(firestore, 'orders', orderId), { status }, { merge: true });
  },

  // CLIENTES E REVIEWS
  async getAllCustomers() {
    const snap = await getDocs(collection(firestore, 'customers'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
  },
  async saveCustomerProfile(user, extra = {}) {
    if (!user || !user.uid) throw new Error('É necessário estar autenticado para criar o perfil.');
    const userRef = doc(firestore, 'customers', user.uid);
    // A criação de conta e o listener de autenticação podem chamar esta função
    // quase ao mesmo tempo. A transação evita duas tentativas concorrentes de create.
    await runTransaction(firestore, async (transaction) => {
      const snap = await transaction.get(userRef);
      const requestedName = String(extra.name || '').trim().slice(0, 120);
      if (snap.exists()) {
        // Se o listener de autenticação criou o perfil primeiro com o nome padrão,
        // a chamada do formulário pode completar o nome sem regravar campos protegidos.
        if (requestedName.length >= 2 && snap.data().name !== requestedName) {
          transaction.update(userRef, { name: requestedName, updatedAt: serverTimestamp() });
        }
        return;
      }
      transaction.set(userRef, {
        email: String(user.email || '').trim().slice(0, 254),
        name: (requestedName || String(user.displayName || 'Cliente').trim().slice(0, 120)),
        createdAt: serverTimestamp()
      });
    });
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