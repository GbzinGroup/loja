import { firestore } from './firebase-config.js';
import { collection, doc, setDoc, getDocs, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

export async function getProductReviews(productId) {
  const snap = await getDocs(collection(firestore, 'reviews', productId, 'items'));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
}

export async function addReview(productId, rating, comment) {
  const user = getAuth().currentUser;
  if (!user) throw new Error('Precisa estar logado.');
  if (rating < 1 || rating > 5) throw new Error('Nota deve ser de 1 a 5.');

  const reviewRef = doc(collection(firestore, 'reviews', productId, 'items'));
  await setDoc(reviewRef, {
    userId: user.uid,
    userName: user.displayName || 'Cliente',
    rating: Number(rating),
    comment,
    createdAt: serverTimestamp()
  });
}
