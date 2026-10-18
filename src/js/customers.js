// src/js/customers.js
import { db } from './firebase-config.js';
import { 
  doc, getDoc, setDoc, updateDoc 
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getState } from './store.js';

// Busca os dados do perfil do cliente logado
export async function getMyProfile() {
  const state = getState();
  if (!state.user) return null;

  const docRef = doc(db, 'customers', state.user.uid);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() };
  }
  return null;
}

// Atualiza ou cria os dados do perfil
export async function saveMyProfile(data) {
  const state = getState();
  if (!state.user) throw new Error('Usuário não autenticado.');

  const docRef = doc(db, 'customers', state.user.uid);
  const payload = {
    ...data,
    email: state.user.email,
    updatedAt: Date.now()
  };

  // setDoc com merge:true cria se não existir, ou atualiza os campos
  await setDoc(docRef, payload, { merge: true });
  return payload;
}
