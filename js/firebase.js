/* ============================================
   WOW Medical — Firebase (ES Module)
   Ініціалізація Firebase Firestore
   ============================================ */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyB2vJBHAHGRYXa9ADK7iQjJGaPIyBTnc-s",
  authDomain: "wow-medical.firebaseapp.com",
  projectId: "wow-medical",
  storageBucket: "wow-medical.firebasestorage.app",
  messagingSenderId: "992690700944",
  appId: "1:992690700944:web:fdf51e2ea50f0ac5ed8e15"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };