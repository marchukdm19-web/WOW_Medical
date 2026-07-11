/* ============================================
   WOW Medical — App (ES Module)
   Лікар: пошук, форма, історія
   Дані — тільки Firestore
   ============================================ */

import { CONFIG } from './config.js';
import { loadChildren } from './database.js';
import { saveVisit, getExaminations } from './api.js';

// Стан
let childrenData = [];
let selectedChild = null;
let searchDebounceTimer = null;
let selectedMedicalPoint = 'white';

// DOM
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const searchResults = document.getElementById('searchResults');
const searchTotal = document.getElementById('searchTotal');
const form = document.getElementById('examinationForm');

const fieldFullName = document.getElementById('fullName');
const fieldAge = document.getElementById('age');
const fieldTeamLeader = document.getElementById('teamLeader');
const fieldParentName = document.getElementById('parentName');
const fieldPhone = document.getElementById('phone');
const fieldHealthInfo = document.getElementById('healthInfo');

const fieldDoctorName = document.getElementById('doctorName');
const fieldTemperature = document.getElementById('temperature');
const fieldComplaints = document.getElementById('complaints');
const fieldActionsDone = document.getElementById('actionsDone');
const fieldPrescriptions = document.getElementById('prescriptions');
const fieldParentsNotified = document.getElementById('parentsNotified');

const mpWhiteBtn = document.getElementById('mpWhite');
const mpBlackBtn = document.getElementById('mpBlack');

const historySection = document.getElementById('historySection');
const historyBody = document.getElementById('historyBody');
const historyCount = document.getElementById('historyCount');

/* ========================================
   Завантаження дітей із Firestore
   ======================================== */

async function initChildren() {
  try {
    childrenData = await loadChildren();
    console.log(`[App] Завантажено ${childrenData.length} дітей із Firestore`);
  } catch (error) {
    console.error('[App] Помилка завантаження дітей:', error);
    childrenData = [];
    showToast('Помилка завантаження бази. Перевірте підключення.', 'error');
  }
  updateTotal();
}

function updateTotal() {
  if (searchTotal) searchTotal.textContent = childrenData.length;
}

/* ========================================
   Пошук
   ======================================== */

