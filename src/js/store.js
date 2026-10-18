/* =====================================================================
   store.js — Core de dados (Híbrido: Realtime Database + Firestore)
   ===================================================================== */
import { db, firestore } from './firebase-config.js';
import {
  ref, push, set, update, remove, onValue, get
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import {
  collection, doc, setDoc, getDoc, getDocs, query as fsQuery,
  where, serverTimestamp, orderBy, limit
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export const store = {
  /* ================= PRODUTOS (Realtime Database) ================= */
  listenProducts(callback) {
    return onValue(ref(db, 'products'), (snapshot) => {
      const data = snapshot.val() || {};
      const list = Object.entries(data).map(([id, v]) => ({ id, ...v }));
      // Ordena pelos mais recentes (createdAt)
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      callback(list);
    });
  },

  async addProduct(data) {
    const newRef = push(ref(db, 'products'));
    await set(newRef, {
      name: data.name || 'Sem nome',
      price: Number(data.price) || 0,
      promoPrice: Number(data.promoPrice) || 0,
      stock: Number(data.stock) || 0,
      category: data.category || 'Geral',
      rarity: data.rarity || 'Comum',
      isLimited: Boolean(data.isLimited),
      expiresAt: Number(data.expiresAt) || 0,
      description: data.description || '',
      image: data.image || '',
      active: data.active !== undefined ? data.active : true,
      salesCount: 0,
      createdAt: Date.now()
    });
    return newRef.key;
  },

  async updateProduct(id, data) {
    await update(ref(db, `products/${id}`), {
      name: data.name,
      price: Number(data.price),
      promoPrice: Number(data.promoPrice),
      stock: Number(data.stock),
      category: data.category,
      rarity: data.rarity,
      isLimited: Boolean(data.isLimited),
      expiresAt: Number(data.expiresAt),
      description: data.description,
      image: data.image,
      active: data.active
    });
  },

  async toggleProductStatus(id, currentStatus) {
    await update(ref(db, `products/${id}`), { active: !currentStatus });
  },

  async deleteProduct(id) {
    await remove(ref(db, `products/${id}`));
  },

  /* ================= CARRINHO E FAVORITOS (Realtime Database) ================= */
  listenCart(userId, callback) {
    if (!userId) return () => {};
    return onValue(ref(db, `carts/${userId}`), (snap) => callback(snap.val() || {}));
  },

  async updateCart(userId, cartData) {
    // Se o carrinho estiver vazio, limpa o nó para economizar dados
    if (!cartData || Object.keys(cartData).length === 0) {
      await remove(ref(db, `carts/${userId}`));
    } else {
      await set(ref(db, `carts/${userId}`), cartData);
    }
  },

  listenFavorites(userId, callback) {
    if (!userId) return () => {};
    return onValue(ref(db, `favorites/${userId}`), (snap) => callback(snap.val() || {}));
  },

  async toggleFavorite(userId, productId, isFav) {
    const refFav = ref(db, `favorites/${userId}/${productId}`);
    if (isFav) await remove(refFav);
    else await set(refFav, true);
  },

  /* ================= CONFIGURAÇÕES, MANUTENÇÃO E CUPONS (Realtime Database) ================= */
  listenSettings(callback) {
    return onValue(ref(db, 'settings'), (snapshot) => callback(snapshot.val() || {}));
  },
  
  async saveSettings(data) {
    await update(ref(db, 'settings'), data);
  },

  listenMaintenance(callback) {
    return onValue(ref(db, 'maintenance'), (snapshot) => callback(snapshot.val() === true));
  },

  async saveMaintenance(status) {
    await set(ref(db, 'maintenance'), status);
  },

  listenCoupons(callback) {
    return onValue(ref(db, 'coupons'), (snapshot) => callback(snapshot.val() || {}));
  },
  
  async addCoupon(code, discount, type) {
    await set(ref(db, `coupons/${code.toUpperCase()}`), { 
      code: code.toUpperCase(), 
      discount: Number(discount), 
      type, 
      active: true 
    });
  },
  
  async validateCoupon(code) {
    try {
      const snap = await get(ref(db, `coupons/${code.toUpperCase()}`));
      return snap.exists() ? snap.val() : null;
    } catch { return null; }
  },

  /* ================= PEDIDOS E AVALIAÇÕES (Firestore) ================= */
  
  // A regra do Firestore exige: resource.data.userId == request.auth.uid
  async createOrder(userId, customerName, items, total, paymentMethod, cpf, extras, coupon, isGift, giftTo) {
    const orderRef = doc(collection(firestore, 'orders'));
    const orderData = {
      userId, // Obrigatório pela regra
      customerName: customerName || 'Cliente', 
      items, 
      total, 
      paymentMethod: paymentMethod || 'PIX',
      cpf: cpf || 'Não informado', 
      extras: extras || [], 
      coupon: coupon || null, 
      isGift: isGift || false, 
      giftTo: giftTo || null,
      status: 'pending', 
      createdAt: serverTimestamp()
    };
    await setDoc(orderRef, orderData);

    // Atualiza o estoque no RTDB
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
  },

  async getMyOrders(userId) {
    if (!userId) return [];
    try {
      const q = fsQuery(
        collection(firestore, 'orders'), 
        where('userId', '==', userId)
      );
      const snap = await getDocs(q);
      // Ordenação manual para não precisar criar índice composto no Firestore
      return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
    } catch (e) { 
      console.warn("Erro ao buscar pedidos:", e);
      return []; 
    }
  },

  async getAllOrders() {
    try {
      const snap = await getDocs(collection(firestore, 'orders'));
      return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
    } catch { return []; }
  },

  async updateOrderStatus(orderId, newStatus) {
    // A regra exige que apenas o Admin faça isso
    await setDoc(doc(firestore, 'orders', orderId), { status: newStatus }, { merge: true });
  },

  async addReview(productId, userId, userName, rating, comment) {
    // A regra exige: userId == auth.uid e rating entre 1 e 5
    if (rating < 1 || rating > 5) throw new Error("A nota deve ser entre 1 e 5.");
    
    const reviewRef = doc(collection(firestore, 'reviews', productId, 'items'));
    await setDoc(reviewRef, { 
      userId, 
      userName, 
      rating: Number(rating), 
      comment, 
      createdAt: serverTimestamp() 
    });
  },

  async getReviews(productId) {
    try {
      // A regra permite leitura pública (allow read: if true)
      const snap = await getDocs(collection(firestore, 'reviews', productId, 'items'));
      return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
    } catch { return []; }
  },

  /* ================= CLIENTES (Firestore) ================= */
  async saveCustomerProfile(user, extra = {}) {
    if (!user) return;
    try {
      const userRef = doc(firestore, 'customers', user.uid);
      const snap = await getDoc(userRef);
      
      if (!snap.exists()) {
        // A regra exige: request.auth.uid == userId (garantido pelo user.uid)
        await setDoc(userRef, { 
          email: user.email || '', 
          name: extra.name || user.displayName || 'Cliente', 
          createdAt: serverTimestamp() 
        });
      }
    } catch (e) { 
      console.warn("Erro ao salvar perfil:", e); 
    }
  },

  async getCustomerProfile(userId) {
    if (!userId) return null;
    try {
      // A regra exige: request.auth.uid == userId ou isAdmin()
      const snap = await getDoc(doc(firestore, 'customers', userId));
      return snap.exists() ? snap.data() : null;
    } catch { return null; }
  }
};
