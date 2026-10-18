/* =====================================================================
   firebase-config.js — Inicialização do Firebase
   ===================================================================== */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyCuc92uSTCB_EeDGwYuBlDUUM8xL57h2F8",
  authDomain: "gbzin-group.firebaseapp.com",
  databaseURL: "https://gbzin-group-default-rtdb.firebaseio.com",
  projectId: "gbzin-group",
  storageBucket: "gbzin-group.firebasestorage.app",
  messagingSenderId: "771087321692",
  appId: "1:771087321692:web:3f42b1f2fb20be9520b499"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);      // Realtime Database
export const firestore = getFirestore(app); // Firestore