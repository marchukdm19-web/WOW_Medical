/* ============================================
   WOW Medical — Journal (тільки читання)
   Лікарі: перегляд журналу звернень
   + Пошук по дитині з історією
   ============================================ */

import { getExaminations } from './api.js';
import { loadChildren } from './database.js';

/* ========================================
   DOM
   ======================================== */

const journalTabs = document.getElementById('journalTabs');
const journalBody = document.getElementById('journalBody');
const journalCount = document.getElementById('journalCount');
const complaintStatsBody = document.getElementById('complaintStatsBody');
const complaintStatsTotal = document.getElementById('complaintStatsTotal');

// Search DOM
const journalSearchInput = document.getElementById('journalSearchInput');
const journalSearchBtn = document.getElementById('journalSearchBtn');
const journalSearchClear = document.getElementById('journalSearchClear');
const journalSearchResults = document.getElementById('journalSearchResults');
const journalSearchActive = document.getElementById('journalSearchActive');
const journalSearchActiveName = document.getElementById('journalSearchActiveName');
const journalSearchTotal = document.getElementById('journalSearchTotal');

/* ========================================
   Стан
   ======================================== */

let allRecords = [];
let currentFilter = 'all';
let childrenData = [];
let selectedChildName = null;
let searchDebounceTimer = null;

const mpLabel = {
  white: 'WHITE',
  black: 'BLACK'
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
    allRecords.sort((a, b) => {
      const timeA = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate().getTime() : 0;
      const timeB = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate().getTime() : 0;
      return timeB - timeA;
    });
    console.log(`[Journal] Завантажено ${allRecords.length} записів`);
  } catch (error) {
    console.error('[Journal] Помилка завантаження:', error);
    allRecords = [];
  }

  // Завантажуємо список дітей для пошуку
  try {
    childrenData = await loadChildren();
    journalSearchTotal.textContent = childrenData.length;
    console.log(`[Journal] Завантажено ${childrenData.length} дітей для пошуку`);
  } catch (error) {
    console.error('[Journal] Помилка завантаження дітей:', error);
    childrenData = [];
  }

  applyFilter(currentFilter);
  buildComplaintStats(allRecords);
}

/* ========================================
   Пошук дитини
   ======================================== */

