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
const complaintStatsBody = document.getElementById('complaintStatsBody');
const complaintStatsTotal = document.getElementById('complaintStatsTotal');

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
    // Сортуємо хронологічно: найстаріші записи перші, найновіші — останні
    allRecords.sort((a, b) => {
      const timeA = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate().getTime() : 0;
      const timeB = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate().getTime() : 0;
      return timeA - timeB;
    });
    console.log(`[Journal] Завантажено ${allRecords.length} записів`);
  } catch (error) {
    console.error('[Journal] Помилка завантаження:', error);
    allRecords = [];
  }
  applyFilter(currentFilter);
  buildComplaintStats(allRecords);
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

function getTodayDateString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${dd}.${mm}.${yyyy}`;
}

function buildComplaintStats(records) {
  const todayStr = getTodayDateString();
  const todayRecords = records.filter((r) => r.timestamp && r.timestamp.startsWith(todayStr));

  const complaintCount = {};
  let totalClicks = 0;

  todayRecords.forEach((record) => {
    const complaints = record.suggestedComplaints || [];
    complaints.forEach((c) => {
      if (!complaintCount[c]) complaintCount[c] = 0;
      complaintCount[c]++;
      totalClicks++;
    });
  });

  if (complaintStatsTotal) {
    complaintStatsTotal.textContent = totalClicks;
  }

  if (!complaintStatsBody) return;

  if (Object.keys(complaintCount).length === 0) {
    complaintStatsBody.innerHTML = '<p class="data-table__empty">Сьогодні ще немає скарг 😊</p>';
    return;
  }

  // Icons for each complaint
  const complaintIcons = {
    'Головний біль': '🤕', 'Підвищена температура': '🌡️', 'Слабкість': '😴', 'Запаморочення': '💫',
    'Біль у горлі': '🗣️', 'Нежить': '🤧', 'Кашель': '😮‍💨', 'Закладеність носа': '👃',
    'Нудота': '🤢', 'Блювання': '🤮', 'Біль у животі': '😖', 'Діарея': '💧',
    'Подряпина': '🩹', 'Садно': '🩹', 'Забій': '💢', 'Розтягнення': '🦵', 'Поріз': '🔪', 'Травма': '🤕',
    'Укус комахи': '🦟', 'Алергічна реакція': '🤧', 'Біль у вусі': '👂', 'Біль у зубі': '🦷', 'Почервоніння очей': '👁️'
  };

  const categories = {
    '🤒 Загальні': ['Головний біль', 'Підвищена температура', 'Слабкість', 'Запаморочення'],
    '😷 Дихальні шляхи': ['Біль у горлі', 'Нежить', 'Кашель', 'Закладеність носа'],
    '🤢 Шлунково-кишкові': ['Нудота', 'Блювання', 'Біль у животі', 'Діарея'],
    '🤕 Травми': ['Подряпина', 'Садно', 'Забій', 'Розтягнення', 'Поріз', 'Травма'],
    '🦟 Інше': ['Укус комахи', 'Алергічна реакція', 'Біль у вусі', 'Біль у зубі', 'Почервоніння очей']
  };

  let html = '';
  let globalIdx = 0;

  for (const [catTitle, catComplaints] of Object.entries(categories)) {
    const catItems = Object.entries(complaintCount).filter(([name]) => catComplaints.includes(name));
    const otherItems = catTitle === '🦟 Інше'
      ? Object.entries(complaintCount).filter(([name]) => !Object.values(categories).flat().includes(name))
      : [];
    const allCatItems = [...catItems, ...otherItems].sort((a, b) => b[1] - a[1]);
    if (allCatItems.length === 0) continue;

    html += `<table class="cs-table">`;
    html += `<thead><tr><th colspan="3" class="cs-table__cat">${catTitle}</th></tr></thead>`;
    html += `<tbody>`;

    allCatItems.forEach(([name, count]) => {
      globalIdx++;
      const maxCount = Math.max(...Object.values(complaintCount), 1);
      const barW = Math.round((count / maxCount) * 100);
      const icon = complaintIcons[name] || '📋';
      html += `<tr>
        <td class="cs-table__num">${globalIdx}</td>
        <td class="cs-table__name"><span class="cs-table__icon">${icon}</span>${escapeHTML(name)}</td>
        <td class="cs-table__bar-cell">
          <div class="cs-table__bar"><div class="cs-table__fill" style="width:${barW}%"></div></div>
        </td>
        <td class="cs-table__count">${count}</td>
      </tr>`;
    });

    html += `</tbody></table>`;
  }

  complaintStatsBody.innerHTML = html;
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

  // Download complaint stats as image
  const journalScsDownloadBtn = document.getElementById('journalScsDownloadBtn');
  if (journalScsDownloadBtn) {
    journalScsDownloadBtn.addEventListener('click', async () => {
      const el = document.getElementById('complaintStatsSection');
      if (!el || typeof html2canvas === 'undefined') {
        alert('Не вдалося завантажити: html2canvas не знайдено');
        return;
      }
      journalScsDownloadBtn.disabled = true;
      try {
        const canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
        const link = document.createElement('a');
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
        link.download = `WOW_Medical_скарги_${dateStr}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } catch (err) {
        console.error('html2canvas error:', err);
        alert('Помилка створення зображення');
      }
      journalScsDownloadBtn.disabled = false;
    });
  }

  loadJournal();
}

init();