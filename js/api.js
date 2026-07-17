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
      suggestedComplaints: data.suggestedComplaints || [],
      temperature: data.temperature || '',
      actionsDone: data.actionsDone || '',
      prescriptions: data.prescriptions || '',
      parentsNotified: !!data.parentsNotified,
      doctorName: data.doctorName || '',
      medicalStation: data.medicalStation || 'white',
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
    const q = query(colRef);
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
        suggestedComplaints: data.suggestedComplaints || [],
        temperature: data.temperature || '',
        actionsDone: data.actionsDone || '',
        prescriptions: data.prescriptions || '',
        parentsNotified: data.parentsNotified || false,
        doctorName: data.doctorName || '',
        medicalStation: data.medicalStation || 'white',
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
 * Видаляє окремий медичний запис за ID.
 */
export async function deleteRecord(recordId) {
  try {
    await deleteDoc(doc(db, COLLECTION, recordId));
    console.log('[API] Запис видалено:', recordId);
    return { success: true };
  } catch (error) {
    console.error('[API] Помилка видалення запису:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Видаляє всі медичні записи (chunked batch).
 */
export async function clearExaminations() {
  try {
    const colRef = collection(db, COLLECTION);
    const snapshot = await getDocs(query(colRef));
    const ids = [];
    snapshot.forEach((doc) => ids.push(doc.id));

    const BATCH_LIMIT = 400;
    let count = 0;
    for (let i = 0; i < ids.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      const chunk = ids.slice(i, i + BATCH_LIMIT);
      chunk.forEach((id) => batch.delete(doc(db, COLLECTION, id)));
      await batch.commit();
      count += chunk.length;
    }

    console.log(`[API] Firestore: видалено ${count} медичних записів`);
    return count;
  } catch (error) {
    console.error('[API] Помилка очищення:', error);
    return 0;
  }
}
