// src/js/reviews.js
import { db } from './firebase-config.js';
import { 
  collection, addDoc, getDocs, query, orderBy, serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getState } from './store.js';

const getReviewsRef = (productId) => collection(db, 'reviews', productId, 'items');

export async function getProductReviews(productId) {
  const q = query(getReviewsRef(productId), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function addReview(productId, rating, comment) {
  const state = getState();
  if (!state.user) throw new Error('Você precisa estar logado para avaliar.');
  if (rating < 1 || rating > 5) throw new Error('A nota deve ser entre 1 e 5.');

  return await addDoc(getReviewsRef(productId), {
    userId: state.user.uid,
    userName: state.user.displayName || 'Cliente',
    rating: Number(rating),
    comment: comment.trim(),
    createdAt: Date.now(), // Usando number para manter o padrão do seu projeto
  });
}
