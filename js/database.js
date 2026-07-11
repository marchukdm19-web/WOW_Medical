/* ============================================
   WOW Medical — Database (ES Module)
   Firestore CRUD для колекції "children"
   ============================================ */

import { db } from './firebase.js';
import {
  collection,
  getDocs,
  doc,
  writeBatch,
  query,
  deleteDoc
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const COLLECTION = 'children';
const BATCH_LIMIT = 400; // Firestore max 500, залишаємо запас

/**
 * Зберігає масив дітей (повна заміна колекції).
 * Використовує кілька batch'ів для великої кількості записів.
 */
export async function saveChildren(children) {
  if (!Array.isArray(children)) throw new Error('saveChildren: очікується масив');

  const colRef = collection(db, COLLECTION);

  // 1. Видаляємо всі існуючі документи (chunked batch)
  const snapshot = await getDocs(query(colRef));
  const existingIds = [];
  snapshot.forEach((doc) => existingIds.push(doc.id));

  for (let i = 0; i < existingIds.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    const chunk = existingIds.slice(i, i + BATCH_LIMIT);
    chunk.forEach((id) => batch.delete(doc(db, COLLECTION, id)));
    await batch.commit();
  }

  // 2. Записуємо нових дітей (chunked batch)
  for (let i = 0; i < children.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    const chunk = children.slice(i, i + BATCH_LIMIT);
    chunk.forEach((child) => {
      const newDocRef = doc(colRef);
      batch.set(newDocRef, child);
    });
    await batch.commit();
  }

  console.log(`[Database] Firestore: збережено ${children.length} дітей`);
  return children.length;
}

/**
 * Завантажує всіх дітей із колекції "children".
 */
export async function loadChildren() {
  const colRef = collection(db, COLLECTION);
  const snapshot = await getDocs(query(colRef));

  const children = [];
  snapshot.forEach((document) => {
    children.push({ id: document.id, ...document.data() });
  });

  console.log(`[Database] Firestore: завантажено ${children.length} дітей`);
  return children;
}

/**
 * Видаляє всіх дітей (chunked batch).
 */
export async function deleteChildren() {
  const colRef = collection(db, COLLECTION);
  const snapshot = await getDocs(query(colRef));
  const ids = [];
  snapshot.forEach((doc) => ids.push(doc.id));

  let count = 0;
  for (let i = 0; i < ids.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    const chunk = ids.slice(i, i + BATCH_LIMIT);
    chunk.forEach((id) => batch.delete(doc(db, COLLECTION, id)));
    await batch.commit();
    count += chunk.length;
  }

  console.log(`[Database] Firestore: видалено ${count} дітей`);
  return count;
}