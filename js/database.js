/* ============================================
   WOW Medical — Database
   CRUD для колекції "children"
   Firebase Firestore (якщо налаштований) або localStorage
   Працює без ES modules (для file:// протоколу)
   ============================================ */

var Database = (function() {
  'use strict';

  var STORAGE_KEY = 'children';

  /**
   * Зберігає масив дітей.
   * Firebase (якщо налаштований) → localStorage (завжди).
   */
  async function saveChildren(children) {
    if (!Array.isArray(children)) {
      throw new Error('saveChildren: очікується масив дітей');
    }

    var db = await Firebase.getDB();

    if (db) {
      try {
        var firestore = await import('https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js');
        var colRef = firestore.collection(db, 'children');
        var snapshot = await firestore.getDocs(firestore.query(colRef));
        var batch = firestore.writeBatch(db);

        snapshot.forEach(function(document) {
          batch.delete(firestore.doc(db, 'children', document.id));
        });

        children.forEach(function(child) {
          var newDocRef = firestore.doc(colRef);
          batch.set(newDocRef, child);
        });

        await batch.commit();
        console.log('[Database] Збережено ' + children.length + ' дітей у Firestore');
      } catch (e) {
        console.warn('[Database] Помилка збереження у Firestore:', e.message);
      }
    } else {
      console.log('[Database] Firebase не налаштований. Зберігаємо в localStorage.');
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(children));
    console.log('[Database] Збережено ' + children.length + ' дітей у localStorage');
    return children.length;
  }

  /**
   * Завантажує всіх дітей.
   * Спочатку пробує Firebase, потім localStorage.
   */
  async function loadChildren() {
    var db = await Firebase.getDB();

    if (db) {
      try {
        var firestore = await import('https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js');
        var colRef = firestore.collection(db, 'children');
        var snapshot = await firestore.getDocs(firestore.query(colRef));
        var children = [];

        snapshot.forEach(function(document) {
          children.push(Object.assign({ id: document.id }, document.data()));
        });

        if (children.length > 0) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(children));
          console.log('[Database] Завантажено ' + children.length + ' дітей із Firestore та синхронізовано в localStorage');
          return children;
        }
      } catch (e) {
        console.warn('[Database] Помилка завантаження з Firestore:', e.message);
      }
    }

    // Fallback: localStorage
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var children = JSON.parse(raw);
        console.log('[Database] Завантажено ' + children.length + ' дітей із localStorage');
        return children;
      }
    } catch (e) {
      console.error('[Database] Помилка читання localStorage:', e);
    }

    console.log('[Database] База порожня');
    return [];
  }

  /**
   * Видаляє всіх дітей.
   */
  async function deleteChildren() {
    var db = await Firebase.getDB();
    var deletedCount = 0;

    if (db) {
      try {
        var firestore = await import('https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js');
        var colRef = firestore.collection(db, 'children');
        var snapshot = await firestore.getDocs(firestore.query(colRef));
        var batch = firestore.writeBatch(db);

        snapshot.forEach(function(document) {
          batch.delete(firestore.doc(db, 'children', document.id));
          deletedCount++;
        });

        if (deletedCount > 0) {
          await batch.commit();
        }
        console.log('[Database] Видалено ' + deletedCount + ' дітей із Firestore');
      } catch (e) {
        console.warn('[Database] Помилка видалення з Firestore:', e.message);
      }
    }

    var localCount = 0;
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      localCount = raw ? JSON.parse(raw).length : 0;
    } catch (e) {}

    localStorage.removeItem(STORAGE_KEY);
    if (deletedCount === 0) deletedCount = localCount;
    console.log('[Database] Видалено ' + deletedCount + ' дітей із localStorage');

    return deletedCount;
  }

  return {
    saveChildren: saveChildren,
    loadChildren: loadChildren,
    deleteChildren: deleteChildren
  };
})();