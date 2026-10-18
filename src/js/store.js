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
    try {
      const newRef = push(ref(db, 'products'));
      await set(newRef, {
        name: data.name || '',
        price: Number(data.price) || 0,
        promoPrice: Number(data.promoPrice) || 0,
        stock: Number(data.stock) || 0,
        category: data.category || 'Geral',
        rarity: data.rarity || 'Comum',
        isLimited: Boolean(data.isLimited),
        expiresAt: Number(data.expiresAt) || 0,
        isPackage: Boolean(data.isPackage),
        packageItems: data.packageItems || '',
        description: data.description || '',
        image: data.image || '',
        active: true,
        salesCount: 0,
        createdAt: Date.now()
      });
      return newRef.key;
    } catch (error) {
      console.error("Erro ao adicionar produto:", error);
      throw error;
    }
  },

  async updateProduct(id, data) {
    try {
      await update(ref(db, `products/${id}`), {
        name: data.name,
        price: Number(data.price),
        promoPrice: Number(data.promoPrice),
        stock: Number(data.stock),
        category: data.category,
        rarity: data.rarity,
        isLimited: Boolean(data.isLimited),
        expiresAt: Number(data.expiresAt),
        isPackage: Boolean(data.isPackage),
        packageItems: data.packageItems,
        description: data.description,
        image: data.image
      });
    } catch (error) {
      console.error("Erro ao atualizar produto:", error);
      throw error;
    }
  },

  async toggleProductStatus(id, currentStatus) {
    try { await update(ref(db, `products/${id}`), { active: !currentStatus }); } 
    catch (error) { console.error(error); }
  },

  async deleteProduct(id) {
    try { await remove(ref(db, `products/${id}`)); } 
    catch (error) { console.error(error); }
  },

  /* =====================================================================
     CARRINHO E FAVORITOS (Realtime Database)
     ===================================================================== */
  listenCart(userId, callback) {
    if (!userId) return () => {};
    return onValue(ref(db, `carts/${userId}`), (snap) => callback(snap.val() || {}));
  },

  async updateCart(userId, cartData) {
    try { await set(ref(db, `carts/${userId}`), cartData); } 
    catch (error) { console.error("Erro no carrinho:", error); }
  },

  listenFavorites(userId, callback) {
    if (!userId) return () => {};
    return onValue(ref(db, `favorites/${userId}`), (snap) => callback(snap.val() || {}));
  },

  async toggleFavorite(userId, productId, isFav) {
    try {
      const refFav = ref(db, `favorites/${userId}/${productId}`);
      if (isFav) await remove(refFav);
      else await set(refFav, true);
    } catch (error) { console.error(error); }
  },

  /* =====================================================================
     CUPONS E CONFIGURAÇÕES (Realtime Database)
     ===================================================================== */
  listenSettings(callback) {
    return onValue(ref(db, 'settings'), (snapshot) => callback(snapshot.val() || {}));
  },
  async saveSettings(data) {
    try { await update(ref(db, 'settings'), data); } catch (error) { console.error(error); }
  },

  listenCoupons(callback) {
    return onValue(ref(db, 'coupons'), (snapshot) => callback(snapshot.val() || {}));
  },
  async addCoupon(code, discount, type) {
    try {
      await set(ref(db, `coupons/${code.toUpperCase()}`), { code: code.toUpperCase(), discount: Number(discount), type, active: true });
    } catch (error) { console.error(error); }
  },
  async validateCoupon(code) {
    try {
      const snap = await get(ref(db, `coupons/${code.toUpperCase()}`));
      return snap.exists() ? snap.val() : null;
    } catch (error) { return null; }
  },

  /* =====================================================================
     PEDIDOS E AVALIAÇÕES (Firestore)
     ===================================================================== */
  async createOrder(userId, customerName, items, total, paymentMethod, cpf, extras, coupon, isGift, giftTo) {
    try {
      const orderRef = doc(collection(firestore, 'orders'));
      const orderData = {
        userId, customerName: customerName || 'Cliente', items, total, paymentMethod: paymentMethod || 'PIX',
        cpf: cpf || 'Não informado', extras: extras || [], coupon: coupon || null, isGift: isGift || false, giftTo: giftTo || null,
        status: 'pending', createdAt: serverTimestamp()
      };
      await setDoc(orderRef, orderData);

      // Baixa de estoque e contador de vendas
      for (const item of items) {
        const pRef = ref(db, `products/${item.productId}`);
        const snap = await get(pRef);
        if (snap.exists()) {
          const p = snap.val();
          await update(pRef, { stock: Math.max(0, (p.stock || 0) - item.qty), salesCount: (p.salesCount || 0) + item.qty });
        }
      }
      return orderRef.id;
    } catch (error) {
      console.error("Erro ao criar pedido:", error);
      throw error;
    }
  },

  async getMyOrders(userId) {
    if (!userId) return [];
    try {
      const q = fsQuery(collection(firestore, 'orders'), where('userId', '==', userId));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
    } catch (error) { 
      console.warn("Aviso: Sem permissão para buscar pedidos.", error);
      return []; 
    }
  },

  async getAllOrders() {
    try {
      const snap = await getDocs(collection(firestore, 'orders'));
      return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
    } catch (error) { 
      console.warn("Aviso: Sem permissão para buscar todos os pedidos.", error);
      return []; 
    }
  },

  async updateOrderStatus(orderId, newStatus) {
    try { await setDoc(doc(firestore, 'orders', orderId), { status: newStatus }, { merge: true }); } 
    catch (error) { console.error(error); }
  },

  async addReview(productId, userId, userName, rating, comment) {
    try {
      const reviewRef = doc(collection(firestore, 'reviews', productId, 'items'));
      await setDoc(reviewRef, { userId, userName, rating: Number(rating), comment, createdAt: serverTimestamp() });
    } catch (error) { console.error(error); }
  },

  async getReviews(productId) {
    try {
      const snap = await getDocs(collection(firestore, 'reviews', productId, 'items'));
      return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
    } catch (error) { return []; }
  },

  /* =====================================================================
     CLIENTES E VENDEDORES
     ===================================================================== */
  async saveCustomerProfile(user, extra = {}) {
    if (!user) return;
    try {
      const userRef = doc(firestore, 'customers', user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, { email: user.email || '', name: extra.name || user.displayName || 'Cliente', createdAt: serverTimestamp() });
      }
    } catch (error) {
      console.warn("Aviso: Falha ao salvar perfil (Regra de permissão).", error.message);
    }
  },

  async getCustomerProfile(userId) {
    if (!userId) return null;
    try {
      const snap = await getDoc(doc(firestore, 'customers', userId));
      return snap.exists() ? snap.data() : null;
    } catch (error) {
      console.warn("Aviso: Falha ao buscar perfil.", error.message);
      return null;
    }
  },

  listenVendedores(callback) {
    return onValue(ref(db, 'vendedores'), (snapshot) => callback(snapshot.val() || {}));
  },
  async addVendedor(email, nome) {
    try { await set(ref(db, `vendedores/${email.replace(/\./g, ',')}`), { email, nome, addedAt: Date.now() }); } 
    catch (error) { console.error(error); }
  },
  async removeVendedor(email) {
    try { await remove(ref(db, `vendedores/${email.replace(/\./g, ',')}`)); } 
    catch (error) { console.error(error); }
  }
};