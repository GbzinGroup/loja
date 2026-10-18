import { db } from './firebase-config.js';
import { ref, push, set, update, remove, onValue, get } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

export const store = {
  /* ================= PRODUTOS ================= */
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

  /* ================= CARRINHO E FAVORITOS ================= */
  listenCart(userId, callback) {
    if (!userId) return () => {};
    return onValue(ref(db, `carts/${userId}`), (snap) => callback(snap.val() || {}));
  },

  async updateCart(userId, cartData) {
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

  /* ================= CONFIGURAÇÕES ================= */
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

  /* ================= CUPONS ================= */
  listenCoupons(callback) {
    return onValue(ref(db, 'coupons'), (snapshot) => callback(snapshot.val() || {}));
  },
  
  async addCoupon(code, discount, type) {
    await set(ref(db, `coupons/${code.toUpperCase()}`), { 
      code: code.toUpperCase(), discount: Number(discount), type, active: true 
    });
  },
  
  async validateCoupon(code) {
    try {
      const snap = await get(ref(db, `coupons/${code.toUpperCase()}`));
      return snap.exists() ? snap.val() : null;
    } catch { return null; }
  }
};
