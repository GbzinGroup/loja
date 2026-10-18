import { firestore } from './firebase-config.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

export async function getMyProfile() {
  const user = getAuth().currentUser;
  if (!user) return null;
  const snap = await getDoc(doc(firestore, 'customers', user.uid));
  return snap.exists() ? snap.data() : null;
}

export async function saveMyProfile(data) {
  const user = getAuth().currentUser;
  if (!user) return;
  const userRef = doc(firestore, 'customers', user.uid);
  const snap = await getDoc(userRef);
  
  if (!snap.exists()) {
    await setDoc(userRef, { 
      email: user.email || '', 
      name: data.name || user.displayName || 'Cliente', 
      createdAt: new Date().getTime() 
    });
  } else if (data.name) {
    await setDoc(userRef, { name: data.name }, { merge: true });
  }
}
