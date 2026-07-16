/* ============================================
   WOW Medical — Journal (тільки читання)
   Лікарі: перегляд журналу звернень
   Без видалення, очищення, імпорту
   ============================================ */

import { getExaminations } from './api.js';

/* ========================================
   DOM
   ======================================== */

const journalTabs = document.getElementById('journalTabs');
const journalBody = document.getElementById('journalBody');
const journalCount = document.getElementById('journalCount');

/* ========================================
   Стан
   ======================================== */

let allRecords = [];
let currentFilter = 'all';

const mpLabel = {
  white: 'Білий',
  black: 'Чорний'
};

const mpBadgeClass = {
  white: 'data-table__mp-badge--white',
  black: 'data-table__mp-badge--black'
};

/* ========================================
   Завантаження
   ======================================== */

async function loadJournal() {
  try {
    allRecords = await getExaminations();
    console.log(`[Journal] Завантажено ${allRecords.length} записів`);
  } catch (error) {
    console.error('[Journal] Помилка завантаження:', error);
    allRecords = [];
  }
  applyFilter(currentFilter);
}

function applyFilter(filter) {
  currentFilter = filter;

  // Оновлюємо активний таб
  const tabs = journalTabs.querySelectorAll('.journal-tab');
  tabs.forEach((tab) => {
    tab.classList.toggle('journal-tab--active', tab.dataset.mp === filter);
  });

  const filtered = filter === 'all'
    ? allRecords
    : allRecords.filter((r) => (r.medicalStation || 'white') === filter);

  journalCount.textContent = `${filtered.length} записів`;

  if (filtered.length === 0) {
    journalBody.innerHTML = `<tr>
      <td colspan="10" class="data-table__empty">Немає записів</td>
    </tr>`;
    return;
  }

  journalBody.innerHTML = filtered.map((exam, index) => {
    const mp = exam.medicalStation || 'white';
    return `<tr>
      <td>${index + 1}</td>
      <td>${escapeHTML(exam.timestamp || '—')}</td>
      <td>${escapeHTML(exam.childName || '—')}</td>
      <td>${exam.temperature ? escapeHTML(exam.temperature) + '°C' : '—'}</td>
      <td class="data-table__cell--wrap">${escapeHTML(exam.complaints || '—')}</td>
      <td class="data-table__cell--wrap">${escapeHTML(exam.actionsDone || '—')}</td>
      <td class="data-table__cell--wrap">${escapeHTML(exam.prescriptions || '—')}</td>
      <td>${escapeHTML(exam.doctorName || '—')}</td>
      <td><span class="data-table__mp-badge ${mpBadgeClass[mp] || 'data-table__mp-badge--white'}">${mpLabel[mp] || 'Білий'}</span></td>
      <td>${exam.parentsNotified ? '<span class="data-table__badge data-table__badge--yes">Так</span>' : '<span class="data-table__badge data-table__badge--no">Ні</span>'}</td>
    </tr>`;
  }).join('');
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/* ========================================
   Ініціалізація
   ======================================== */

function init() {
  journalTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.journal-tab');
    if (!tab) return;
    applyFilter(tab.dataset.mp);
  });

  loadJournal();
}

init();