function normalize(str) {
  return str.toLowerCase().replace(/[''`]/g, "'").replace(/['']/g, "'").replace(/[«»]/g, '"').trim();
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function escapeRegex(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function searchChildren(query) {
  const q = normalize(query).trim();
  if (q.length < 2) { journalSearchResults.innerHTML = ''; journalSearchResults.classList.remove('search-results--visible'); return; }

  const tokens = q.split(/\s+/).filter(Boolean);
  const results = childrenData.filter((child) => {
    const haystack = normalize(`${child.fullName} ${child.teamLeader || ''}`);
    return tokens.every((token) => haystack.includes(token));
  });
  renderSearchResults(results, q);
}

function highlightMatch(text, query) {
  if (!text) return '—';
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return escapeHTML(text);
  return escapeHTML(text).replace(
    new RegExp(`(${tokens.map((t) => escapeRegex(escapeHTML(t))).join('|')})`, 'gi'),
    '<span class="search-results__highlight">$1</span>'
  );
}

function renderSearchResults(results, query) {
  journalSearchResults.innerHTML = '';
  if (results.length === 0) {
    journalSearchResults.innerHTML = '<div class="search-results__empty">😕 Нікого не знайдено.</div>';
    journalSearchResults.classList.add('search-results--visible');
    return;
  }

  const ul = document.createElement('ul');
  ul.className = 'search-results__list';

  results.forEach((child) => {
    const li = document.createElement('li');
    li.className = 'search-results__item';
    li.innerHTML = `
      <div class="search-results__item-info">
        <span class="search-results__item-name">${highlightMatch(child.fullName, query)}</span>
        <span class="search-results__item-meta">${escapeHTML(child.age || '—')} р. · Тім-лідер: ${escapeHTML(child.teamLeader || '—')}</span>
      </div>
      <span class="search-results__item-badge">${escapeHTML(child.age || '—')} р.</span>`;
    li.addEventListener('click', () => selectChild(child));
    ul.appendChild(li);
  });

  journalSearchResults.appendChild(ul);
  journalSearchResults.classList.add('search-results--visible');
}

function clearSearchResults() {
  journalSearchResults.innerHTML = '';
  journalSearchResults.classList.remove('search-results--visible');
}

function selectChild(child) {
  selectedChildName = child.fullName;
  journalSearchInput.value = child.fullName;
  clearSearchResults();

  // Показати активний фільтр
  journalSearchActive.style.display = 'flex';
  journalSearchActiveName.textContent = `🔍 Історія звернень: ${escapeHTML(child.fullName)}`;
  journalSearchClear.style.display = 'inline-flex';

  applyFilter(currentFilter);
}

function clearChildFilter() {
  selectedChildName = null;
  journalSearchInput.value = '';
  journalSearchActive.style.display = 'none';
  journalSearchClear.style.display = 'none';
  clearSearchResults();
  applyFilter(currentFilter);
}

/* ========================================
   Фільтрація журналу
   ======================================== */

function applyFilter(filter) {
  currentFilter = filter;

  // Оновлюємо активний таб
  const tabs = journalTabs.querySelectorAll('.journal-tab');
  tabs.forEach((tab) => {
    tab.classList.toggle('journal-tab--active', tab.dataset.mp === filter);
  });

  let filtered = filter === 'all'
    ? [...allRecords]
    : allRecords.filter((r) => (r.medicalStation || 'white') === filter);

  // Фільтруємо за обраною дитиною
  if (selectedChildName) {
    filtered = filtered.filter((r) =>
      r.childName && normalize(r.childName) === normalize(selectedChildName)
    );
  }

  journalCount.textContent = `${filtered.length} записів`;

  if (filtered.length === 0) {
    const msg = selectedChildName ? `Немає звернень для «${selectedChildName}»` : 'Немає записів';
    journalBody.innerHTML = `<tr>
      <td colspan="10" class="data-table__empty">${msg}</td>
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
      <td><span class="data-table__mp-badge ${mpBadgeClass[mp] || 'data-table__mp-badge--white'}">${mpLabel[mp] || 'WHITE'}</span></td>
      <td>${exam.parentsNotified ? '<span class="data-table__badge data-table__badge--yes">Так</span>' : '<span class="data-table__badge data-table__badge--no">Ні</span>'}</td>
    </tr>`;
  }).join('');
}

/* ========================================
   Статистика скарг
   ======================================== */

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
    const childName = (record.childName || '').trim().toLowerCase();
    complaints.forEach((c) => {
      if (!complaintCount[c]) complaintCount[c] = new Set();
      if (childName) complaintCount[c].add(childName);
      totalClicks++;
    });
  });

  const complaintUnique = {};
  for (const [key, set] of Object.entries(complaintCount)) {
    complaintUnique[key] = set.size;
  }
  const complaintCountMap = complaintUnique;

  if (complaintStatsTotal) {
    complaintStatsTotal.textContent = totalClicks;
  }

  if (!complaintStatsBody) return;

  if (Object.keys(complaintCountMap).length === 0) {
    complaintStatsBody.innerHTML = '<p class="data-table__empty">Сьогодні ще немає скарг 😊</p>';
    return;
  }

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
    const catItems = Object.entries(complaintCountMap).filter(([name]) => catComplaints.includes(name));
    const otherItems = catTitle === '🦟 Інше'
      ? Object.entries(complaintCountMap).filter(([name]) => !Object.values(categories).flat().includes(name))
      : [];
    const allCatItems = [...catItems, ...otherItems].sort((a, b) => b[1] - a[1]);
    if (allCatItems.length === 0) continue;

    html += `<table class="cs-table">`;
    html += `<thead><tr><th colspan="3" class="cs-table__cat">${catTitle}</th></tr></thead>`;
    html += `<tbody>`;

    allCatItems.forEach(([name, count]) => {
      globalIdx++;
      const maxCount = Math.max(...Object.values(complaintCountMap), 1);
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

/* ========================================
   Debounce для пошуку
   ======================================== */

function debounceSearch() {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => searchChildren(journalSearchInput.value), 300);
}

/* ========================================
   Ініціалізація
   ======================================== */

function init() {
  // Таби медпунктів
  journalTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.journal-tab');
    if (!tab) return;
    applyFilter(tab.dataset.mp);
  });

  // Пошук дитини
  journalSearchInput.addEventListener('input', debounceSearch);
  journalSearchBtn.addEventListener('click', () => searchChildren(journalSearchInput.value));
  journalSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); searchChildren(journalSearchInput.value); }
  });

  // Закриття результатів пошуку при кліку поза ними
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-section')) clearSearchResults();
  });

  // Кнопка скидання фільтру дитини
  journalSearchClear.addEventListener('click', clearChildFilter);

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
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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