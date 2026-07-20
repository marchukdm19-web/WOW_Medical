/* ============================================
    WOW Medical — App (ES Module)
    Лікар: пошук, форма, історія
    Дані — тільки Firestore
    ============================================ */

import { CONFIG } from './config.js';
import { loadChildren } from './database.js';
import { saveVisit, getExaminations } from './api.js';

// Ключ localStorage для збереження медпункту (окремий, не впливає на інші налаштування)
const STORAGE_KEY_MEDICAL_POINT = 'wow_medical_selected_point';

// Стан
let childrenData = [];
let selectedChild = null;
let searchDebounceTimer = null;
let selectedMedicalPoint = 'white';
let isSubmitting = false;

// Стартовий екран
const startupScreen = document.getElementById('startupScreen');
const mainApp = document.getElementById('mainApp');
const startupWhiteBtn = document.getElementById('startupWhite');
const startupBlackBtn = document.getElementById('startupBlack');

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
    ).map(function(exam) {
      // Fallback для старих записів без medicalStation
      if (!exam.medicalStation) exam.medicalStation = 'white';
      return exam;
    });

    // Сортуємо хронологічно: найстаріші перші, найновіші — останні
    childHistory.sort((a, b) => {
      const timeA = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate().getTime() : 0;
      const timeB = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate().getTime() : 0;
      return timeA - timeB;
    });

    historyCount.textContent = childHistory.length;

    if (childHistory.length === 0) {
      historySection.style.display = 'none';
      return;
    }

    historySection.style.display = 'block';

    historyBody.innerHTML = childHistory.map((exam) => {
      const mpLabel = exam.medicalStation === 'black' ? 'BLACK' : 'WHITE';
      const mpClass = exam.medicalStation === 'black' ? 'data-table__mp-badge--black' : 'data-table__mp-badge--white';
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

function collectComplaints() {
  const checkboxes = document.querySelectorAll('#suggestedComplaints input[type="checkbox"][data-complaint]:checked');
  const selected = Array.from(checkboxes).map((cb) => cb.dataset.complaint);
  const otherInput = document.getElementById('complaintOther');
  if (otherInput && otherInput.value.trim()) {
    selected.push(otherInput.value.trim());
  }
  return selected;
}

function collectFormData() {
  const suggestedComplaints = collectComplaints();
  const freeText = fieldComplaints.value.trim();
  // Combine suggested complaints + free text
  const allComplaints = [...suggestedComplaints];
  if (freeText && !suggestedComplaints.includes(freeText)) {
    allComplaints.push(freeText);
  }
  const complaintsStr = allComplaints.join('; ');

  return {
    childId: selectedChild ? (selectedChild.id || null) : null,
    childName: fieldFullName.value.trim(),
    complaints: complaintsStr,
    suggestedComplaints: suggestedComplaints,
    temperature: fieldTemperature.value.trim(),
    actionsDone: fieldActionsDone.value.trim(),
    prescriptions: fieldPrescriptions.value.trim(),
    parentsNotified: fieldParentsNotified.checked,
    doctorName: fieldDoctorName.value.trim(),
    medicalStation: selectedMedicalPoint
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

  if (isSubmitting) return;
  isSubmitting = true;

  const submitBtn = form.querySelector('.btn--save');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Збереження...';
  }

  try {
    const data = collectFormData();
    if (!validateForm(data)) {
      isSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Зберегти`;
      }
      return;
    }

    const result = await saveVisit(data);
    if (result.success) {
      showToast('✅ Дані збережено у Firebase!', 'success');
      resetForm();
    } else {
      showToast(result.message, 'error');
    }
  } finally {
    isSubmitting = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Зберегти`;
    }
  }
}

function resetComplaints() {
  const checkboxes = document.querySelectorAll('#suggestedComplaints input[type="checkbox"][data-complaint]');
  checkboxes.forEach((cb) => { cb.checked = false; });
  const otherInput = document.getElementById('complaintOther');
  if (otherInput) otherInput.value = '';
}

function resetForm() {
  form.reset();
  resetComplaints();
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
   Статистика на стартовому екрані
   ======================================== */

function getTodayDateString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${dd}.${mm}.${yyyy}`;
}

function getYesterdayDateString() {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${dd}.${mm}.${yyyy}`;
}

function getTimeString(date) {
  if (!date || !date.toDate) return '';
  const d = date.toDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${min}`;
}

let allStartupRecords = [];
let startupComplaintsDay = 'today';

function buildComplaintTagsForStation(records, dateStr, station) {
  const dayRecords = records.filter((r) => {
    if (!r.timestamp || !r.timestamp.startsWith(dateStr)) return false;
    const mp = r.medicalStation || 'white';
    return mp === station;
  });

  const complaintCount = {};
  dayRecords.forEach((record) => {
    const complaints = record.suggestedComplaints || [];
    const childName = (record.childName || '').trim().toLowerCase();
    complaints.forEach((c) => {
      if (!complaintCount[c]) complaintCount[c] = new Set();
      if (childName) complaintCount[c].add(childName);
    });
  });
  // Convert Sets to counts (unique children)
  const complaintUnique = {};
  for (const [key, set] of Object.entries(complaintCount)) {
    complaintUnique[key] = set.size;
  }
  const complaintCountFinal = complaintUnique;

  const sorted = Object.entries(complaintCountFinal).sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) {
    return '<span class="scs-empty">Немає даних 😊</span>';
  }

  // Icons map (same as journal)
  const icons = {
    'Головний біль': '🤕', 'Підвищена температура': '🌡️', 'Слабкість': '😴', 'Запаморочення': '💫',
    'Біль у горлі': '🗣️', 'Нежить': '🤧', 'Кашель': '😮‍💨', 'Закладеність носа': '👃',
    'Нудота': '🤢', 'Блювання': '🤮', 'Біль у животі': '😖', 'Діарея': '💧',
    'Подряпина': '🩹', 'Садно': '🩹', 'Забій': '💢', 'Розтягнення': '🦵', 'Поріз': '🔪', 'Травма': '🤕',
    'Укус комахи': '🦟', 'Алергічна реакція': '🤧', 'Біль у вусі': '👂', 'Біль у зубі': '🦷', 'Почервоніння очей': '👁️'
  };

  const maxCount = sorted[0][1];
  let html = '<table class="scs-table"><tbody>';
  sorted.forEach(([name, count], idx) => {
    const barW = Math.round((count / maxCount) * 100);
    const icon = icons[name] || '📋';
    html += `<tr>
      <td class="scs-table__num">${idx + 1}</td>
      <td class="scs-table__icon">${icon}</td>
      <td class="scs-table__name">${escapeHTML(name)}</td>
      <td class="scs-table__bar-cell">
        <div class="scs-table__bar"><div class="scs-table__fill" style="width:${barW}%"></div></div>
      </td>
      <td class="scs-table__cnt">${count}</td>
    </tr>`;
  });
  html += '</tbody></table>';
  return html;
}

function buildStartupComplaintStats() {
  const bodyWhite = document.getElementById('scsBodyWhite');
  const bodyBlack = document.getElementById('scsBodyBlack');
  if (!bodyWhite && !bodyBlack) return;

  const dateStr = startupComplaintsDay === 'yesterday' ? getYesterdayDateString() : getTodayDateString();

  if (bodyWhite) {
    bodyWhite.innerHTML = buildComplaintTagsForStation(allStartupRecords, dateStr, 'white');
  }
  if (bodyBlack) {
    bodyBlack.innerHTML = buildComplaintTagsForStation(allStartupRecords, dateStr, 'black');
  }
}

function setStartupComplaintsDay(day) {
  startupComplaintsDay = day;
  const toggleBtns = document.querySelectorAll('#scsToggle .scs-toggle-btn');
  toggleBtns.forEach((btn) => {
    btn.classList.toggle('scs-toggle-btn--active', btn.dataset.day === day);
  });
  buildStartupComplaintStats();
}

async function loadStartupStats() {
  try {
    const allRecords = await getExaminations();
    const todayStr = getTodayDateString();

    // Сортуємо хронологічно
    allRecords.sort((a, b) => {
      const timeA = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate().getTime() : 0;
      const timeB = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate().getTime() : 0;
      return timeA - timeB;
    });

    // Фільтруємо за сьогодні
    const todayRecords = allRecords.filter((r) => {
      if (!r.timestamp) return false;
      return r.timestamp.startsWith(todayStr);
    });

    // Підвищена температура сьогодні (≥37°C)
    const feverToday = todayRecords.filter((r) => {
      const temp = parseFloat(r.temperature);
      return !isNaN(temp) && temp >= 37;
    }).length;

    // Медпункт WHITE
    const whiteToday = todayRecords.filter((r) => (r.medicalStation || 'white') === 'white').length;
    const whiteAll = allRecords.filter((r) => (r.medicalStation || 'white') === 'white');
    const whiteLast = whiteAll.length > 0 ? whiteAll[whiteAll.length - 1] : null;

    // Медпункт BLACK
    const blackToday = todayRecords.filter((r) => r.medicalStation === 'black').length;
    const blackAll = allRecords.filter((r) => r.medicalStation === 'black');
    const blackLast = blackAll.length > 0 ? blackAll[blackAll.length - 1] : null;

    // Унікальні діти за весь час
    const uniqueChildren = new Set();
    allRecords.forEach((r) => {
      if (r.childName) uniqueChildren.add(r.childName.trim().toLowerCase());
    });

    // Оновлюємо DOM
    const statWhiteToday = document.getElementById('statWhiteToday');
    const statWhiteLast = document.getElementById('statWhiteLast');
    const statBlackToday = document.getElementById('statBlackToday');
    const statBlackLast = document.getElementById('statBlackLast');
    const statTotalChildren = document.getElementById('statTotalChildren');

    if (statWhiteToday) statWhiteToday.textContent = `Сьогодні: ${whiteToday}`;
    if (statWhiteLast) {
      statWhiteLast.textContent = whiteLast
        ? `Останнє: ${getTimeString(whiteLast.createdAt)}, ${whiteLast.childName || '—'}`
        : 'Немає записів';
    }
    if (statBlackToday) statBlackToday.textContent = `Сьогодні: ${blackToday}`;
    if (statBlackLast) {
      statBlackLast.textContent = blackLast
        ? `Останнє: ${getTimeString(blackLast.createdAt)}, ${blackLast.childName || '—'}`
        : 'Немає записів';
    }
    const statFeverToday = document.getElementById('statFeverToday');
    if (statFeverToday) statFeverToday.textContent = feverToday;

    if (statTotalChildren) statTotalChildren.textContent = uniqueChildren.size;

    // Зберігаємо для статистики скарг
    allStartupRecords = allRecords;
    buildStartupComplaintStats();
  } catch (error) {
    console.warn('[App] Не вдалося завантажити статистику:', error);
  }
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => {
      fallbackCopyToClipboard(text);
    });
  } else {
    fallbackCopyToClipboard(text);
  }
}

function fallbackCopyToClipboard(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
  } catch (e) {
    // ignore
  }
  document.body.removeChild(textarea);
}

/* ========================================
   Стартовий екран — вибір медпункту
   ======================================== */

function getSavedMedicalPoint() {
  try {
    return localStorage.getItem(STORAGE_KEY_MEDICAL_POINT);
  } catch (e) {
    return null;
  }
}

function saveMedicalPoint(point) {
  try {
    localStorage.setItem(STORAGE_KEY_MEDICAL_POINT, point);
  } catch (e) {
    console.warn('[App] Не вдалося зберегти медпункт у localStorage');
  }
}

function clearMedicalPoint() {
  try {
    localStorage.removeItem(STORAGE_KEY_MEDICAL_POINT);
  } catch (e) {
    // ignore
  }
}

function showStartupScreen() {
  if (startupScreen) startupScreen.style.display = '';
  if (mainApp) mainApp.style.display = 'none';
}

function showMainApp() {
  if (startupScreen) startupScreen.style.display = 'none';
  if (mainApp) mainApp.style.display = '';
}

function applyMedicalPointToUI(point) {
  selectedMedicalPoint = point;
  setMedicalPoint(point);
}

/* ========================================
   Ініціалізація
   ======================================== */

async function init() {
  // ==========================================
  // Обробники подій додаємо НЕГАЙНО,
  // до будь-яких асинхронних операцій.
  // Це критично, щоб кнопки стартового екрану
  // реагували миттєво, не чекаючи Firestore.
  // ==========================================

  // Стартовий екран
  if (startupWhiteBtn) {
    startupWhiteBtn.addEventListener('click', () => {
      saveMedicalPoint('white');
      applyMedicalPointToUI('white');
      showMainApp();
    });
  }

  if (startupBlackBtn) {
    startupBlackBtn.addEventListener('click', () => {
      saveMedicalPoint('black');
      applyMedicalPointToUI('black');
      showMainApp();
    });
  }

  // Кнопки медпункту у формі
  mpWhiteBtn.addEventListener('click', () => setMedicalPoint('white'));
  mpBlackBtn.addEventListener('click', () => setMedicalPoint('black'));

  // Кнопка зміни медпункту у header
  const changePointBtn = document.getElementById('changeMedicalPointBtn');
  if (changePointBtn) {
    changePointBtn.addEventListener('click', () => {
      clearMedicalPoint();
      showStartupScreen();
    });
  }

  // Пошук
  searchInput.addEventListener('input', debounceSearch);
  searchBtn.addEventListener('click', () => searchChildren(searchInput.value));
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); searchChildren(searchInput.value); }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-section')) clearResults();
  });

  // Копіювання телефону при кліку
  if (fieldPhone) {
    fieldPhone.addEventListener('click', () => {
      const phone = fieldPhone.value.trim();
      if (!phone || phone === '—') return;
      copyToClipboard(phone);
      showToast('Номер скопійовано!', 'success');
    });
  }

  // Завантажити статистику скарг як зображення
  const scsDownloadBtn = document.getElementById('scsDownloadBtn');
  if (scsDownloadBtn) {
    scsDownloadBtn.addEventListener('click', async () => {
      const el = document.getElementById('startupComplaintStats');
      if (!el || typeof html2canvas === 'undefined') {
        showToast('Не вдалося завантажити: html2canvas не знайдено', 'error');
        return;
      }
      scsDownloadBtn.disabled = true;
      try {
        const canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
        const link = document.createElement('a');
        const label = startupComplaintsDay === 'yesterday' ? 'вчора' : 'сьогодні';
        link.download = `WOW_Medical_скарги_${label}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('📸 Статистику збережено як зображення', 'success');
      } catch (err) {
        console.error('html2canvas error:', err);
        showToast('Помилка створення зображення', 'error');
      }
      scsDownloadBtn.disabled = false;
    });
  }

  // Тогл статистики скарг (сьогодні / вчора)
  const scsToggle = document.getElementById('scsToggle');
  if (scsToggle) {
    scsToggle.addEventListener('click', (e) => {
      const btn = e.target.closest('.scs-toggle-btn');
      if (!btn) return;
      setStartupComplaintsDay(btn.dataset.day);
    });
  }

  // Форма
  form.addEventListener('submit', handleSubmit);

  // ==========================================
  // Тепер можна асинхронно завантажувати дані
  // ==========================================

  await initChildren();

  // Завантажуємо статистику для стартового екрану (паралельно, не блокує)
  loadStartupStats();

  if (childrenData.length === 0) {
    showToast('База порожня. Імпортуйте дітей через Admin-панель.', 'error');
  }

  // Визначаємо, який екран показати
  const savedPoint = getSavedMedicalPoint();

  if (savedPoint === 'white' || savedPoint === 'black') {
    // Медпункт уже обрано — одразу основний інтерфейс
    applyMedicalPointToUI(savedPoint);
    showMainApp();
  } else {
    // Медпункт не обрано — показуємо стартовий екран
    showStartupScreen();
  }

  if (mainApp && mainApp.style.display !== 'none') {
    searchInput.focus();
  }
}

init();
