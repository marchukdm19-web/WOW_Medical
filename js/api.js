/* ============================================
   WOW Medical — API
   Інтеграція з Google Apps Script
   ============================================ */

/**
 * Відправляє дані огляду на Google Apps Script.
 * Поки що URL не вказано — запит не виконується.
 *
 * @param {Object} data — об'єкт із даними огляду
 * @param {string} data.fullName — ПІБ дитини
 * @param {string} data.squad — загін
 * @param {string} data.room — кімната
 * @param {string} data.birthDate — дата народження
 * @param {number} data.age — вік
 * @param {string} data.teamLeader — тім-лідер
 * @param {string} data.parentPhone — телефон батьків
 * @param {string} data.temperature — температура
 * @param {string} data.complaints — скарги
 * @param {string} data.assistance — надана допомога
 * @param {string} data.prescriptions — призначення
 * @param {boolean} data.parentsNotified — повідомлено батьків
 * @param {string} data.timestamp — дата та час огляду
 * @returns {Promise<Object>} відповідь сервера
 */
const EXAMINATIONS_KEY = 'examinations';

/**
 * Відправляє дані огляду на Google Apps Script
 * та зберігає в localStorage (журнал оглядів).
 *
 * @param {Object} data — об'єкт із даними огляду
 * @returns {Promise<Object>} відповідь
 */
async function saveVisit(data) {
  // Завжди зберігаємо в локальний журнал оглядів
  saveExaminationToJournal(data);

  const url = CONFIG.googleScriptURL;

  if (!url) {
    console.warn('[WOW Medical API] Google Apps Script URL не вказано.');
    return {
      success: true,
      message: 'Дані збережено локально.'
    };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(data).toString()
    });

    console.log('[WOW Medical API] Дані успішно відправлено:', data);
    return {
      success: true,
      message: 'Дані успішно відправлено.'
    };
  } catch (error) {
    console.error('[WOW Medical API] Помилка відправки:', error);
    // Дані вже збережено локально, тому success = true
    return {
      success: true,
      message: 'Дані збережено локально (помилка мережі).'
    };
  }
}

/**
 * Зберігає запис огляду в localStorage.
 */
function saveExaminationToJournal(data) {
  try {
    var raw = localStorage.getItem(EXAMINATIONS_KEY);
    var examinations = raw ? JSON.parse(raw) : [];
    examinations.push(data);
    localStorage.setItem(EXAMINATIONS_KEY, JSON.stringify(examinations));
    console.log('[WOW Medical API] Запис огляду збережено в журнал. Всього записів: ' + examinations.length);
  } catch (e) {
    console.error('[WOW Medical API] Помилка збереження в журнал:', e);
  }
}

/**
 * Завантажує всі записи оглядів із localStorage.
 * @returns {Array<Object>}
 */
function getExaminations() {
  try {
    var raw = localStorage.getItem(EXAMINATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Видаляє всі записи оглядів.
 */
function clearExaminations() {
  localStorage.removeItem(EXAMINATIONS_KEY);
}
