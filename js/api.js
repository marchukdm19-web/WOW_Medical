/* ============================================
   WOW Medical — API (ES Module)
   Медичні записи → Firestore "medical_records"
   ============================================ */

import { db } from './firebase.js';
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  doc,
  writeBatch,
  where
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const COLLECTION = 'medical_records';

/**
 * Зберігає медичний запис у Firestore.
 */
export async function saveVisit(data) {
  try {
    await addDoc(collection(db, COLLECTION), data);
    console.log('[API] Медичний запис збережено у Firestore:', data.fullName);
    return { success: true, message: 'Дані збережено у Firebase.' };
  } catch (error) {
    console.error('[API] Помилка збереження:', error);
    return { success: false, message: 'Помилка збереження: ' + error.message };
  }
}

/**
 * Завантажує всі медичні записи (від найновіших).
 */
export async function getExaminations() {
  try {
    const colRef = collection(db, COLLECTION);
    const q = query(colRef);
    const snapshot = await getDocs(q);

    const records = [];
    snapshot.forEach((document) => {
      records.push({ id: document.id, ...document.data() });
    });

    // Сортуємо клієнтськи — від найновіших
    records.sort((a, b) => {
      if (!a.timestamp) return 1;
      if (!b.timestamp) return -1;
      return b.timestamp.localeCompare(a.timestamp);
    });

    console.log(`[API] Firestore: завантажено ${records.length} медичних записів`);
    return records;
  } catch (error) {
    console.error('[API] Помилка завантаження:', error);
    return [];
  }
}

/**
 * Видаляє всі медичні записи.
 */
export async function clearExaminations() {
  try {
    const colRef = collection(db, COLLECTION);
    const snapshot = await getDocs(query(colRef));
    const batch = writeBatch(db);
    let count = 0;

    snapshot.forEach((document) => {
      batch.delete(doc(db, COLLECTION, document.id));
      count++;
    });

    if (count > 0) await batch.commit();
    console.log(`[API] Firestore: видалено ${count} медичних записів`);
    return count;
  } catch (error) {
    console.error('[API] Помилка очищення:', error);
    return 0;
  }
}