function normalize(str) {
  return str.toLowerCase().replace(/[''`]/g, "'").replace(/['']/g, "'").replace(/[«»]/g, '"').trim();
}

function searchChildren(query) {
  const q = normalize(query).trim();
  if (q.length < CONFIG.minSearchLength) { clearResults(); return; }

  const tokens = q.split(/\s+/).filter(Boolean);
  const results = childrenData.filter((child) => {
    const haystack = normalize(`${child.fullName} ${child.teamLeader} ${child.parentName || ''} ${child.phone || ''}`);
    return tokens.every((token) => haystack.includes(token));
  });
  renderResults(results, q);
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

function escapeRegex(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function escapeHTML(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function renderResults(results, query) {
  searchResults.innerHTML = '';
  if (results.length === 0) {
    searchResults.innerHTML = '<div class="search-results__empty">😕 Нікого не знайдено.</div>';
    searchResults.classList.add('search-results--visible');
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

  searchResults.appendChild(ul);
  searchResults.classList.add('search-results--visible');
}

function clearResults() {
  searchResults.innerHTML = '';
  searchResults.classList.remove('search-results--visible');
}

async function selectChild(child) {
  selectedChild = child;

  // Заповнюємо поля: ПІБ, Вік, Тім-лідер, ПІБ батьків, Телефон, Медичні особливості
  fieldFullName.value = child.fullName || '';
  fieldAge.value = child.age || '';
  fieldTeamLeader.value = child.teamLeader || '';
  fieldParentName.value = child.parentName || '';
  fieldPhone.value = child.phone || '';
  fieldHealthInfo.value = child.healthInfo || '';

  searchInput.value = child.fullName;
  clearResults();
  showToast(`Обрано: ${child.fullName}`, 'success');

  // Показати історію звернень цієї дитини (з Firestore)
  await showChildHistory(child.fullName);

  fieldTemperature.focus();
}

/* ========================================
   Історія звернень (з Firestore, createdAt DESC)
   ======================================== */

async function showChildHistory(fullName) {
  try {
    const allRecords = await getExaminations();
    const childHistory = allRecords.filter((exam) =>
      exam.childName && normalize(exam.childName) === normalize(fullName)
    );

    historyCount.textContent = childHistory.length;

    if (childHistory.length === 0) {
      historySection.style.display = 'none';
      return;
    }

    historySection.style.display = 'block';

    historyBody.innerHTML = childHistory.map((exam) => {
      const mpLabel = exam.medicalPoint === 'black' ? 'Чорний' : 'Білий';
      const mpClass = exam.medicalPoint === 'black' ? 'data-table__mp-badge--black' : 'data-table__mp-badge--white';
      return `<tr>
        <td>${escapeHTML(exam.timestamp || '—')}</td>
        <td><span class="data-table__mp-badge ${mpClass}">${mpLabel}</span></td>
        <td>${exam.temperature ? escapeHTML(exam.temperature) + '°C' : '—'}</td>
        <td class="data-table__cell--wrap">${escapeHTML(exam.complaints || '—')}</td>
        <td class="data-table__cell--wrap">${escapeHTML(exam.actionsDone || '—')}</td>
        <td class="data-table__cell--wrap">${escapeHTML(exam.prescriptions || '—')}</td>
        <td>${exam.parentsNotified ? '<span class="data-table__badge data-table__badge--yes">Так</span>' : '<span class="data-table__badge data-table__badge--no">Ні</span>'}</td>
      </tr>`;
    }).join('');
  } catch (error) {
    console.error('[App] Помилка історії:', error);
  }
}

/* ========================================
   Медпункт
   ======================================== */

function setMedicalPoint(point) {
  selectedMedicalPoint = point;
  if (point === 'white') {
    mpWhiteBtn.classList.add('mp-btn--active');
    mpBlackBtn.classList.remove('mp-btn--active');
  } else {
    mpBlackBtn.classList.add('mp-btn--active');
    mpWhiteBtn.classList.remove('mp-btn--active');
  }
}

/* ========================================
   Debounce
   ======================================== */

function debounceSearch() {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => searchChildren(searchInput.value), CONFIG.searchDebounce);
}

/* ========================================
   Форма → Збереження в medical_records
   ======================================== */

function collectFormData() {
  return {
    childId: selectedChild ? (selectedChild.id || null) : null,
    childName: fieldFullName.value.trim(),
    complaints: fieldComplaints.value.trim(),
    temperature: fieldTemperature.value.trim(),
    actionsDone: fieldActionsDone.value.trim(),
    prescriptions: fieldPrescriptions.value.trim(),
    parentsNotified: fieldParentsNotified.checked,
    doctorName: fieldDoctorName.value.trim(),
    medicalPoint: selectedMedicalPoint
  };
}

function validateForm(data) {
  if (!data.childName) {
    showToast('Оберіть дитину через пошук', 'error');
    searchInput.focus();
    return false;
  }
  if (data.temperature && (isNaN(data.temperature) || data.temperature < 34 || data.temperature > 43)) {
    showToast('Температура має бути від 34°C до 43°C', 'error');
    fieldTemperature.focus();
    return false;
  }
  return true;
}

async function handleSubmit(event) {
  event.preventDefault();
  const data = collectFormData();
  if (!validateForm(data)) return;

  const result = await saveVisit(data);
  if (result.success) {
    showToast('✅ Дані збережено у Firebase!', 'success');
    resetForm();
  } else {
    showToast(result.message, 'error');
  }
}

function resetForm() {
  form.reset();
  selectedChild = null;
  searchInput.value = '';
  fieldFullName.value = '';
  fieldAge.value = '';
  fieldTeamLeader.value = '';
  fieldParentName.value = '';
  fieldPhone.value = '';
  fieldHealthInfo.value = '';
  fieldDoctorName.value = '';
  fieldTemperature.value = '';
  fieldComplaints.value = '';
  fieldActionsDone.value = '';
  fieldPrescriptions.value = '';
  fieldParentsNotified.checked = false;
  setMedicalPoint('white');
  historySection.style.display = 'none';
  searchInput.focus();
}

/* ========================================
   Toast
   ======================================== */

let toastTimer = null;

function showToast(message, type) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  if (toastTimer) clearTimeout(toastTimer);

  const toast = document.createElement('div');
  toast.className = `toast toast--${type || 'info'}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('toast--visible'));
  toastTimer = setTimeout(() => {
    toast.classList.remove('toast--visible');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/* ========================================
   Ініціалізація
   ======================================== */

async function init() {
  await initChildren();

  if (childrenData.length === 0) {
    showToast('База порожня. Імпортуйте дітей через Admin-панель.', 'error');
  }

  mpWhiteBtn.addEventListener('click', () => setMedicalPoint('white'));
  mpBlackBtn.addEventListener('click', () => setMedicalPoint('black'));

  searchInput.addEventListener('input', debounceSearch);
  searchBtn.addEventListener('click', () => searchChildren(searchInput.value));
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); searchChildren(searchInput.value); }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-section')) clearResults();
  });

  form.addEventListener('submit', handleSubmit);
  searchInput.focus();
}

init();