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
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const COLLECTION = 'medical_records';

/**
 * Зберігає медичний запис у Firestore.
 * Поля: childId, childName, complaints, temperature,
 *        actionsDone, prescriptions, parentsNotified,
 *        doctorName, createdAt (serverTimestamp)
 */
export async function saveVisit(data) {
  try {
    const payload = {
      childId: data.childId || null,
      childName: data.childName || '',
      complaints: data.complaints || '',
      temperature: data.temperature || '',
      actionsDone: data.actionsDone || '',
      prescriptions: data.prescriptions || '',
      parentsNotified: !!data.parentsNotified,
      doctorName: data.doctorName || '',
      createdAt: serverTimestamp()
    };

    await addDoc(collection(db, COLLECTION), payload);
    console.log('[API] Медичний запис збережено у Firestore:', data.childName);
    return { success: true, message: 'Дані збережено у Firebase.' };
  } catch (error) {
    console.error('[API] Помилка збереження:', error);
    return { success: false, message: 'Помилка збереження: ' + error.message };
  }
}

/**
 * Завантажує всі медичні записи (сортовані за createdAt DESC).
 */
export async function getExaminations() {
  try {
    const colRef = collection(db, COLLECTION);
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    const records = [];
    snapshot.forEach((document) => {
      const data = document.data();
      // Форматуємо createdAt для відображення
      let timestamp = '';
      if (data.createdAt && data.createdAt.toDate) {
        const d = data.createdAt.toDate();
        timestamp = d.toLocaleString('uk-UA', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
      }
      records.push({
        id: document.id,
        childId: data.childId || null,
        childName: data.childName || '',
        complaints: data.complaints || '',
        temperature: data.temperature || '',
        actionsDone: data.actionsDone || '',
        prescriptions: data.prescriptions || '',
        parentsNotified: data.parentsNotified || false,
        doctorName: data.doctorName || '',
        timestamp: timestamp,
        createdAt: data.createdAt || null
      });
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