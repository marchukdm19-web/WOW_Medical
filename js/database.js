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

/**
 * Зберігає масив дітей (повна заміна колекції).
 */
export async function saveChildren(children) {
  if (!Array.isArray(children)) throw new Error('saveChildren: очікується масив');

  const colRef = collection(db, COLLECTION);
  const snapshot = await getDocs(query(colRef));
  const batch = writeBatch(db);

  snapshot.forEach((document) => {
    batch.delete(doc(db, COLLECTION, document.id));
  });

  children.forEach((child) => {
    const newDocRef = doc(colRef);
    batch.set(newDocRef, child);
  });

  await batch.commit();
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
 * Видаляє всіх дітей.
 */
export async function deleteChildren() {
  const colRef = collection(db, COLLECTION);
  const snapshot = await getDocs(query(colRef));
  const batch = writeBatch(db);
  let count = 0;

  snapshot.forEach((document) => {
    batch.delete(doc(db, COLLECTION, document.id));
    count++;
  });

  if (count > 0) await batch.commit();
  console.log(`[Database] Firestore: видалено ${count} дітей`);
  return count;
}