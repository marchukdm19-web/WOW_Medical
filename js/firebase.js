/* ============================================
   WOW Medical — Firebase
   Лінива ініціалізація Firebase Firestore
   Не падає при порожній конфігурації
   Працює без ES modules (для file:// протоколу)
   ============================================ */

var Firebase = (function() {
  'use strict';

  var db = null;
  var app = null;

  var firebaseConfig = {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: ''
  };

  function isFirebaseConfigured() {
    return !!(
      firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId
    );
  }

  async function getDB() {
    if (db) return db;
    if (!isFirebaseConfigured()) {
      console.warn('[Firebase] Firebase не налаштований. Використовується localStorage.');
      return null;
    }
    try {
      var firebaseApp = await import('https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js');
      var firestore = await import('https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js');
      app = firebaseApp.initializeApp(firebaseConfig);
      db = firestore.getFirestore(app);
      console.log('[Firebase] Firebase ініціалізовано успішно');
      return db;
    } catch (error) {
      console.error('[Firebase] Помилка ініціалізації Firebase:', error.message);
      return null;
    }
  }

  return {
    getDB: getDB,
    isFirebaseConfigured: isFirebaseConfigured
  };
})();